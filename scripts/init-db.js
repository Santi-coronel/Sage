const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const sql = fs.readFileSync(path.join(__dirname, "../backend/sql/init.sql"), "utf8");

const client = new Client({
  connectionString:
    "postgresql://postgres:Esteche1980.@db.cueycxnkdgkzjeeoleag.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log("✓ Connected to Supabase");
    await client.query(sql);
    console.log("✓ Database initialized (pgvector + tables created)");
  } catch (err) {
    console.error("✗ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
