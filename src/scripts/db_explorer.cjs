// scripts/db_explorer.cjs
require('dotenv/config');
const Database = require('better-sqlite3');
const inquirer = require('inquirer');
const path = require('node:path');
const Table = require('cli-table3');
const fs = require('node:fs');

const DB_PATH = path.join('src', 'data', 'bot.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ DB not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = wal');

function listTables() {
  const rows = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `).all();
  return rows.map(r => r.name);
}

function tableInfo(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function listRows(table, limit = 20) {
  return db.prepare(`SELECT * FROM ${table} LIMIT ${limit}`).all();
}

async function showTableData(table) {
  const rows = listRows(table);
  if (!rows.length) {
    console.log(`(Aucune donnée dans ${table})`);
    return;
  }

  const cols = Object.keys(rows[0]);
  const t = new Table({ head: cols });
  for (const r of rows) t.push(cols.map(c => r[c] ?? ''));
  console.log(t.toString());
}

async function main() {
  console.clear();
  console.log(`📘 SQLite DB Explorer — ${DB_PATH}\n`);

  const tables = listTables();
  if (!tables.length) {
    console.log('⚠️  No tables found.');
    process.exit(0);
  }

  while (true) {
    const { table } = await inquirer.prompt({
      type: 'list',
      name: 'table',
      message: 'Sélectionne une table à explorer :',
      choices: [...tables, new inquirer.Separator(), '❌ Quitter']
    });

    if (table === '❌ Quitter') break;

    console.clear();
    console.log(`\n=== ${table} ===`);
    await showTableData(table);
    const cols = tableInfo(table);
    console.log('\nColonnes :');
    cols.forEach(c =>
      console.log(`- ${c.name} (${c.type})${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' [PK]' : ''}`)
    );
    console.log('\n');
  }

  console.log('👋 Fermeture DB Explorer.');
  db.close();
}

main();
