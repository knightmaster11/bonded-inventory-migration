import fs from 'node:fs';
import { SQLITE_FILE } from '../src/db.js';

for (const f of [SQLITE_FILE, `${SQLITE_FILE}-wal`, `${SQLITE_FILE}-shm`]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
console.log('Demo database removed. It will be recreated and seeded on next start.');
process.exit(0);
