const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const DB_URI = process.env.DB_URI || 'postgresql://postgres:postgres_local_password@127.0.0.1:5432/portfolio';
const sql = postgres(DB_URI);

async function run() {
  try {
    console.log('Connecting to database:', DB_URI);
    const texts = await sql`SELECT * FROM system_texts`;
    
    const targetDir = path.join(__dirname, 'src', 'migrations', 'initial-data');
    fs.mkdirSync(targetDir, { recursive: true });
    
    const targetFile = path.join(targetDir, 'system-texts.json');
    fs.writeFileSync(targetFile, JSON.stringify(texts, null, 2));
    
    console.log(`✅ Successfully saved ${texts.length} records to ${targetFile}`);
  } catch (err) {
    console.error('❌ Failed to pull data:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
