import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  console.log('🚀 Starting community tables migration...');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Create community_profiles table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        alias TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        bio TEXT,
        expertise JSONB DEFAULT '[]'::jsonb,
        reputation_score INTEGER NOT NULL DEFAULT 0,
        is_verified_professional BOOLEAN NOT NULL DEFAULT FALSE,
        message_settings JSONB DEFAULT '{"acceptMessages": true, "notifyOnMessage": true, "notifyOnReply": true}'::jsonb,
        total_posts INTEGER NOT NULL DEFAULT 0,
        total_comments INTEGER NOT NULL DEFAULT 0,
        helpful_votes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        last_active_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Created community_profiles table');

    // Create indexes for community_profiles
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS community_profiles_user_id_idx ON community_profiles(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_profiles_alias_idx ON community_profiles(alias);`);

    // Create community_posts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        tags JSONB DEFAULT '[]'::jsonb,
        view_count INTEGER NOT NULL DEFAULT 0,
        upvotes INTEGER NOT NULL DEFAULT 0,
        comment_count INTEGER NOT NULL DEFAULT 0,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        moderation_notes TEXT,
        edited_at TIMESTAMP WITH TIME ZONE,
        edit_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Created community_posts table');

    // Create indexes for community_posts
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_posts_author_id_idx ON community_posts(author_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_posts_category_idx ON community_posts(category);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_posts_deleted_at_idx ON community_posts(deleted_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_posts_pinned_idx ON community_posts(is_pinned);`);

    // Create community_comments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        parent_comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
        depth INTEGER NOT NULL DEFAULT 0,
        upvotes INTEGER NOT NULL DEFAULT 0,
        is_accepted_answer BOOLEAN NOT NULL DEFAULT FALSE,
        edited_at TIMESTAMP WITH TIME ZONE,
        edit_count INTEGER NOT NULL DEFAULT 0,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        moderation_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Created community_comments table');

    // Create indexes for community_comments
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_comments_post_id_idx ON community_comments(post_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_comments_author_id_idx ON community_comments(author_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_comments_parent_id_idx ON community_comments(parent_comment_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_comments_created_at_idx ON community_comments(created_at);`);

    // Create community_messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        thread_id UUID NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        is_reported BOOLEAN NOT NULL DEFAULT FALSE,
        report_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Created community_messages table');

    // Create indexes for community_messages
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_sender_id_idx ON community_messages(sender_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_recipient_id_idx ON community_messages(recipient_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_thread_id_idx ON community_messages(thread_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_created_at_idx ON community_messages(created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_unread_idx ON community_messages(recipient_id, is_read);`);

    // Create community_reactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id UUID NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Created community_reactions table');

    // Create indexes and unique constraint for community_reactions
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reactions_user_id_idx ON community_reactions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reactions_target_idx ON community_reactions(target_type, target_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS community_reactions_unique_idx ON community_reactions(user_id, target_type, target_id, reaction_type);`);

    // Create community_reports table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id UUID NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolution_notes TEXT,
        action_taken TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Created community_reports table');

    // Create indexes for community_reports
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reports_reporter_id_idx ON community_reports(reporter_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reports_target_idx ON community_reports(target_type, target_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reports_status_idx ON community_reports(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_reports_created_at_idx ON community_reports(created_at);`);

    // Create community_bans table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_bans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        appeal_reason TEXT,
        appealed_at TIMESTAMP WITH TIME ZONE,
        appeal_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        appeal_reviewed_at TIMESTAMP WITH TIME ZONE,
        appeal_status TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Created community_bans table');

    // Create indexes for community_bans
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS community_bans_user_id_idx ON community_bans(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS community_bans_expires_at_idx ON community_bans(expires_at);`);

    // Create update trigger for updated_at columns
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Apply update trigger to all community tables with updated_at
    const tablesWithUpdatedAt = [
      'community_profiles',
      'community_posts',
      'community_comments',
      'community_reports',
      'community_bans'
    ];

    for (const tableName of tablesWithUpdatedAt) {
      await db.execute(sql`
        DROP TRIGGER IF EXISTS update_${sql.raw(tableName)}_updated_at ON ${sql.raw(tableName)};
        CREATE TRIGGER update_${sql.raw(tableName)}_updated_at
        BEFORE UPDATE ON ${sql.raw(tableName)}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log('✅ Created update triggers for timestamp columns');

    console.log('✨ Community tables migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});