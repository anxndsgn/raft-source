CREATE TABLE "inbox_for_me_done" (
	"user_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"done_through_seq" bigint,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_for_me_done_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
ALTER TABLE "inbox_for_me_done" ADD CONSTRAINT "inbox_for_me_done_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_for_me_done" ADD CONSTRAINT "inbox_for_me_done_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inbox_for_me_done_server_user" ON "inbox_for_me_done" USING btree ("server_id","user_id");