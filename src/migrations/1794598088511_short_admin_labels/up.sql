-- Data-only migration: shorter admin labels and the colours loading text.
-- Touches only these system_texts rows; everything else on the server stays as it is.
-- Applied once (tracked in schema_migrations), so re-running the deploy does nothing.

update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_collection';
update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_color';
update system_texts set content = '{"en": "Edit", "ru": "Редактировать"}'::jsonb where code = 'edit_color';
update system_texts set content = '{"en": "Edit", "ru": "Редактировать"}'::jsonb where code = 'edit_collection';
update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_new_tag';
update system_texts set content = '{"en": "Create", "ru": "Создать"}'::jsonb where code = 'create_tag';
update system_texts set content = '{"en": "Rename", "ru": "Переименовать"}'::jsonb where code = 'rename_tag';
update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_category';
update system_texts set content = '{"en": "Edit", "ru": "Редактировать"}'::jsonb where code = 'edit_category';
update system_texts set content = '{"en": "Edit", "ru": "Редактировать"}'::jsonb where code = 'edit_post';
update system_texts set content = '{"en": "Create", "ru": "Создать"}'::jsonb where code = 'create_post';
update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_system_text';
update system_texts set content = '{"en": "Add", "ru": "Добавить"}'::jsonb where code = 'add_page';
update system_texts set content = '{"en": "Edit", "ru": "Редактировать"}'::jsonb where code = 'edit_page';

insert into system_texts (id, content, area, code)
values ('bc913358-67ef-4344-acff-01666c8b87bc', '{"en": "Loading colors...", "ru": "Загрузка цветов..."}'::jsonb, 'admin', 'loading_colors')
on conflict (code) do nothing;
