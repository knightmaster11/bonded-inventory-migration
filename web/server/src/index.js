import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { db, engine } from './db.js';
import { ensureSchema } from './schema.js';
import { seedIfEmpty } from './seed.js';
import { api } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);

// Serve the built client if it exists (npm run build in web/client).
const dist = path.resolve(here, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// One error shape for everything. The VB6 app had MsgBox in 14 places.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal error', details: err.details });
});

await ensureSchema(db);
const seeded = await seedIfEmpty(db);

app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}/api  (engine: ${engine}${seeded ? ', seeded demo data' : ''})`);
});
