import { promises } from 'fs'
import mock from 'mock-fs'
import { Liquid } from 'liquidjs'

import Generator from '../src/generator'
import Renderer from '../src/renderer'


const file = `
---
title: Blogging Like a Hacker
author: Vuzi
abstract: Abstract of the first blog post
---
<html>
  <body>
    <h1>{{ title }}</h1>
    <h4>By {{ author }}</h4>
    <p>
      {{ abstract }}
    </p>
  </body>
</html>`

const template = `
<html>
  <body>
    <header>
    <h1>{{ title }}</h1>
    <h4>By {{ author }}</h4>
    <p>
      {{ abstract }}
    </p>
    </header>
    <article>
      {{ content }}
    </article>
  </body>
</html>`

const post1 = `
---
title: Blogging Like a Hacker
author: Vuzi
abstract: Abstract of the first blog post
---
Blogging Like a Hacker
========================

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
enim ad minim veniam, quis nostrud exercitation ullamco laboris
nisi ut aliquip ex ea commodo consequat.
`

const post2 = `
---
title: Doing something else
author: Vuzi
abstract: Abstract of the second blog post
---
Marked - Markdown Parser
========================

Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur.
`

const nestedFile1 = `
---
a: foo
b: bar
---
<h1>Hello, world</h1>
`

const nestedFile2 = `
---
c: foo2
d: bar2
---
<h1>Hello, world</h1>
`

const template2 = `
<html>
  <body>
  <div>{{ foo.nestedFile1.a }}</div>
  <div>{{ foo.nestedFile1.b }}</div>
  <div>{{ foo.bar.nestedFile2.c }}</div>
  <div>{{ foo.bar.nestedFile2.d }}</div>
  </body>
</html>`

beforeEach(async () => {
  // Creates an in-memory file system 
  mock({
    'test1': {
      'index.liquid': file.trim()
    },
    'test2': {
      '_template.liquid': template.trim(),
      'post1.md': post1.trim(),
      'post2.md': post2.trim()
    },
    'test3': {
      'index.liquid': template2.trim(),
      'foo': {
        'nestedFile1.liquid' : nestedFile1.trim(),
        'bar': {
          'nestedFile2.liquid' : nestedFile2.trim()
        }
      }
    },
    'test4': {
      'index.liquid': file.trim(),
      'assets': {
        'file.txt': 'hello'
      }
    }
  })
})

afterEach(async () => {
  mock.restore()
})

test('YAML values are injected in a file', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  await generator.generate('./test1', './out', true)

  const fileContent = await promises.readFile('./out/index.html').then(f => f.toString())

  const expected = `
<html>
  <body>
    <h1>Blogging Like a Hacker</h1>
    <h4>By Vuzi</h4>
    <p>
      Abstract of the first blog post
    </p>
  </body>
</html>`

  expect(fileContent).toStrictEqual(expected.trim())
})

test('YAML values and markdown are injected in a template', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now,  assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  await generator.generate('./test2', './out', true)

  const post1Content = await promises.readFile('./out/post1.html').then(f => f.toString())
  const post2Content = await promises.readFile('./out/post2.html').then(f => f.toString())

  const expectedPost1 = `
<html>
  <body>
    <header>
    <h1>Blogging Like a Hacker</h1>
    <h4>By Vuzi</h4>
    <p>
      Abstract of the first blog post
    </p>
    </header>
    <article>
      <h1 id="blogging-like-a-hacker">Blogging Like a Hacker</h1>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
enim ad minim veniam, quis nostrud exercitation ullamco laboris
nisi ut aliquip ex ea commodo consequat.</p>

    </article>
  </body>
</html>`

  const expectedPost2 = `
<html>
  <body>
    <header>
    <h1>Doing something else</h1>
    <h4>By Vuzi</h4>
    <p>
      Abstract of the second blog post
    </p>
    </header>
    <article>
      <h1 id="marked---markdown-parser">Marked - Markdown Parser</h1>
<p>Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur.</p>

    </article>
  </body>
</html>`

  expect(post1Content).toStrictEqual(expectedPost1.trim())
  expect(post2Content).toStrictEqual(expectedPost2.trim())
})

test('YAML values are accessible at the op level', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  await generator.generate('./test3', './out', true)

  const result = await promises.readFile('./out/index.html').then(f => f.toString())
  
  const expected = `
<html>
  <body>
  <div>foo</div>
  <div>bar</div>
  <div>foo2</div>
  <div>bar2</div>
  </body>
</html>`

  expect(result).toStrictEqual(expected.trim())
})


test('Asset folder is copied', async () => {
  const now = new Date()
  const engine = new Liquid()
  const renderer = Renderer(engine)

  const generator = Generator({ now, assetDirectory: 'assets', templateFilename: '_template.liquid'}, engine, renderer)
  await generator.generate('./test4', './out', true)

  const result = await promises.readFile('./out/assets/file.txt').then(f => f.toString())
  
  const expected = `hello`

  expect(result).toStrictEqual(expected.trim())
})
