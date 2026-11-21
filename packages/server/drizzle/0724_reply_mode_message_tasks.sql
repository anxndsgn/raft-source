CREATE TABLE "message_tasks" (
	"message_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"linked_by_type" text NOT NULL,
	"linked_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_tasks_message_id_task_id_pk" PRIMARY KEY("message_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "reply_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" uuid;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_tasks_task" ON "message_tasks" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_reply_to" ON "messages" USING btree ("reply_to_message_id") WHERE reply_to_message_id IS NOT NULL;