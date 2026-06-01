import { drizzleDatabase } from '../src/repositories/drizzle/database';
import { systemTextRepository } from '../src/repositories/drizzle/systemTextRepository';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env.local is loaded so database connection string is available
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seed() {
  await drizzleDatabase.connect(process.env.DB_URI as string);
  const texts = [
    { id: 'error_required_field', content: { ru: 'Поле обязательно для заполнения', en: 'This field is required' } },
    { id: 'error_invalid_url', content: { ru: 'Некорректная ссылка', en: 'Invalid URL format' } },
    { id: 'error_invalid_uuid', content: { ru: 'Системная ошибка: неверный формат связи', en: 'System error: invalid reference format' } },
    { id: 'error_invalid_slug', content: { ru: 'URL может содержать только латинские буквы в нижнем регистре, цифры и дефисы', en: 'Slug can only contain lowercase letters, numbers, and hyphens' } },
    { id: 'error_invalid_hex', content: { ru: 'Неверный формат цвета (например, #FF0000)', en: 'Invalid hex color format (e.g. #FF0000)' } },
    { id: 'error_collection_required', content: { ru: 'Пожалуйста, выберите коллекцию', en: 'Please select a collection' } },
    { id: 'error_category_required', content: { ru: 'Пожалуйста, выберите категорию', en: 'Please select a category' } },
    { id: 'error_media_required', content: { ru: 'Медиа-файлы и обложка обязательны', en: 'Media and cover image are required' } },
    { id: 'error_invalid_email', content: { ru: 'Неверный формат почты', en: 'Invalid email format' } },
    { id: 'error_invalid_password', content: { ru: 'Пароль должен быть не менее 6 символов', en: 'Password must be at least 6 characters' } },
    { id: 'select_media', content: { ru: 'Выбрать медиа', en: 'Select Media' } },
    { id: 'select_media_description', content: { ru: 'Выберите изображения из библиотеки для добавления в проект.', en: 'Choose images from your library to add to this project.' } },
    { id: 'no_media_found', content: { ru: 'В библиотеке нет файлов. Перейдите в Медиа для загрузки.', en: 'No media found in the library. Go to Media manager to upload.' } },
    { id: 'items_selected', content: { ru: 'элементов выбрано', en: 'items selected' } },
    { id: 'confirm_selection', content: { ru: 'Подтвердить выбор', en: 'Confirm Selection' } }
  ];

  for (const t of texts) {
    await systemTextRepository.save(t);
  }

  console.log('✅ Validation texts seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
