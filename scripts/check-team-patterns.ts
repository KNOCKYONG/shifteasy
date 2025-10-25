import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.SESSION_URL || process.env.DIRECT_URL!, {
  ssl: 'require',
});

async function checkAndCreateTeamPatternsTable() {
  try {
    // Check if team_patterns table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'team_patterns'
      );
    `;

    const tableExists = result[0].exists;
    console.log('team_patterns table exists:', tableExists);

    if (!tableExists) {
      console.log('Creating team_patterns table...');

      await sql`
        CREATE TABLE "team_patterns" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "department_id" uuid NOT NULL,
          "required_staff_day" integer DEFAULT 5 NOT NULL,
          "required_staff_evening" integer DEFAULT 4 NOT NULL,
          "required_staff_night" integer DEFAULT 3 NOT NULL,
          "default_patterns" jsonb DEFAULT '[["D","D","D","OFF","OFF"]]'::jsonb NOT NULL,
          "total_members" integer DEFAULT 15 NOT NULL,
          "is_active" text DEFAULT 'true' NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `;

      await sql`
        ALTER TABLE "team_patterns"
        ADD CONSTRAINT "team_patterns_department_id_departments_id_fk"
        FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id")
        ON DELETE cascade ON UPDATE no action;
      `;

      await sql`CREATE INDEX "team_patterns_department_idx" ON "team_patterns" USING btree ("department_id");`;
      await sql`CREATE INDEX "team_patterns_active_idx" ON "team_patterns" USING btree ("is_active");`;

      console.log('team_patterns table created successfully!');
    } else {
      console.log('team_patterns table already exists, no action needed.');
    }

    // Check table structure
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'team_patterns'
      ORDER BY ordinal_position;
    `;

    console.log('\nTable structure:');
    console.table(columns);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkAndCreateTeamPatternsTable();
