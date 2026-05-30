CREATE TABLE "posts_to_media" (
	"post_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"position" jsonb,
	CONSTRAINT "posts_to_media_post_id_media_id_pk" PRIMARY KEY("post_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "posts_to_media" ADD CONSTRAINT "posts_to_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_media" ADD CONSTRAINT "posts_to_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Перенос данных из старой колонки jsonb в новую таблицу posts_to_media
INSERT INTO "posts_to_media" ("post_id", "media_id", "order", "position")
SELECT 
    id as post_id,
    (m->>'mediaId')::uuid as media_id,
    COALESCE((m->>'order')::integer, 0) as "order",
    m->'position' as "position"
FROM "posts", jsonb_array_elements("media") as m
WHERE "media" IS NOT NULL AND jsonb_typeof("media") = 'array'
ON CONFLICT ("post_id", "media_id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "posts" DROP COLUMN "media";