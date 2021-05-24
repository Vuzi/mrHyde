
import mock from 'mock-fs'
import { Liquid } from 'liquidjs'

import Generator from '../src/generator'
import Renderer from '../src/renderer'


beforeEach(async () => {
  // Creates an in-memory file system 
  mock({
    'test1': {
      'index.html': '<h1>Hello, world</h1>',
      '_ingnored.txt' : '',
      '_alsoIgnored': {
        'filter.txt': '',
        '_ingnored.txt' : ''
      }
    },
    'test2': {
      'index.html': '<h1>Hello, world</h1>',
      'myCustomTemplate.liquid': ''
    },
    'test3': {
      'index.liquid': '',
      'posts' : {
        '_ignored.txt': 'file content here',
        'implate.liquid': 'file content here',
        'page1.yml': 'file content here',
        'page2.yml': 'file content here'
      },
      'nested': {
        'nested' : {
          'foo.html': '<h1>Hello, world</h1>',
          'assets': {
            'some.png': Buffer.from([8, 6, 7, 5, 3, 0, 9])
          }
        }
      }
    },
    'ignored': {}
  })
})

afterEach(async () => {
  mock.restore()
})

test('ignored path', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  const directory = await generator.scan('./test1')

  const expected =  {
    name: 'test1',
    path: 'test1',
    ignored: false,
    type: 'Pages',
    content: [
      {
        name: '_ingnored',
        path: 'test1/_ingnored.txt',
        ignored: true, // File ignored
        template: false,
        format: 'txt',
        formatDescription: 'Unknown'
      },
      {
        name: 'index',
        path: 'test1/index.html',
        ignored: false,
        template: false,
        format: 'html',
        formatDescription: 'HTML'
      },
      {
        name: '_alsoIgnored',
        path: 'test1/_alsoIgnored',
        ignored: true,   // Directory ignored
        type: 'Ignored', // Specific type
        content: []      // Content not scanned
      }
    ]
  }

  expect(directory).toStrictEqual(expected)
})


test('template', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: 'myCustomTemplate.liquid'}, engine, renderer)
  const directory = await generator.scan('./test2')

  const expected = {
    name: 'test2',
    path: 'test2',
    ignored: false,
    type: 'Pages',
    content: [
      {
        name: 'index',
        path: 'test2/index.html',
        ignored: false,
        template: false,
        format: 'html',
        formatDescription: 'HTML'
      },
      {
        name: 'myCustomTemplate',
        path: 'test2/myCustomTemplate.liquid',
        ignored: true,      // Template should be ignored as they're special files
        template: true,     // Template correctly detected
        format: 'liquid',   // Format
        formatDescription: 'Template Liquid'
      }
    ]
  }

  expect(directory).toStrictEqual(expected)
})

test('complex test (combined)', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  const directory = await generator.scan('./test3')

  const expected = {
    name: 'test3',
    path: 'test3',
    ignored: false,
    type: 'Pages',
    content: [
      {
        name: 'index',
        path: 'test3/index.liquid',
        ignored: false,
        template: false,
        format: 'liquid',
        formatDescription: 'Liquid'
      },
      {
        name: 'nested',
        path: 'test3/nested',
        ignored: false,
        type: 'Pages',
        content: [
          {
            name: 'nested',
            path: 'test3/nested/nested',
            ignored: false,
            type: 'Pages',
            content: [
              {
                name: 'foo',
                path: 'test3/nested/nested/foo.html',
                ignored: false,
                template: false,
                format: 'html',
                formatDescription: 'HTML'
              },
              {
                name: 'assets',
                path: 'test3/nested/nested/assets',
                ignored: false,
                type: 'Assets',
                content: [] // No content, because that's an asset folder
              }
            ]
          }
        ]
      },
      {
        name: 'posts',
        path: 'test3/posts',
        ignored: false,
        type: 'Pages',
        content: [
          {
            name: '_ignored',
            path: 'test3/posts/_ignored.txt',
            ignored: true,
            template: false,
            format: 'txt',
            formatDescription: 'Unknown'
          },
          {
            name: 'implate',
            path: 'test3/posts/implate.liquid',
            ignored: false,
            template: false,
            format: 'liquid',
            formatDescription: 'Liquid'
          },
          {
            name: 'page1',
            path: 'test3/posts/page1.yml',
            ignored: false,
            template: false,
            format: 'yml',
            formatDescription: 'YAML'
          },
          {
            name: 'page2',
            path: 'test3/posts/page2.yml',
            ignored: false,
            template: false,
            format: 'yml',
            formatDescription: 'YAML'
          }
        ]
      }
    ]
  }

  expect(directory).toStrictEqual(expected)
})
