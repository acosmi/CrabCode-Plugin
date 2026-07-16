import { appendRecord, StorageConflictError } from '../../src/storage.ts'

const [dir, worker] = process.argv.slice(2)
if (!dir || worker === undefined) throw new Error('usage: storage-cas-worker <dir> <worker>')
process.env.MEDIAOPS_DATA_DIR = dir
try {
  await appendRecord('approvals', { approvalId: 'shared-approval', worker }, {
    entityKey: 'shared-approval',
    expectedEntityVersion: null,
    entityVersion: 1,
  })
  process.stdout.write('won\n')
} catch (error) {
  if (error instanceof StorageConflictError) process.stdout.write('conflict\n')
  else throw error
}
