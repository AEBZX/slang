#!/usr/bin/env node
import { rolldown } from 'rolldown'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(fileURLToPath(import.meta.url))
const bundle = await rolldown({
    input: path.join(root, 'cli/entry.ts'),
    platform: 'node',
    //lzma-native 必须保持 external:其源码用 __dirname(纯 CJS 全局),
    //打包进 ESM 后 Node v24 检测到 __dirname+TLA → ERR_AMBIGUOUS_MODULE_SYNTAX;
    //保持外部加载由 Node 原生 CJS 解析,__dirname 正常
    external: [/^node:/, 'commander', '@inquirer/prompts', 'lzma-native'],
})
await bundle.write({
    dir: path.join(root, 'dist'),
    entryFileNames: 'cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
})
console.log('built compiler/dist/cli.js')
