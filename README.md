# Добрые подарки / Kind Gifts

Мастерская подарков с ручной работой (мягкие игрушки, куклы, текстиль, кухонный текстиль):
публичный каталог с локализацией (ru/en) и однопользовательская CMS. Фронтенд и бэкенд — одно
приложение на Next.js. Полная архитектура, статус и открытые вопросы — в `CLAUDE.md`; этот
файл только про запуск локально.

**Не готово к продакшену.** Деплоя пока нет, см. `CLAUDE.md` §12 и `PRODUCTION-READINESS.md`.

## Стек

Next.js 16 (App Router, TypeScript) · PostgreSQL + Drizzle ORM · медиа в папке на диске, раздаёт Caddy · Redux Toolkit + RTK Query · Tailwind CSS 4 + shadcn/ui · Google OAuth + JWT.
Подробнее: `CLAUDE.md` §1.

## Локальный запуск

Нужны Docker, Node.js и npm. Все команды выполняются из корня репозитория.

### 1. Поднять инфраструктуру

```bash
npm run local:infra:start
```

Поднимает три контейнера из `docker-compose.local.yml`:
- `gifts-workshop-postgres` — PostgreSQL 16, порт 5432, база `gifts_workshop`;
- `gifts-workshop-caddy` — Caddy, раздаёт медиа на `localhost:8080`;
- `gifts-workshop-pgweb` — браузер БД на `localhost:8081`.

Данные лежат в `./.docker/db-data`, медиа — в `./.docker/media` (в git не попадают).

### 2. Создать `config/local.env`

Файл в `.gitignore`, в репозитории его нет. Настоящие значения спросите у владельца репозитория
или возьмите `config/test.env` как шаблон с моками. Полный список обязательных переменных и их
назначение — `CLAUDE.md` §9 (отдельного `.env.example` нет).

Для локальной базы и папки с медиа в нём должны стоять:
```
DB_URI="postgresql://postgres:postgres_local_password@127.0.0.1:5432/gifts_workshop"
S3_BUCKET_NAME="gifts-workshop-media"
```

### 3. Накатить миграцию

```bash
bash scripts/run.sh migrate
```

Создаёт схему (`src/migrations/1794246164091_initial/up.sql`) и заливает начальные данные
(`seed.ts`: пользователь-владелец, цвета, теги, коллекция, категории, страницы «Обо мне» и
«Оплата и доставка», строки интерфейса `system_texts`). Учёт ведётся в таблице
`schema_migrations`: повторный запуск ничего не применяет дважды. Для каждой миграции
проверяется контрольная сумма `up.sql`: если файл уже применённой миграции поменяли, команда
останавливается с ошибкой. Применённые миграции не редактируют, для изменений создают новую папку.

Миграция выполняется под advisory-lock, так что два одновременных запуска не конфликтуют.

### 4. Запустить приложение

```bash
bash scripts/run.sh dev
```

Использовать именно `bash scripts/run.sh`, а не `npm run dev`: скрипт загружает
`config/local.env`. Сайт: `http://localhost:3000` (ru и en), вход в админку: `/admin/login`.

## Переименование с «portfolio» на «gifts-workshop» (если у вас старое окружение)

Если на вашей машине ещё работает старая инфраструктура с именами `portfolio-*`, один раз
выполните:

1. Остановить старые контейнеры и удалить пустую старую сеть:
   ```bash
   docker-compose -f docker-compose.local.yml down
   docker network rm portfolio_portfolio-network   # если существует; занимает ту же подсеть 10.10.10.0/24
   ```
2. Переименовать базу, пока Postgres запущен (к базе не должно быть подключений):
   ```bash
   docker exec -i portfolio-postgres psql -U postgres -c "ALTER DATABASE portfolio RENAME TO gifts_workshop;"
   ```
   Если контейнер уже остановлен, сначала поднимите его под старым именем, либо, если данные
   не нужны, см. п. «Чистый старт» ниже.
3. Обновить `config/local.env` по образцу из шага 2 выше.
4. Поднять инфраструктуру заново: `npm run local:infra:start`.

### Чистый старт (если старые данные не нужны)

Удаляет всё, включая картинки и записи. Выполнять только если данные действительно не нужны:
```bash
docker-compose -f docker-compose.local.yml down
docker run --rm -v "$PWD/.docker:/d" postgres:16-alpine sh -c 'rm -rf /d/db-data /d/media'
npm run local:infra:start
bash scripts/run.sh migrate
```
Чистый старт также подходит, если поменялось только имя контейнера и данных не жалко.

## Скрипты

```bash
npm run local:infra:start            # поднять Postgres, Caddy, pgweb (docker-compose.local.yml)
npm run local:infra:stop             # остановить их
bash scripts/run.sh migrate          # накатить миграции и сиды (идемпотентно)
bash scripts/run.sh migrate:verify   # проверить: up.sql совпадает со schema.ts (на временной базе)
bash scripts/run.sh dev              # next dev с config/local.env
bash scripts/run.sh build            # next build
bash scripts/run.sh start            # next start (после build)
npm run lint                         # eslint — пока красный, см. CLAUDE.md §11
```

Тесты (`scripts/run-test.sh`):
```bash
scripts/run-test.sh test:infra:start   # тестовые Postgres :5433 и Caddy :8082 (медиа), с нуля, с drizzle-kit push
scripts/run-test.sh test:unit          # vitest
scripts/run-test.sh test:api           # Playwright, проект api
scripts/run-test.sh test:infra:stop
```

## Частые проблемы

**Ошибка БД сразу после запуска Docker** (например, не найдена таблица): база пустая, миграцию
не накатили. Выполните `bash scripts/run.sh migrate`.

**Вместо текста на сайте видны ключи (`search_placeholder`, `in_stock`)**: строки интерфейса не
попали в базу или закэшированы. Проверьте, что миграция прошла, затем очистите кэш и перезапустите:
```bash
rm -rf .next/dev/cache/fetch-cache
bash scripts/run.sh dev
```

**`Error while requesting resource` / `next/font: Failed to download Inter`** в логе: Next не может
скачать шрифты из Google Fonts (сеть или прокси). Сайт работает на запасном шрифте. Если нужен
полноценный шрифт, запустите с IPv4-first DNS:
`NODE_OPTIONS=--dns-result-order=ipv4first bash scripts/run.sh dev`.

**Порт 3000 занят**: два `next dev` не могут работать одновременно. Проверьте
`pgrep -af "next dev"` и остановите лишний.

## Документация

- **[`docs/BUSINESS-LOGIC.md`](docs/BUSINESS-LOGIC.md)** — что умеет сайт и админка, по разделам.
- **`CLAUDE.md`** — техническая документация: архитектура, API, авторизация, хранилище,
  переменные окружения, статус и известные проблемы.
