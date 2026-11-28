-- Data-only migration: the homepage notice that the catalog is still being filled.
-- Touches only this one system_texts row and never overwrites an existing one.
-- Applied once (tracked in schema_migrations); fresh installs already get the same row from the initial seed.

insert into system_texts (id, content, area, code) values ('29c8744f-5e38-4a1a-b9eb-4c1ea9dcc995', '{"ru":"Наша мастерская пока наполняется, на полках ещё не все работы","en":"Our workshop is still filling up, not all the works are on the shelves yet"}'::jsonb, 'public', 'catalog_filling_notice') on conflict (code) do nothing;
