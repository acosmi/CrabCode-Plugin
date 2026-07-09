#!/usr/bin/env bun
import { handler } from './tools/doctor.ts'

const install = process.argv.includes('--install')
const checkOnly = process.argv.includes('--check-only')
const result = await handler({ install: install && !checkOnly, useMirror: true })
console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
