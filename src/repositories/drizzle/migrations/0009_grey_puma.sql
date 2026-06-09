
ALTER TABLE "system_texts" ADD COLUMN "code" varchar(255);--> statement-breakpoint
UPDATE "system_texts" SET "code" = "id";--> statement-breakpoint
ALTER TABLE "system_texts" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_texts" ADD CONSTRAINT "system_texts_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "system_texts" DROP CONSTRAINT "system_texts_pkey";--> statement-breakpoint
ALTER TABLE "system_texts" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "system_texts" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY;