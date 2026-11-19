-- Manual order of posts. A higher number is higher in the list. Ties are allowed and are broken by
-- created_at desc. A new post gets the next value from a sequence, so it always lands at the top
-- without the application having to look up the current maximum.

create sequence if not exists posts_order_seq;

alter table posts add column if not exists "order" integer;

-- The oldest post gets 0 and every newer post gets the next number, so the list starts in the same
-- order it had by date. Ties are impossible here (id breaks them), but they are allowed afterwards.
update posts p
set "order" = ranked.position
from (
  select id, row_number() over (order by created_at asc, id asc) - 1 as position
  from posts
) ranked
where p.id = ranked.id;

alter table posts alter column "order" set default nextval('posts_order_seq');
alter table posts alter column "order" set not null;

-- The next new post takes the number after the highest one in use. Values are only ever handed out
-- upward, so a drag that writes 0..n-1 never collides with a value a later insert will receive.
select setval('posts_order_seq', coalesce((select max("order") from posts), 0) + 1, false);

create index if not exists posts_order_idx on posts ("order");
