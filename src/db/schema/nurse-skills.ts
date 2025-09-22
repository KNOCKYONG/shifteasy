/**
 * Nurse Skill Matrix Schema
 * 간호사 스킬 매트릭스 스키마
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './tenants';

// ==========================================
// Skill Categories (스킬 카테고리)
// ==========================================

export const skillCategories = pgTable('skill_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(), // 예: 'Clinical Skills', 'Certifications', 'Specialties'
  description: text('description'),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('skill_categories_tenant_idx').on(table.tenantId),
}));

// ==========================================
// Skills (스킬 정의)
// ==========================================

export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  categoryId: uuid('category_id').references(() => skillCategories.id),
  code: text('code').notNull(), // 예: 'BLS', 'ACLS', 'IV_THERAPY'
  name: text('name').notNull(), // 예: 'Basic Life Support'
  description: text('description'),
  
  // Skill metadata
  skillType: text('skill_type').notNull(), // 'certification', 'clinical', 'specialty', 'language'
  requiredForUnit: jsonb('required_for_unit').$type<string[]>(), // ['ICU', 'ER']
  
  // Certification specific fields
  requiresRenewal: boolean('requires_renewal').default(false),
  renewalPeriodMonths: integer('renewal_period_months'), // 예: 24 for BLS
  
  // Proficiency levels
  hasProficiencyLevels: boolean('has_proficiency_levels').default(true),
  proficiencyLevels: jsonb('proficiency_levels').$type<string[]>(), // ['beginner', 'intermediate', 'advanced', 'expert']
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('skills_tenant_idx').on(table.tenantId),
  categoryIdx: index('skills_category_idx').on(table.categoryId),
  codeIdx: index('skills_code_idx').on(table.tenantId, table.code),
}));

// ==========================================
// Nurse Skills (간호사별 스킬)
// ==========================================

export const nurseSkills = pgTable('nurse_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  skillId: uuid('skill_id').notNull().references(() => skills.id),
  
  // Proficiency and validation
  proficiencyLevel: text('proficiency_level'), // 'beginner', 'intermediate', 'advanced', 'expert'
  proficiencyScore: integer('proficiency_score'), // 1-100
  
  // Certification tracking
  certificationDate: timestamp('certification_date'),
  expirationDate: timestamp('expiration_date'),
  certificationNumber: text('certification_number'),
  issuingAuthority: text('issuing_authority'),
  
  // Validation and verification
  isVerified: boolean('is_verified').default(false),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  verificationNotes: text('verification_notes'),
  
  // Training and experience
  hoursOfExperience: integer('hours_of_experience'),
  lastUsedDate: timestamp('last_used_date'),
  frequencyOfUse: text('frequency_of_use'), // 'daily', 'weekly', 'monthly', 'rarely'
  
  // Status
  status: text('status').default('active'), // 'active', 'expired', 'pending_renewal', 'suspended'
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseSkillIdx: index('nurse_skills_idx').on(table.nurseId, table.skillId),
  tenantIdx: index('nurse_skills_tenant_idx').on(table.tenantId),
  expirationIdx: index('nurse_skills_expiration_idx').on(table.expirationDate),
  statusIdx: index('nurse_skills_status_idx').on(table.status),
}));

// ==========================================
// Skill Requirements (부서별 필수 스킬)
// ==========================================

export const unitSkillRequirements = pgTable('unit_skill_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  unitType: text('unit_type').notNull(), // 'ICU', 'ER', 'OR', etc.
  shiftType: text('shift_type'), // 'D', 'E', 'N' - null means all shifts
  
  skillId: uuid('skill_id').notNull().references(() => skills.id),
  
  // Requirement specifications
  isRequired: boolean('is_required').default(true), // true = required, false = preferred
  minimumProficiency: text('minimum_proficiency'), // 'intermediate', 'advanced', etc.
  minimumNursesPerShift: integer('minimum_nurses_per_shift').default(1),
  
  // Ratio requirements
  ratioType: text('ratio_type'), // 'percentage', 'count'
  ratioValue: integer('ratio_value'), // 예: 30 (30% of nurses) or 2 (2 nurses)
  
  priority: integer('priority').default(1), // 1 = highest priority
  
  effectiveFrom: timestamp('effective_from').defaultNow(),
  effectiveTo: timestamp('effective_to'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  unitRequirementIdx: index('unit_skill_req_idx').on(table.unitType, table.shiftType),
  tenantIdx: index('unit_skill_req_tenant_idx').on(table.tenantId),
}));

// ==========================================
// Skill Training Records (스킬 교육 기록)
// ==========================================

export const skillTrainingRecords = pgTable('skill_training_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  skillId: uuid('skill_id').notNull().references(() => skills.id),
  
  // Training details
  trainingType: text('training_type').notNull(), // 'initial', 'renewal', 'advanced', 'refresher'
  trainingDate: timestamp('training_date').notNull(),
  completionDate: timestamp('completion_date'),
  
  // Instructor and facility
  instructorName: text('instructor_name'),
  instructorId: uuid('instructor_id').references(() => users.id),
  trainingFacility: text('training_facility'),
  
  // Results
  passed: boolean('passed'),
  score: integer('score'), // 0-100
  certificateIssued: boolean('certificate_issued').default(false),
  certificateNumber: text('certificate_number'),
  
  // Training hours
  theoryHours: integer('theory_hours'),
  practicalHours: integer('practical_hours'),
  totalHours: integer('total_hours'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseTrainingIdx: index('skill_training_nurse_idx').on(table.nurseId),
  dateIdx: index('skill_training_date_idx').on(table.trainingDate),
}));

// ==========================================
// Skill Assessment History (스킬 평가 이력)
// ==========================================

export const skillAssessments = pgTable('skill_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  skillId: uuid('skill_id').notNull().references(() => skills.id),
  
  // Assessment details
  assessmentDate: timestamp('assessment_date').notNull(),
  assessorId: uuid('assessor_id').notNull().references(() => users.id),
  assessmentType: text('assessment_type').notNull(), // 'annual', 'competency', 'peer', 'self'
  
  // Scores and ratings
  previousLevel: text('previous_level'),
  assessedLevel: text('assessed_level'),
  score: integer('score'), // 0-100
  
  // Detailed evaluation
  theoreticalKnowledge: integer('theoretical_knowledge'), // 0-100
  practicalSkills: integer('practical_skills'), // 0-100
  criticalThinking: integer('critical_thinking'), // 0-100
  communication: integer('communication'), // 0-100
  
  // Recommendations
  recommendedForAdvancement: boolean('recommended_for_advancement').default(false),
  requiresImprovement: boolean('requires_improvement').default(false),
  improvementAreas: jsonb('improvement_areas').$type<string[]>(),
  
  comments: text('comments'),
  nextAssessmentDate: timestamp('next_assessment_date'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseAssessmentIdx: index('skill_assessment_nurse_idx').on(table.nurseId),
  dateIdx: index('skill_assessment_date_idx').on(table.assessmentDate),
}));

// ==========================================
// Preceptor-Orientee Relationships (프리셉터-오리엔티 관계)
// ==========================================

export const preceptorRelationships = pgTable('preceptor_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  preceptorId: uuid('preceptor_id').notNull().references(() => users.id),
  orienteeId: uuid('orientee_id').notNull().references(() => users.id),
  
  // Relationship period
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  status: text('status').default('active'), // 'active', 'completed', 'terminated'
  
  // Program details
  programType: text('program_type'), // 'new_grad', 'transfer', 'return_to_practice'
  unitType: text('unit_type'),
  
  // Progress tracking
  totalShiftsRequired: integer('total_shifts_required'),
  completedShifts: integer('completed_shifts').default(0),
  progressPercentage: integer('progress_percentage').default(0),
  
  // Skills to focus
  focusSkills: jsonb('focus_skills').$type<string[]>(),
  
  // Evaluations
  lastEvaluationDate: timestamp('last_evaluation_date'),
  nextEvaluationDate: timestamp('next_evaluation_date'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  preceptorIdx: index('preceptor_rel_preceptor_idx').on(table.preceptorId),
  orienteeIdx: index('preceptor_rel_orientee_idx').on(table.orienteeId),
  statusIdx: index('preceptor_rel_status_idx').on(table.status),
}));

// ==========================================
// Relations
// ==========================================

export const skillCategoryRelations = relations(skillCategories, ({ many }) => ({
  skills: many(skills),
}));

export const skillRelations = relations(skills, ({ one, many }) => ({
  category: one(skillCategories, {
    fields: [skills.categoryId],
    references: [skillCategories.id],
  }),
  nurseSkills: many(nurseSkills),
  requirements: many(unitSkillRequirements),
  trainingRecords: many(skillTrainingRecords),
  assessments: many(skillAssessments),
}));

export const nurseSkillRelations = relations(nurseSkills, ({ one }) => ({
  nurse: one(users, {
    fields: [nurseSkills.nurseId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [nurseSkills.skillId],
    references: [skills.id],
  }),
  verifier: one(users, {
    fields: [nurseSkills.verifiedBy],
    references: [users.id],
  }),
}));

export const unitSkillRequirementRelations = relations(unitSkillRequirements, ({ one }) => ({
  skill: one(skills, {
    fields: [unitSkillRequirements.skillId],
    references: [skills.id],
  }),
}));

export const trainingRecordRelations = relations(skillTrainingRecords, ({ one }) => ({
  nurse: one(users, {
    fields: [skillTrainingRecords.nurseId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [skillTrainingRecords.skillId],
    references: [skills.id],
  }),
  instructor: one(users, {
    fields: [skillTrainingRecords.instructorId],
    references: [users.id],
  }),
}));

export const assessmentRelations = relations(skillAssessments, ({ one }) => ({
  nurse: one(users, {
    fields: [skillAssessments.nurseId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [skillAssessments.skillId],
    references: [skills.id],
  }),
  assessor: one(users, {
    fields: [skillAssessments.assessorId],
    references: [users.id],
  }),
}));

export const preceptorRelationshipRelations = relations(preceptorRelationships, ({ one }) => ({
  preceptor: one(users, {
    fields: [preceptorRelationships.preceptorId],
    references: [users.id],
  }),
  orientee: one(users, {
    fields: [preceptorRelationships.orienteeId],
    references: [users.id],
  }),
}));