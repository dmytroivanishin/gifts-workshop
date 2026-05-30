ALTER TABLE "categories" ADD COLUMN "tags_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "category_ids";