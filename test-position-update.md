# Position Update Feature Test Plan

## Feature Description
Allow tenants (owners/admins) and managers to change a member's position (직급).

## Implementation Summary

### Backend Changes
1. **Added `updatePosition` mutation to `src/server/api/routers/tenant.ts`**
   - Accepts `userId` and `position` parameters
   - Checks if current user has permission (owner, admin, or manager roles)
   - Updates the user's position in the database
   - Returns success status and updated user data

### Frontend Changes
1. **Updated Team Management Page (`src/app/team/page.tsx`)**
   - Added state management for position editing:
     - `editingPositionId`: Tracks which member's position is being edited
     - `editingPositionValue`: Stores the new position value
     - `currentUserRole`: Stores the current user's role (currently hardcoded as "admin" for testing)

   - Added position editing functions:
     - `handleEditPosition()`: Initiates position editing
     - `handleSavePosition()`: Saves the new position
     - `handleCancelEditPosition()`: Cancels editing
     - `canEditPosition()`: Checks if current user can edit positions

   - Updated UI to show inline position editing:
     - Position displays with an edit icon (visible on hover for authorized users)
     - Click edit icon to enter edit mode
     - In edit mode: input field with save/cancel buttons
     - Keyboard support: Enter to save, Escape to cancel

## How to Test

### Prerequisites
1. Ensure the development server is running: `npm run dev`
2. Navigate to http://localhost:3000/team

### Test Steps

1. **Permission Check**
   - The current user role is hardcoded as "admin" for testing
   - Only users with roles: owner, admin, or manager can edit positions

2. **Edit Position**
   - Hover over any team member's position text
   - An edit icon should appear (pencil icon)
   - Click the edit icon
   - The position text changes to an input field
   - Type a new position (e.g., "수간호사", "팀장", "시니어 간호사")
   - Press Enter or click the save icon to save
   - Press Escape or click the X to cancel

3. **Validation**
   - Try to save an empty position - should show alert
   - Save a valid position - should update and refresh the list

## Security Features
- Server-side permission check ensures only authorized users can update positions
- Tenant isolation: Users can only update positions within their own tenant
- Input validation to prevent empty positions

## Future Enhancements
1. Add predefined position dropdown/suggestions
2. Add audit log for position changes
3. Integrate with actual authentication to get real user role
4. Add toast notifications instead of alerts
5. Add position history tracking