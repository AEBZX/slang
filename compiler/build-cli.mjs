#!/usr/bin/env node
import { rolldown } from 'rolldown'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(fileURLToPath(import.meta.url))
const bundle = await rolldown({
    input: path.join(root, 'cli.ts'),
    platform: 'node',
    //compiler.js 会独立分发到项目 venv,运行时没有 node_modules,必须把 commander 打进 bundle
    external: [/^node:/],
})
await bundle.write({
    dir: path.join(root, 'dist'),
    entryFileNames: 'cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
})
console.log('built compiler/dist/cli.js')
