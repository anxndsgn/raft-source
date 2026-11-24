-- Raft customized (self-host fork): Skills Hub, reply mode, the inbox's "For me",
-- managed MCP agent grant mode. These were migrations 0722-0726 before the
-- v1.33.1 upstream merge, whose own 0722-0764 took those numbers; a database
-- that ran the old ones already has all of this (self-host-migrate.ts drops
-- their journal rows first), so every statement is a no-op when it exists.
CREATE TABLE IF NOT EXISTS "inbox_for_me_done" (
	"user_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"done_through_seq" bigint,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_for_me_done_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_tasks" (
	"message_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"linked_by_type" text NOT NULL,
	"linked_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_tasks_message_id_task_id_pk" PRIMARY KEY("message_id","task_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills_hub_agent_settings" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"use_host_skills" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills_hub_assignments" (
	"server_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_hub_assignments_agent_id_item_id_pk" PRIMARY KEY("agent_id","item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills_hub_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text,
	"marketplace_source" jsonb,
	"files" jsonb,
	"source" jsonb,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "reply_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_mcp_servers" ADD COLUMN IF NOT EXISTS "agent_grant_mode" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_message_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_for_me_done" ADD CONSTRAINT "inbox_for_me_done_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_for_me_done" ADD CONSTRAINT "inbox_for_me_done_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_item_id_skills_hub_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."skills_hub_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbox_for_me_done_server_user" ON "inbox_for_me_done" USING btree ("server_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_message_tasks_task" ON "message_tasks" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_skills_hub_agent_settings_server" ON "skills_hub_agent_settings" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_skills_hub_assignments_server_agent" ON "skills_hub_assignments" USING btree ("server_id","agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_skills_hub_assignments_item" ON "skills_hub_assignments" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_skills_hub_items_server_kind_name" ON "skills_hub_items" USING btree ("server_id","kind","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_skills_hub_items_server" ON "skills_hub_items" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_reply_to" ON "messages" USING btree ("reply_to_message_id") WHERE reply_to_message_id IS NOT NULL;