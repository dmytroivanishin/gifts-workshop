-- Data-only migration: the upload-failure toast texts and the leave-during-upload dialog.
-- Touches only these six system_texts rows and never overwrites a row that already exists.
-- Applied once (tracked in schema_migrations); fresh installs already get the same rows from the initial seed.

insert into system_texts (id, content, area, code) values ('930a3661-b655-4f28-b54f-b78daa193cdb', '{"en":"Connection lost, file not uploaded","ru":"Соединение прервано, файл не загружен"}'::jsonb, 'admin', 'upload_connection_lost') on conflict (code) do nothing;
insert into system_texts (id, content, area, code) values ('c8c38148-2532-49cf-982a-25cf07ce52a6', '{"en":"Server error, file not uploaded","ru":"Ошибка сервера, файл не загружен"}'::jsonb, 'admin', 'upload_server_error') on conflict (code) do nothing;
insert into system_texts (id, content, area, code) values ('da824bfc-da36-4fe2-af62-352918b3a520', '{"ru":"Загрузка ещё идёт","en":"Upload in progress"}'::jsonb, 'admin', 'leave_upload_title') on conflict (code) do nothing;
insert into system_texts (id, content, area, code) values ('58fa4dc7-47f9-43de-9dfc-f8fdbcf430c0', '{"ru":"Файлы, которые ещё не загружены, не сохранятся. Уйти со страницы?","en":"Files that have not finished uploading will not be saved. Leave this page?"}'::jsonb, 'admin', 'leave_upload_message') on conflict (code) do nothing;
insert into system_texts (id, content, area, code) values ('5a35cfcb-ea6c-40fc-90ef-e6c4d26358c9', '{"ru":"Уйти","en":"Leave"}'::jsonb, 'admin', 'leave_upload_confirm') on conflict (code) do nothing;
insert into system_texts (id, content, area, code) values ('72d36e3a-bd04-4944-8667-39087df53549', '{"ru":"Остаться","en":"Stay"}'::jsonb, 'admin', 'leave_upload_stay') on conflict (code) do nothing;
