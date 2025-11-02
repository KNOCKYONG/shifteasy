-- Create handoffs table (간호사 인수인계)
CREATE TABLE "handoffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
  "shift_date" timestamp with time zone NOT NULL,
  "shift_type" text NOT NULL,
  "handover_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "receiver_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "started_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "completed_at" timestamp with time zone,
  "duration" integer,
  "overall_notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- Create handoff_items table (환자별 인수인계 항목)
CREATE TABLE "handoff_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "handoff_id" uuid NOT NULL REFERENCES "handoffs"("id") ON DELETE CASCADE,
  "patient_identifier" text NOT NULL,
  "room_number" text NOT NULL,
  "bed_number" text,
  "priority" text NOT NULL DEFAULT 'medium',
  "situation" text NOT NULL,
  "background" text NOT NULL,
  "assessment" text NOT NULL,
  "recommendation" text NOT NULL,
  "vital_signs" jsonb,
  "medications" jsonb,
  "scheduled_procedures" jsonb,
  "alerts" jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone,
  "questions" jsonb,
  "attachments" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- Create handoff_templates table (인수인계 템플릿)
CREATE TABLE "handoff_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "department_id" uuid REFERENCES "departments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_default" text NOT NULL DEFAULT 'false',
  "category" text,
  "config" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- Create indexes for handoffs table
CREATE INDEX "handoffs_tenant_id_idx" ON "handoffs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "handoffs_department_id_idx" ON "handoffs" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "handoffs_shift_date_idx" ON "handoffs" USING btree ("shift_date");--> statement-breakpoint
CREATE INDEX "handoffs_status_idx" ON "handoffs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "handoffs_handover_user_id_idx" ON "handoffs" USING btree ("handover_user_id");--> statement-breakpoint
CREATE INDEX "handoffs_receiver_user_id_idx" ON "handoffs" USING btree ("receiver_user_id");--> statement-breakpoint

-- Create indexes for handoff_items table
CREATE INDEX "handoff_items_handoff_id_idx" ON "handoff_items" USING btree ("handoff_id");--> statement-breakpoint
CREATE INDEX "handoff_items_priority_idx" ON "handoff_items" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "handoff_items_status_idx" ON "handoff_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "handoff_items_room_number_idx" ON "handoff_items" USING btree ("room_number");--> statement-breakpoint

-- Create indexes for handoff_templates table
CREATE INDEX "handoff_templates_tenant_id_idx" ON "handoff_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "handoff_templates_department_id_idx" ON "handoff_templates" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "handoff_templates_is_default_idx" ON "handoff_templates" USING btree ("is_default");--> statement-breakpoint

-- Insert default templates
INSERT INTO "handoff_templates" ("id", "tenant_id", "name", "description", "is_default", "category", "config") VALUES
('00000000-0000-0000-0000-000000000001', '3760b5ec-462f-443c-9a90-4a2b2e295e9d', '일반 병동 템플릿', '일반 병동 표준 인수인계 템플릿', 'true', 'ward',
'{"quickPhrases": [
  {"category": "상황", "phrases": ["안정 상태", "주의 관찰 필요", "통증 호소", "수액 주입 중", "산소 공급 중"]},
  {"category": "처치", "phrases": ["활력징후 측정", "투약 예정", "검사 예정", "금식", "침상 안정"]}
], "checklistItems": ["환자 상태 확인", "투약 일정 확인", "검사 일정 확인", "낙상 위험도 확인", "통증 평가"],
"priorityGuidelines": {
  "critical": "생명 위협적 상황 또는 즉각적인 조치 필요",
  "high": "면밀한 관찰 필요, 상태 변화 가능성",
  "medium": "일반적 관찰 및 간호 제공",
  "low": "안정 상태, 퇴원 예정"
}}'::jsonb
);
