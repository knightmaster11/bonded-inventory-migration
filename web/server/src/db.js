import knex from 'knex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(here, '..', 'data');
export const SQLITE_FILE = path.join(DATA_DIR, 'inventory.sqlite');

function buildConfig() {
  if (process.env.DB_CLIENT === 'mysql2') {
    return {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bonded_inventory',
        decimalNumbers: true,
        dateStrings: true,
      },
    };
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return {
    client: 'better-sqlite3',
    connection: { filename: SQLITE_FILE },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, done) => {
        conn.pragma('foreign_keys = ON');
        conn.pragma('journal_mode = WAL');
        done(null, conn);
      },
    },
  };
}

export const db = knex(buildConfig());
export const engine = process.env.DB_CLIENT === 'mysql2' ? 'mysql' : 'sqlite';
