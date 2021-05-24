
import chalk from 'chalk'
import {
  DirectoryDetails,
  DirectoryGenerationStat,
  isFileDetails,
  isFileGenerationStat
} from '@root/generator'


export type Timer = [number, number]

const Log = {
  info(...message: any[]) {
    console.log(chalk.blue.bold('[i]'), ...message);
  },
  warn(...message: any[]) {
    console.log(chalk.yellow.bold('[w]'), ...message.map(m => chalk.yellow(m)));
  },
  err(...message: any[]) {
    console.log(chalk.red.bold('[!]'), ...message.map(m => chalk.red(m)));
  },
  text(...text: any) {
    console.log(...text)
  },
  printDirectory(dir: DirectoryDetails) {
    const maxLineLength = maxDirLen(dir)
    Log.info(`📁 ${dir.path.padEnd(maxLineLength)} -> ${dir.type}`)
    printDirInternal(dir, maxLineLength)
  },
  printResult(stats: DirectoryGenerationStat) {
    const maxLineLength = maxResultLen(stats)
    Log.info(`📁 ${stats.details.path.padEnd(maxLineLength)} -> ${stats.elapsedSeconds.toFixed(3)}s`)
    printResultInternal(stats, maxLineLength)
  },
  startTimer(): Timer {
    return process.hrtime()
  },
  stopTimer(t: Timer): number {
    const end = process.hrtime(t)
    return (end[0] + (end[1] / 1e9))
  }
}

function printDirInternal(dir: DirectoryDetails, padding: number) {
  dir.content.map(r => {
    if (isFileDetails(r))
      Log.info(`   ${r.path.padEnd(padding)} -> ${r.formatDescription}`)
    else {
      Log.info(`📁 ${r.path.padEnd(padding)} -> ${r.type}`)
      printDirInternal(r, padding)
    }
  })
}

function maxDirLen(dir: DirectoryDetails, max = 0): number {
  return dir.content.reduce((max, r) => {
    if (isFileDetails(r))
      return r.path.length > max ? r.path.length : max
    else {
      const newMax = r.path.length > max ? r.path.length : max
      return maxDirLen(r, newMax)
    }
  }, max)
}

function printResultInternal(stats: DirectoryGenerationStat, padding: number) {
  stats.content.map(r => {
    if (isFileGenerationStat(r))
      Log.info(`   ${r.details.path.padEnd(padding)} -> ${r.elapsedSeconds.toFixed(3)}s`)
    else {
      Log.info(`📁 ${r.details.path.padEnd(padding)} -> ${r.elapsedSeconds.toFixed(3)}s`)
      printResultInternal(r, padding)
    }
  })
}

function maxResultLen(dir: DirectoryGenerationStat, max = 0): number {
  return dir.content.reduce((max, r) => {
    if (isFileGenerationStat(r))
      return r.details.path.length > max ? r.details.path.length : max
    else {
      const newMax = r.details.path.length > max ? r.details.path.length : max
      return maxResultLen(r, newMax)
    }
  }, max)
}

export default Log
