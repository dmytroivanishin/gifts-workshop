import { drizzleDatabase } from '../src/repositories/drizzle/database';
import { systemTextRepository } from '../src/repositories/drizzle/systemTextRepository';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seed() {
  await drizzleDatabase.connect(process.env.DB_URI as string);
  const texts = [
    { id: 'error_404_title', content: { ru: 'Упс! Страница потерялась', en: 'Oops! The page is lost' }, area: 'public' as const },
    { id: 'error_404_desc', content: { ru: 'Кажется, вы забрели в уголок мастерской, которого не существует.', en: 'It seems you wandered into a corner of the workshop that doesn\'t exist.' }, area: 'public' as const },
    { id: 'error_404_back', content: { ru: 'Вернуться на главную', en: 'Return to main page' }, area: 'public' as const },
    { id: 'error_500_title', content: { ru: 'Что-то пошло не так', en: 'Something went wrong' }, area: 'public' as const },
    { id: 'error_500_desc', content: { ru: 'У нас запутались ниточки или мы случайно укололи сервер иголочкой. Извините за временные неудобства, мы уже всё чиним.', en: 'Our threads got tangled or we accidentally pricked the server with a needle. Sorry for the temporary inconvenience, we\'re already fixing it.' }, area: 'public' as const },
    { id: 'error_500_retry', content: { ru: 'Попробовать снова', en: 'Try again' }, area: 'public' as const },
    { id: 'error_500_back', content: { ru: 'На главную', en: 'To main page' }, area: 'public' as const }
  ];

  for (const t of texts) {
    await systemTextRepository.save(t);
  }

  console.log('✅ Error texts seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
