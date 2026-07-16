import { appendRecord } from '../../src/storage.ts'

const [dir, worker, rawCount] = process.argv.slice(2)
if (!dir || worker === undefined || !rawCount) throw new Error('usage: storage-worker <dir> <worker> <count>')
process.env.MEDIAOPS_DATA_DIR = dir
for (let index = 0; index < Number(rawCount); index++) {
  await appendRecord('audit-events', { event: 'multi-process-test', worker, index })
}
