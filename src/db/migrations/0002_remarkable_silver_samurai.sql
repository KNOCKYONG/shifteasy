CREATE TABLE "shift_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"shift_id" varchar(255) NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled',
	"notes" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
