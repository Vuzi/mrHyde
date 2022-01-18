
import { promises, copy } from 'fs-extra'
import { Liquid, Template } from 'liquidjs'
import path from 'path'

import { GenerationError } from '@root/error'
import Renderer from '@root/renderer'
import Log from '@root/logger'


export interface GeneratorConfiguration {
  now: Date
  templateFilename: string
  assetDirectory: string
}

export interface FileDetails {
  name: string
  path: string
  ignored: boolean
  template: boolean
  format: string
  formatDescription: string
}

export type DirectoryContent = (FileDetails | DirectoryDetails)[]

export interface DirectoryDetails {
  name: string
  path: string
  ignored: boolean
  type: string
  content: DirectoryContent
}

export interface Metadata {
  filePath: string,
  fileName: string,
  now: Date
}

export interface FileGenerationStat {
  details: FileDetails,
  elapsedSeconds: number,
  metadata: Metadata
}

export type DirectoryMetadata = { [key: string]: Metadata | DirectoryMetadata }

export interface DirectoryGenerationStat {
  details: DirectoryDetails,
  elapsedSeconds: number
  metadata: DirectoryMetadata,
  content: (FileGenerationStat | DirectoryGenerationStat)[]
}

export function isFileDetails(fileDetails: FileDetails | any): fileDetails is FileDetails {
  return (fileDetails as FileDetails).format !== undefined
}

export function isFileGenerationStat(fileDetails: FileGenerationStat | any): fileDetails is FileGenerationStat {
  return (fileDetails as DirectoryGenerationStat).content === undefined
}

export class GeneratorInstance {

  conf: GeneratorConfiguration
  engine: Liquid
  renderer: Map<string, Renderer>

  constructor(
    conf: GeneratorConfiguration,
    engine: Liquid,
    renderer: Map<string, Renderer>
  ) {
    this.conf = conf
    this.engine = engine
    this.renderer = renderer
  }

  async scan(sourceDir: string): Promise<DirectoryDetails> {
    const dirpath = path.normalize(sourceDir)
    const dirname = path.parse(dirpath).name
    const isIgnored = dirname.startsWith('_')
    const isAsset = dirname === 'assets'

    const content = await this.scanInternal(sourceDir)
    
    return {
      name: dirname,
      path: dirpath,
      ignored: isIgnored,
      type: isAsset ? 'Assets' : 'Pages',
      content
    }
  }

  private async scanInternal(sourceDir: string): Promise<DirectoryContent> {

    const dirContent = await promises.readdir(sourceDir, { withFileTypes: true })
    const files = dirContent.filter(f => f.isFile())
    const directories = dirContent.filter(f => f.isDirectory())

    const filesInfo =
      files.map(file => {
        const filePath = path.join(sourceDir, file.name)
        const fileName = path.parse(file.name).name
        const extension = path.parse(file.name).ext.slice(1)
        const renderer = this.renderer.get(extension)
        const isTemplate = file.name === this.conf.templateFilename
        const isIgnored = file.name.startsWith('_') || isTemplate

        if ((!isIgnored || isTemplate) && !renderer)
          Log.warn(`File '${filePath}' has an unknown format and will fail at generation`)

        return {
          name: fileName,
          path: filePath,
          ignored: isIgnored,
          template: isTemplate,
          format: extension,
          formatDescription: isTemplate ? 'Template Liquid' : renderer?.description ?? 'Unknown'
        }
      })
    
    const dirInfo =
      await Promise.all(directories.map(async dir => {
        const dirpath = path.join(sourceDir, dir.name)
        const isIgnored = dir.name.startsWith('_')
        const isAsset = dir.name === this.conf.assetDirectory

        // Scan the content if the directory is not ignored nor assets
        const content = isIgnored || isAsset ? [] : await this.scanInternal(dirpath)

        return {
          name: dir.name,
          path: dirpath,
          ignored: isIgnored,
          type: isIgnored ? 'Ignored': isAsset ? 'Assets' : 'Pages',
          content
        }
      }))

    return [...filesInfo, ...dirInfo]
  }

  async generate(
    sourceDir: string,
    targetDir: string,
    erase: boolean
  ): Promise<DirectoryGenerationStat> {
    try {
      await promises.access(targetDir)

      // Cleanup the destination folder if needed
      if (erase)
        await promises.rmdir(targetDir, { recursive: true })
    } catch {}

    // Scan the source folder
    const directory = await this.scan(sourceDir)

    // Generate everything!
    return await this.generateDirectory(directory, sourceDir, targetDir)
  }

  private async copyAssets(
    assetDirectory: DirectoryDetails,
    baseSourceDir: string,
    targetDir: string
  ): Promise<DirectoryGenerationStat> {
    const timer = Log.startTimer()

    const destination = path.join(targetDir, path.relative(baseSourceDir, assetDirectory.path))
    await promises.mkdir(destination, { recursive: true })
    await copy(assetDirectory.path, destination)

    const elapsedSeconds = Log.stopTimer(timer)

    return {
      details: assetDirectory,
      elapsedSeconds: elapsedSeconds,
      metadata: {},
      content: []
    }
  }

  private async generateDirectory(
    directory: DirectoryDetails,
    baseSourceDir: string,
    targetDir: string
  ): Promise<DirectoryGenerationStat> {
    const timer = Log.startTimer()
    
    const files = directory.content.filter(isFileDetails) as FileDetails[]
    const directories = directory.content.filter(d => !isFileDetails(d)) as DirectoryDetails[]

    // Find the template & process it
    const templateFile = files.find(f => f.template)

    let template: Template[] | undefined = undefined

    if (templateFile) {
      const templateContent = await promises.readFile(templateFile.path).then(b => b.toString())

      template = this.engine.parse(templateContent)
    }

    // If there's an asset folder, copy it
    const assetDirectory = directories.find(f => f.type === 'Assets')

    if (assetDirectory) {
      const assetState = await this.copyAssets(assetDirectory, baseSourceDir, targetDir)
    }

    // For each dir, recursively generate its content
    const resultsDir = await Promise.all(
      directories
        .filter(d => !d.ignored)
        .map(d => this.generateDirectory(d, baseSourceDir, targetDir))
    )

    // Merge the sub level metadatas together
    const metadata = resultsDir.reduce<DirectoryMetadata>((acc, dir) => {
      return {
        ...acc,
        ...{ [dir.details.name]: dir.metadata }
      }
    }, {})

    // Generate the contained file, feeding them the sub directories metadata
    const resultsFile = await Promise.all(
      files
        .filter(f => !f.ignored)
        .map(f => this.generateFile(f, baseSourceDir, targetDir, metadata, template))
    )

    // Also had the folder's own metadata before sending them up
    const fileMetadata = resultsFile.reduce<DirectoryMetadata>((acc, file) => {
      return {
        ...acc,
        ...{ [file.details.name]: file.metadata }
      }
    }, {})

    const elapsedSeconds = Log.stopTimer(timer)

    return {
      details: directory,
      elapsedSeconds,
      metadata: { ...metadata, ...fileMetadata },
      content: [ ...resultsFile, ...resultsDir ]
    }
  }

  private async generateFile(
    file: FileDetails,
    baseSourceDir: string,
    targetDir: string,
    dirMetadata: DirectoryMetadata,
    template?: Template[]
  ): Promise<FileGenerationStat> {
    const timer = Log.startTimer()
    
    // Get the file's content
    const fileContent = await promises.readFile(file.path).then(b => b.toString())

    // Try to get the file renderer based on its extension
    const fileRenderer = this.renderer.get(file.format)

    if (fileRenderer === undefined)
      throw GenerationError(file.path, `No renderer found for '${file.path}', unknown extension '${file.format}'`)

    const destinationFilePath = path.join(path.relative(baseSourceDir, path.parse(file.path).dir), file.name + '.html')

    const { content, metadata } = await fileRenderer.render(
      file,
      fileContent, 
      {
        fileName: file.name,
        filePath: destinationFilePath,
        now: this.conf.now
      },
      dirMetadata,
      template
    )

    const targetFilepath = path.join(targetDir, destinationFilePath)

    // Write the result
    await promises.mkdir(path.parse(targetFilepath).dir, { recursive: true })
    await promises.writeFile(targetFilepath, content)

    const elapsedSeconds = Log.stopTimer(timer)

    return { details: file, elapsedSeconds, metadata }
  }

}

export function Generator(
  conf: GeneratorConfiguration,
  engine: Liquid,
  renderer: Map<string, Renderer>
) {
  return new GeneratorInstance(conf, engine, renderer)
}

export default Generator
