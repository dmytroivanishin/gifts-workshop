import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env if needed
import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { systemTextRepository } from "../src/repositories/drizzle/systemTextRepository";

const commentsLocales = [
  {
    id: "comments",
    content: { en: "Comments", ru: "Комментарии" }
  },
  {
    id: "comments_subtitle",
    content: { en: "Manage user comments and replies.", ru: "Управление комментариями и ответами пользователей." }
  },
  {
    id: "all_statuses",
    content: { en: "All Statuses", ru: "Все статусы" }
  },
  {
    id: "loading",
    content: { en: "Loading...", ru: "Загрузка..." }
  },
  {
    id: "no_comments",
    content: { en: "No comments found", ru: "Комментарии не найдены" }
  },
  {
    id: "leave_comment",
    content: { en: "Leave a comment", ru: "Оставить комментарий" }
  },
  {
    id: "your_name",
    content: { en: "Your name", ru: "Ваше имя" }
  },
  {
    id: "write_comment",
    content: { en: "Write your comment here...", ru: "Напишите ваш комментарий здесь..." }
  },
  {
    id: "comment_submitted",
    content: { en: "Your comment has been submitted and is awaiting moderation.", ru: "Ваш комментарий отправлен и ожидает модерации." }
  },
  {
    id: "post_comment",
    content: { en: "Post Comment", ru: "Отправить" }
  },
  {
    id: "no_comments_yet",
    content: { en: "No comments yet. Be the first to share your thoughts!", ru: "Пока нет комментариев. Будьте первыми!" }
  },
  {
    id: "error_name_too_long",
    content: { en: "Name is too long", ru: "Имя слишком длинное" }
  },
  {
    id: "error_text_too_long",
    content: { en: "Comment is too long", ru: "Комментарий слишком длинный" }
  },
  {
    id: "commenting_as",
    content: { en: "Commenting as", ru: "Вы комментируете как" }
  },
  {
    id: "change",
    content: { en: "Change", ru: "Изменить" }
  },
  {
    id: "admin",
    content: { en: "Admin", ru: "Админ" }
  }
];

async function main() {
  console.log("Connecting to database...");
  await drizzleDatabase.connect(process.env.DB_URI as string);
  console.log("Connected.");

  console.log("Seeding comments locales...");

  for (const locale of commentsLocales) {
    try {
      await systemTextRepository.save(locale as any);
      console.log(`Saved locale: ${locale.id}`);
    } catch (error) {
      console.error(`Failed to save locale ${locale.id}:`, error);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
