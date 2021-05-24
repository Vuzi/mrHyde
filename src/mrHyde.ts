#!/usr/bin/env node

import { Liquid } from 'liquidjs'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

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
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Run with verbose logging',
          default: false
        })
    }, (argv) => {
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

    const generator = Generator({ now, assetDirectory, templateFilename}, engine, renderer)

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
