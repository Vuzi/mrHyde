#!/usr/bin/env node

import { Liquid } from 'liquidjs'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import * as chokidar from 'chokidar'
import { StaticServer } from 'http-expose'

import Renderer from '@root/renderer'
import Log from '@root/logger'
import { isError, isGenerationError } from '@root/error'
import Generator from '@root/generator'


Log.text(`

   $$\\      $$\\               $$\\   $$\\                 $$\\           
   $$$\\    $$$ |              $$ |  $$ |                $$ |          
   $$$$\\  $$$$ | $$$$$$\\      $$ |  $$ |$$\\   $$\\  $$$$$$$ | $$$$$$\\  
   $$\\$$\\$$ $$ |$$  __$$\\     $$$$$$$$ |$$ |  $$ |$$  __$$ |$$  __$$\\ 
   $$ \\$$$  $$ |$$ |  \\__|    $$  __$$ |$$ |  $$ |$$ /  $$ |$$$$$$$$ |
   $$ |\\$  /$$ |$$ |          $$ |  $$ |$$ |  $$ |$$ |  $$ |$$   ____|
   $$ | \\_/ $$ |$$ |          $$ |  $$ |\\$$$$$$$ |\\$$$$$$$ |\$$$$$$$\ 
   \\__|     \\__|\\__|          \\__|  \\__| \\____$$ | \\_______| \\_______|
                                        $$\\   $$ |                    
                                        \\$$$$$$  |                    
                                        \\______/                     
                     
`)
Log.info('Starting the application 🚀')

const args =
  yargs(hideBin(process.argv))
    .usage('Usage: mrhyde <command> [options]')
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Run with verbose logging',
      default: false
    })
    .command('dev <dir> [out]', 'Run the static website generator in watch mode and expose the result', (yargs) => {
      return yargs
        .positional('dir', {
          type: 'string',
          describe: 'Directory to scan',
          demandOption: true
        })
        .positional('out', {
          type: 'string',
          describe: 'Output directory',
          default: './out'
        })
        .option('template', {
          type: 'string',
          description: 'Template file',
          default: '_template.liquid'
        })
        .option('asset', {
          type: 'string',
          description: 'Asset directory',
          default: 'assets'
        })
        .option('erase', {
          alias: 'e',
          type: 'boolean',
          description: 'Erase the output before generation',
          default: false
        })
        .option('host', {
          type: 'string',
          description: 'Web server host',
          default: 'localhost'
        })
        .option('port', {
          alias: 'p',
          type: 'number',
          description: 'Web server port',
          default: 80
        })
    }, (argv) => {
      serve(argv.host, argv.port, argv.dir, argv.out, argv.asset, argv.template, argv.verbose, argv.erase)
    })
    .command('run <dir> [out]', 'Run the static website generator', (yargs) => {
      return yargs
        .positional('dir', {
          type: 'string',
          describe: 'Directory to scan',
          demandOption: true
        })
        .positional('out', {
          type: 'string',
          describe: 'Output directory',
          default: './out'
        })
        .option('template', {
          type: 'string',
          description: 'Template file',
          default: '_template.liquid'
        })
        .option('asset', {
          type: 'string',
          description: 'Asset directory',
          default: 'assets'
        })
        .option('erase', {
          alias: 'e',
          type: 'boolean',
          description: 'Erase the output before generation',
          default: false
        })
        .option('watch', {
          alias: 'w',
          type: 'boolean',
          description: 'Run in watch mode',
          default: false
        })
    }, (argv) => {
      if (argv.watch)
        watch(argv.dir, argv.out, argv.asset, argv.template, argv.verbose, argv.erase)
      else
        generate(argv.dir, argv.out, argv.asset, argv.template, argv.verbose, argv.erase)
    })
    .command('scan <dir>', 'Scan the source folder', (yargs) => {
      return yargs
        .positional('dir', {
          type: 'string',
          describe: 'Directory to scan',
          demandOption: true
        })
        .option('template', {
          type: 'string',
          description: 'Template file',
          default: '_template.liquid'
        })
        .option('asset', {
          type: 'string',
          description: 'Asset directory',
          default: 'assets'
        })
    }, (argv) => {
      scan(argv.dir, argv.asset, argv.template)
    })
    .version()
    .help('h')
    .alias('h', 'help')
    .demandCommand()
    .argv

async function serve(
  host: string,
  port: number,
  dir: string,
  out: string,
  assetDirectory: string,
  templateFilename: string,
  verbose: boolean,
  erase: boolean
) {
  
  try {
    const server = new StaticServer({
      host,
      port,
      source: out,
      noCache: true,
      allowedOrigins: ['*']
    })

    server.on('start', (host, port) => {
      Log.info(`Server started on http://${host}:${port} ✔️`)

      watch(dir, out, assetDirectory, templateFilename, verbose, erase)
    })

    if (verbose)
      server.on('request', (req) => {
        Log.info(`Request received for ${req.url}`)
      })

    server.on('response', (path, response, time) => {
      Log.info(`${response.code} - ${path} (${(time / 1000).toFixed(3)}s)`)
    })

    server.on('error', (path, error, time) => {
      Log.warn(`${error.code} - ${path} (${(time / 1000).toFixed(3)}ms)`)
    })

    server.on('failure', (e) => {
      Log.err(`Failed to start the web server`)
      Log.err(`↪️\t${e.message}`)
      e.stack && Log.err(e.stack)
      process.exit()
    })

    async function cleanup() {
      Log.info('Stopping the web server 🔥')

      await server.stop()
      process.exit()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGQUIT', cleanup)
    process.on('SIGTERM', cleanup)
    server.start()

  } catch(e) {
    Log.err(`An unexpected error occurred`)
    Log.err(e)
  }
}

async function watch(
  dir: string,
  out: string,
  assetDirectory: string,
  templateFilename: string,
  verbose: boolean,
  erase: boolean
) {
  try {
    // First generation
    await generate(dir, out, assetDirectory, templateFilename, verbose, erase)
    
    const watcher = chokidar.watch(dir, {
      ignoreInitial: true,
      awaitWriteFinish: true
    }).on('all', async () => {
      Log.info('Changes detected, regenerating 🔄')
      await generate(dir, out, assetDirectory, templateFilename, verbose, erase)
    })

    async function cleanup() {
      Log.info('Stopping the watcher 🔥')

      await watcher.close()
      process.exit()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGQUIT', cleanup)
    process.on('SIGTERM', cleanup)

    Log.info(`Watching '${out}' for changes.. ⏳`)
  } catch(e) {
    Log.err(`An unexpected error occurred`)
    Log.err(e)
  }
}

async function generate(
  dir: string,
  out: string,
  assetDirectory: string,
  templateFilename: string,
  verbose: boolean,
  erase: boolean
) {

  Log.info(`Scanning '${dir}' and writing to '${out}'`)
  Log.info('Generation starting now ⤵️')
  const timer = Log.startTimer()

  try {
    const now = new Date()
    const engine = new Liquid()
    const renderer = Renderer(engine)

    const generator = Generator({ now, assetDirectory, templateFilename }, engine, renderer)

    const stats = await generator.generate(dir, out, erase)

    Log.printResult(stats)

    if(verbose) {
      Log.info('Metadata generated:')
      console.dir(stats.metadata, { depth: null })
    }

    Log.info('Generation done ✔️')
  } catch(e) {
    if (isGenerationError(e)) {
      Log.err(`An error occurred during the generation of '${e.path}'`)
      Log.err(`↪️\t${e.message}`)
    } else if (isError(e)) {
      Log.err(`An error occurred during the generation'`)
      Log.err(`↪️\t${e.message}`)
      e.stack && Log.err(e.stack)
    } else {
      Log.err(`An unexpected error occurred during the generation`)
      Log.err(e)
    }

    Log.err('Generation failed ❌')
  } finally {
    const elapsedSeconds = Log.stopTimer(timer)
    Log.info(`Took ${elapsedSeconds.toFixed(3)} seconds`)
  }
}

async function scan(dir: string, assetDirectory: string, templateFilename: string) {
  Log.info(`Scanning '${dir}'`)
  Log.info('Scanning starting now ⤵️')
  const timer = Log.startTimer()

  try {
    const now = new Date()
    const engine = new Liquid()
    const renderer = Renderer(engine)

    const generator = Generator({ now, assetDirectory, templateFilename}, engine, renderer)
    const directory = await generator.scan(dir)

    Log.printDirectory(directory)
    Log.info('Scan done ✔️')
  } catch(e) {
    if (isGenerationError(e)) {
      Log.err(`An error occurred during the scan of '${e.path}'`)
      Log.err(`↪️\t${e.message}`)
    } else if (isError(e)) {
      Log.err(`An error occurred during the scan'`)
      Log.err(`↪️\t${e.message}`)
      e.stack && Log.err(e.stack)
    } else {
      Log.err(`An unexpected error occurred during the scan`)
      Log.err(e)
    }

    Log.err('Scan failed ❌')
  } finally {
    const elapsedSeconds = Log.stopTimer(timer)
    Log.info(`Took ${elapsedSeconds.toFixed(3)} seconds`)
  }
}
