DROP TABLE IF EXISTS "token_sessions";
--> statement-breakpoint
CREATE TABLE "token_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token_family" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_sessions" ADD CONSTRAINT "token_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;