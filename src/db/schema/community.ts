import { pgTable, uuid, text, timestamp, jsonb, integer, index, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './tenants';

// Community Profiles - Anonymous identities for users
export const communityProfiles = pgTable('community_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),

  // Anonymous identity
  alias: text('alias').notNull(), // e.g., "Anonymous Nurse #1234"
  avatarColor: text('avatar_color').notNull(), // For consistent anonymous avatar
  bio: text('bio'),

  // Expertise and reputation
  expertise: jsonb('expertise').$type<string[]>().default([]), // ['scheduling', 'team-management', 'nursing']
  reputationScore: integer('reputation_score').notNull().default(0),
  isVerifiedProfessional: boolean('is_verified_professional').notNull().default(false),

  // Settings
  messageSettings: jsonb('message_settings').$type<{
    acceptMessages?: boolean;
    notifyOnMessage?: boolean;
    notifyOnReply?: boolean;
  }>().default({
    acceptMessages: true,
    notifyOnMessage: true,
    notifyOnReply: true,
  }),

  // Activity tracking
  totalPosts: integer('total_posts').notNull().default(0),
  totalComments: integer('total_comments').notNull().default(0),
  helpfulVotes: integer('helpful_votes').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
}, (table) => ({
  userIdx: uniqueIndex('community_profiles_user_id_idx').on(table.userId),
  aliasIdx: index('community_profiles_alias_idx').on(table.alias),
}));

// Community Posts - Forum posts
export const communityPosts = pgTable('community_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Content
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(), // 'career', 'transition', 'advice', 'general', 'tips'
  tags: jsonb('tags').$type<string[]>().default([]), // ['nursing', 'schedule', 'work-life-balance']

  // Engagement metrics
  viewCount: integer('view_count').notNull().default(0),
  upvotes: integer('upvotes').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),

  // Moderation
  isPinned: boolean('is_pinned').notNull().default(false),
  isLocked: boolean('is_locked').notNull().default(false), // No new comments allowed
  isHidden: boolean('is_hidden').notNull().default(false), // Hidden by moderator
  moderationNotes: text('moderation_notes'),

  // Edit tracking
  editedAt: timestamp('edited_at', { withTimezone: true }),
  editCount: integer('edit_count').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete
}, (table) => ({
  authorIdx: index('community_posts_author_id_idx').on(table.authorId),
  categoryIdx: index('community_posts_category_idx').on(table.category),
  createdAtIdx: index('community_posts_created_at_idx').on(table.createdAt),
  deletedAtIdx: index('community_posts_deleted_at_idx').on(table.deletedAt),
  pinnedIdx: index('community_posts_pinned_idx').on(table.isPinned),
}));

// Community Comments - Comments on posts
export const communityComments = pgTable('community_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => communityPosts.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Content
  content: text('content').notNull(),

  // Threading
  parentCommentId: uuid('parent_comment_id').references((): any => communityComments.id, { onDelete: 'cascade' }),
  depth: integer('depth').notNull().default(0), // 0 for top-level, 1 for replies, etc.

  // Engagement
  upvotes: integer('upvotes').notNull().default(0),
  isAcceptedAnswer: boolean('is_accepted_answer').notNull().default(false),

  // Edit tracking
  editedAt: timestamp('edited_at', { withTimezone: true }),
  editCount: integer('edit_count').notNull().default(0),

  // Moderation
  isHidden: boolean('is_hidden').notNull().default(false),
  moderationNotes: text('moderation_notes'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  postIdx: index('community_comments_post_id_idx').on(table.postId),
  authorIdx: index('community_comments_author_id_idx').on(table.authorId),
  parentIdx: index('community_comments_parent_id_idx').on(table.parentCommentId),
  createdAtIdx: index('community_comments_created_at_idx').on(table.createdAt),
}));

// Community Messages - Private messages between users
export const communityMessages = pgTable('community_messages', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Participants
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Threading
  threadId: uuid('thread_id').notNull(), // Groups messages into conversations

  // Content
  subject: text('subject'), // Only for first message in thread
  content: text('content').notNull(),

  // Status
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),

  // Moderation
  isReported: boolean('is_reported').notNull().default(false),
  reportReason: text('report_reason'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  senderIdx: index('community_messages_sender_id_idx').on(table.senderId),
  recipientIdx: index('community_messages_recipient_id_idx').on(table.recipientId),
  threadIdx: index('community_messages_thread_id_idx').on(table.threadId),
  createdAtIdx: index('community_messages_created_at_idx').on(table.createdAt),
  unreadIdx: index('community_messages_unread_idx').on(table.recipientId, table.isRead),
}));

// Community Reactions - Upvotes, helpful marks, etc.
export const communityReactions = pgTable('community_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Target (polymorphic)
  targetType: text('target_type').notNull(), // 'post', 'comment', 'message'
  targetId: uuid('target_id').notNull(),

  // Reaction type
  reactionType: text('reaction_type').notNull(), // 'upvote', 'helpful', 'insightful', 'thanks'

  // Timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('community_reactions_user_id_idx').on(table.userId),
  targetIdx: index('community_reactions_target_idx').on(table.targetType, table.targetId),
  // Ensure one reaction per user per target
  uniqueReaction: uniqueIndex('community_reactions_unique_idx').on(
    table.userId,
    table.targetType,
    table.targetId,
    table.reactionType
  ),
}));

// Community Reports - User reports of inappropriate content
export const communityReports = pgTable('community_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Target (polymorphic)
  targetType: text('target_type').notNull(), // 'post', 'comment', 'message', 'user'
  targetId: uuid('target_id').notNull(),

  // Report details
  reason: text('reason').notNull(), // 'spam', 'harassment', 'inappropriate', 'misinformation', 'other'
  description: text('description'),

  // Resolution
  status: text('status').notNull().default('pending'), // 'pending', 'reviewing', 'resolved', 'dismissed'
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  actionTaken: text('action_taken'), // 'content_removed', 'user_warned', 'user_banned', 'no_action'

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  reporterIdx: index('community_reports_reporter_id_idx').on(table.reporterId),
  targetIdx: index('community_reports_target_idx').on(table.targetType, table.targetId),
  statusIdx: index('community_reports_status_idx').on(table.status),
  createdAtIdx: index('community_reports_created_at_idx').on(table.createdAt),
}));

// Community Bans - Banned users from community
export const communityBans = pgTable('community_bans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),

  // Ban details
  reason: text('reason').notNull(),
  bannedBy: uuid('banned_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // null = permanent ban

  // Appeal
  appealReason: text('appeal_reason'),
  appealedAt: timestamp('appealed_at', { withTimezone: true }),
  appealReviewedBy: uuid('appeal_reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  appealReviewedAt: timestamp('appeal_reviewed_at', { withTimezone: true }),
  appealStatus: text('appeal_status'), // 'pending', 'approved', 'denied'

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdx: uniqueIndex('community_bans_user_id_idx').on(table.userId),
  expiresAtIdx: index('community_bans_expires_at_idx').on(table.expiresAt),
}));

// Relations
export const communityProfilesRelations = relations(communityProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [communityProfiles.userId],
    references: [users.id],
  }),
  posts: many(communityPosts),
  comments: many(communityComments),
  sentMessages: many(communityMessages, { relationName: 'sentMessages' }),
  receivedMessages: many(communityMessages, { relationName: 'receivedMessages' }),
  reactions: many(communityReactions),
  reports: many(communityReports),
}));

export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [communityPosts.authorId],
    references: [users.id],
  }),
  authorProfile: one(communityProfiles, {
    fields: [communityPosts.authorId],
    references: [communityProfiles.userId],
  }),
  comments: many(communityComments),
  reactions: many(communityReactions),
}));

export const communityCommentsRelations = relations(communityComments, ({ one, many }) => ({
  post: one(communityPosts, {
    fields: [communityComments.postId],
    references: [communityPosts.id],
  }),
  author: one(users, {
    fields: [communityComments.authorId],
    references: [users.id],
  }),
  authorProfile: one(communityProfiles, {
    fields: [communityComments.authorId],
    references: [communityProfiles.userId],
  }),
  parentComment: one(communityComments, {
    fields: [communityComments.parentCommentId],
    references: [communityComments.id],
    relationName: 'parentComment',
  }),
  childComments: many(communityComments, { relationName: 'parentComment' }),
  reactions: many(communityReactions),
}));

export const communityMessagesRelations = relations(communityMessages, ({ one }) => ({
  sender: one(users, {
    fields: [communityMessages.senderId],
    references: [users.id],
    relationName: 'sentMessages',
  }),
  senderProfile: one(communityProfiles, {
    fields: [communityMessages.senderId],
    references: [communityProfiles.userId],
    relationName: 'sentMessages',
  }),
  recipient: one(users, {
    fields: [communityMessages.recipientId],
    references: [users.id],
    relationName: 'receivedMessages',
  }),
  recipientProfile: one(communityProfiles, {
    fields: [communityMessages.recipientId],
    references: [communityProfiles.userId],
    relationName: 'receivedMessages',
  }),
}));

export const communityReactionsRelations = relations(communityReactions, ({ one }) => ({
  user: one(users, {
    fields: [communityReactions.userId],
    references: [users.id],
  }),
  userProfile: one(communityProfiles, {
    fields: [communityReactions.userId],
    references: [communityProfiles.userId],
  }),
}));

export const communityReportsRelations = relations(communityReports, ({ one }) => ({
  reporter: one(users, {
    fields: [communityReports.reporterId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [communityReports.resolvedBy],
    references: [users.id],
  }),
}));

export const communityBansRelations = relations(communityBans, ({ one }) => ({
  user: one(users, {
    fields: [communityBans.userId],
    references: [users.id],
  }),
  bannedByUser: one(users, {
    fields: [communityBans.bannedBy],
    references: [users.id],
  }),
  appealReviewer: one(users, {
    fields: [communityBans.appealReviewedBy],
    references: [users.id],
  }),
}));

// Type exports
export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type NewCommunityProfile = typeof communityProfiles.$inferInsert;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type NewCommunityPost = typeof communityPosts.$inferInsert;
export type CommunityComment = typeof communityComments.$inferSelect;
export type NewCommunityComment = typeof communityComments.$inferInsert;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type NewCommunityMessage = typeof communityMessages.$inferInsert;
export type CommunityReaction = typeof communityReactions.$inferSelect;
export type NewCommunityReaction = typeof communityReactions.$inferInsert;
export type CommunityReport = typeof communityReports.$inferSelect;
export type NewCommunityReport = typeof communityReports.$inferInsert;
export type CommunityBan = typeof communityBans.$inferSelect;
export type NewCommunityBan = typeof communityBans.$inferInsert;