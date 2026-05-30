CREATE TABLE "categories_to_tags" (
	"category_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "categories_to_tags_category_id_tag_id_pk" PRIMARY KEY("category_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "posts_to_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "posts_to_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "categories_to_tags" ADD CONSTRAINT "categories_to_tags_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories_to_tags" ADD CONSTRAINT "categories_to_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_tags" ADD CONSTRAINT "posts_to_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_tags" ADD CONSTRAINT "posts_to_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "tags_ids";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "tag_ids";