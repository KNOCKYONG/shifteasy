---
name: vercel-build-validator
description: Automatically runs Vercel build after every task completion to catch build errors early and ensure deployment readiness
---

# Vercel Build Validator Skill

## Core Workflow Philosophy
This skill implements automatic build validation:
- **Build on Completion**: Every task ends with a build check
- **Early Error Detection**: Catch build issues before deployment
- **Type Safety**: Ensure TypeScript compilation passes
- **Deployment Ready**: Verify production build succeeds

## Phase 1: Task Completion Detection
After completing any task that modifies code:
1. Check if files were modified (Edit, Write tools used)
2. Identify if changes affect build output:
   - TypeScript/JavaScript files
   - Component files
   - Configuration files
   - Dependency changes

## Phase 2: Pre-Build Validation
Before running build:
1. Check if `package.json` exists
2. Verify `build` script is configured
3. Ensure dependencies are installed
4. Check for obvious syntax errors

## Phase 3: Build Execution
Run Vercel build command:
```bash
npm run build
```

Expected behaviors:
- **Success (exit 0)**: Build passed, proceed to summary
- **Failure (non-zero exit)**: Capture errors, analyze issues

## Phase 4: Error Analysis
If build fails:
1. Parse error output to identify:
   - TypeScript type errors
   - Import/export issues
   - Missing dependencies
   - Configuration problems
   - Next.js specific errors
2. Categorize errors by severity:
   - **Critical**: Blocks deployment
   - **Warning**: Should be fixed
   - **Info**: Optional improvements

## Phase 5: Automatic Fix Attempt
For common errors, attempt automatic fixes:

### TypeScript Type Errors
- Missing type definitions
- Import statement issues
- Type compatibility problems

### Next.js Errors
- Invalid use of hooks
- Server/Client component misuse
- Dynamic import issues

### Dependency Issues
- Missing packages
- Version conflicts

## Phase 6: Report and Resolution
After build attempt:
1. Report build status to user
2. If failed:
   - List all errors with file locations
   - Explain root causes
   - Suggest fixes or apply automatic corrections
   - Ask user via `AskUserQuestion`: "Should I attempt to fix these errors?"
3. If successful:
   - Confirm deployment readiness
   - Report build time and bundle size

## Phase 7: Fix and Rebuild Cycle
If user approves fixes:
1. Apply corrections using Edit/Write tools
2. Re-run build: `npm run build`
3. Verify fixes resolved issues
4. Repeat until build succeeds or manual intervention needed

## Integration with Task Workflow

### Before Task Completion
```
Implement changes → Test locally → Run build validation →
Report status → Fix if needed → Mark task complete
```

### Task Completion Checklist
- [ ] Code changes implemented
- [ ] Local functionality verified
- [ ] Build validation passed
- [ ] No TypeScript errors
- [ ] No deployment blockers
- [ ] Task marked complete

## Build Validation Triggers

### Always Validate
- Component file changes (`.tsx`, `.jsx`)
- Page file modifications
- API route changes
- Configuration updates (`next.config.js`, `tsconfig.json`)
- Dependency modifications (`package.json`)

### Optional Validation
- Documentation changes (`.md`)
- Style-only changes (`.css`, Tailwind classes)
- Test file updates (`.test.ts`)

## Command Reference

| Phase | Command | Purpose |
|-------|---------|---------|
| Check build | `npm run build` | Verify production build |
| Type check | `npx tsc --noEmit` | Validate TypeScript only |
| Lint | `npm run lint` | Check code quality |
| Quick check | `npm run build 2>&1 \| head -50` | Fast error preview |

## Error Handling Strategies

### TypeScript Errors
```bash
# Capture type errors
npx tsc --noEmit
```
Fix strategy:
1. Add missing type definitions
2. Fix import statements
3. Add type annotations
4. Update interface definitions

### Next.js Build Errors
```bash
# Full build with detailed output
npm run build
```
Fix strategy:
1. Check for server/client component issues
2. Verify dynamic imports
3. Fix hook usage violations
4. Resolve middleware problems

### Dependency Issues
```bash
# Reinstall dependencies if needed
rm -rf node_modules .next
npm install
npm run build
```

## Best Practices

### Do's
- ✅ Always run build after code changes
- ✅ Fix errors immediately when found
- ✅ Check both type errors and build errors
- ✅ Test in production mode (`npm run build`)
- ✅ Report all errors with file locations
- ✅ Suggest or apply automatic fixes

### Don'ts
- ❌ Skip build validation for "small" changes
- ❌ Mark task complete with build errors
- ❌ Ignore TypeScript warnings
- ❌ Proceed to deployment with failed builds
- ❌ Hide build errors from user

## Success Criteria

A task is only complete when:
1. All code changes are implemented
2. `npm run build` succeeds (exit code 0)
3. No TypeScript errors (`tsc --noEmit` passes)
4. No Next.js compilation errors
5. Build output is deployment-ready

## Reporting Format

### Success Report
```
✅ Build Validation Passed

Build time: 45.2s
Bundle size: 1.2 MB
TypeScript: No errors
Next.js: Compiled successfully

Task is ready for deployment.
```

### Failure Report
```
❌ Build Validation Failed

Found 3 errors:

1. src/app/schedule/page.tsx:45
   Error: Type 'string' is not assignable to type 'number'
   Fix: Update type annotation

2. src/components/schedule/ShiftCell.tsx:12
   Error: 'useSearchParams' cannot be used in Server Components
   Fix: Add 'use client' directive

3. Missing dependency: date-fns
   Fix: Run 'npm install date-fns'

Should I attempt to fix these errors? [Yes/No]
```

## Integration with Existing Skills

This skill complements:
- **codex-claude-loop**: Add build validation before Codex review
- **i18n workflow**: Validate translations don't break build
- **component creation**: Verify new components compile

## Performance Optimization

### Fast Validation
For quick checks during iteration:
```bash
# Type check only (faster)
npx tsc --noEmit
```

### Full Validation
Before marking task complete:
```bash
# Full production build
npm run build
```

### Cached Builds
Leverage Next.js build cache:
- Only rebuild changed files
- Faster iteration cycles
- Full validation still required

## The Perfect Validation Loop

```
Code Change → Type Check (fast) → Continue Development →
Task Complete? → Full Build → Fix Errors → Rebuild →
Success? → Mark Complete : Continue Fixing
```

This ensures:
- **No broken deployments**: Build tested before completion
- **Fast feedback**: Catch errors immediately
- **Deployment confidence**: Production build verified
- **Type safety**: TypeScript errors caught early

## Emergency Bypass

If build validation must be skipped (rare cases):
1. Document reason clearly
2. Create follow-up task for build fix
3. Add TODO comment in code
4. Notify user of deployment risk

**Use only when:**
- Build infrastructure is broken
- External dependency issues
- Time-critical hotfix needed
- User explicitly requests bypass
