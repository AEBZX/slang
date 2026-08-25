#!/usr/bin/env node
import { rolldown } from 'rolldown'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(fileURLToPath(import.meta.url))
const bundle = await rolldown({
    input: path.join(root, 'entry.ts'),
    platform: 'node',
    external: [/^node:/, 'commander','@inquirer/prompts','tar','lzma-native'],
})
await bundle.write({
    dir: path.join(root, 'dist'),
    entryFileNames: 'cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
})
