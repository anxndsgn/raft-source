CREATE TABLE "skills_hub_agent_settings" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"use_host_skills" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills_hub_assignments" (
	"server_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_hub_assignments_agent_id_item_id_pk" PRIMARY KEY("agent_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "skills_hub_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text,
	"marketplace_source" jsonb,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_agent_settings" ADD CONSTRAINT "skills_hub_agent_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_item_id_skills_hub_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."skills_hub_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_assignments" ADD CONSTRAINT "skills_hub_assignments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_hub_items" ADD CONSTRAINT "skills_hub_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_skills_hub_agent_settings_server" ON "skills_hub_agent_settings" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_skills_hub_assignments_server_agent" ON "skills_hub_assignments" USING btree ("server_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_skills_hub_assignments_item" ON "skills_hub_assignments" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_skills_hub_items_server_kind_name" ON "skills_hub_items" USING btree ("server_id","kind","name");--> statement-breakpoint
CREATE INDEX "idx_skills_hub_items_server" ON "skills_hub_items" USING btree ("server_id");