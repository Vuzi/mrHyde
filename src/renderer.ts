import YAML from 'yaml'
import marked from 'marked'
import { Liquid, Template } from 'liquidjs'

import { GenerationError } from '@root/error'
import { DirectoryMetadata, FileDetails, Metadata } from '@root/generator'


interface Renderer {
  description: string,
  render: (
    file: FileDetails,
    content: string,
    metadata: Metadata,
    subMetadata: DirectoryMetadata,
    template?: Template[]
  ) => Promise<{ content: string, metadata: Metadata }>
}

class MarkdownRenderer {

  engine: Liquid

  constructor(engine: Liquid) {
    this.engine = engine
  }

  description: string = 'Markdown'

  async render(
    file: FileDetails,
    rawContent: string,
    metadata: Metadata,
    subMetadata: DirectoryMetadata,
    template?: Template[]
  ) {
    if (template === undefined)
      throw GenerationError(file.path, `No template provided for markdown file '${file.path}'`)

    // Extract the metadata
    const yamlContent = YAML.parseAllDocuments(rawContent)

    const ownMetadata = yamlContent.length > 1 ? yamlContent[0].toJSON() : {}
    const mergedMetadata = { ...ownMetadata, ...metadata }

    // Get the content
    const contentStart = yamlContent.length > 1 ? (yamlContent[1].range?.[0] ?? 0) + 1 : 0 // The content start after the 'second' document
    const content = marked(rawContent.slice(contentStart))

    // Render the template
    return await this.engine
      .render(template, { ...subMetadata, ...mergedMetadata, content })
      .then(c => ({ content: c, metadata: mergedMetadata}))
  }
}

class YamlRenderer {

  engine: Liquid

  constructor(engine: Liquid) {
    this.engine = engine
  }

  description: string = 'YAML'

  async render(
    file: FileDetails,
    rawContent: string,
    metadata: Metadata,
    subMetadata: DirectoryMetadata,
    template?: Template[]
  ) {
    if (template === undefined)
      throw GenerationError(file.path, `No template provided for yaml file '${file.path}'`)

    const contentYaml = YAML.parseAllDocuments(rawContent)
  
    if (contentYaml.length < 1)
      throw GenerationError(file.path, `No metadata found in file '${file.path}'`)
  
    const ownMetadata = contentYaml[0].toJSON()
    const mergedMetadata = { ...ownMetadata, ...metadata }
    
    // Render the template
    return await this.engine
      .render(template, { ...subMetadata, ...mergedMetadata })
      .then(c => ({ content: c, metadata: mergedMetadata}))
  }
}

class LiquidRenderer {

  engine: Liquid

  constructor(engine: Liquid) {
    this.engine = engine
  }

  description: string = 'Liquid'

  async render(
    file: FileDetails,
    rawContent: string,
    metadata: Metadata,
    subMetadata: DirectoryMetadata,
    template?: Template[]
  ) {
    // Extract the metadata
    const yamlContent = YAML.parseAllDocuments(rawContent)

    const ownMetadata = yamlContent.length > 1 ? yamlContent[0].toJSON() : {}
    const mergedMetadata = { ...ownMetadata, ...metadata }

    // Get the content
    const contentStart = yamlContent.length > 1 ? (yamlContent[1].range?.[0] ?? 0) + 1 : 0 // The content start after the 'second' document
    const content = rawContent.slice(contentStart)
    const generatedContent = await this.engine.parseAndRender(content, { ...subMetadata, ...mergedMetadata })

    if (template) {
      // Render the template
      return await this.engine
        .render(template, { ...subMetadata, ...mergedMetadata, content: generatedContent })
        .then(c => ({ content: c, metadata: mergedMetadata}))
    } else
      return { content: generatedContent, metadata: mergedMetadata }
  }
}

const HtmlRenderer: Renderer = {
  description: 'HTML',
  render: async (
    file: FileDetails,
    rawContent: string,
    fileMetadata: Metadata,
    subMetadata: DirectoryMetadata,
    template?: Template[]
  ) => {
    // Nothing to render
    return { content: rawContent, metadata: fileMetadata }
  }
}

function Renderer(engine: Liquid) {
  return new Map<string, Renderer>([
    ['md', new MarkdownRenderer(engine)],
    ['yml', new YamlRenderer(engine)],
    ['liquid', new LiquidRenderer(engine)],
    ['html', HtmlRenderer]
  ])
}

export default Renderer
