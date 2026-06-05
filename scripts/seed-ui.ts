import { drizzleDatabase } from '../src/repositories/drizzle/database';
import { systemTextRepository } from '../src/repositories/drizzle/systemTextRepository';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env.local is loaded so database connection string is available
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seed() {
  await drizzleDatabase.connect(process.env.DB_URI as string);
  const texts = [
    { id: 'load_more', content: { ru: 'Загрузить еще', en: 'Load more' }, area: 'shared' as const },
    { id: 'all_items_loaded', content: { ru: 'Все элементы загружены', en: 'All items loaded' }, area: 'shared' as const },
    { id: 'system_texts', content: { ru: 'Системные тексты', en: 'System Texts' }, area: 'shared' as const },
    { id: 'missing_translation', content: { ru: 'Отсутствует перевод', en: 'Missing translation' }, area: 'shared' as const }
  ];

  for (const t of texts) {
    await systemTextRepository.save(t);
  }

  console.log('✅ UI texts seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
