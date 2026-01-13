# Story 2.3: Hover Action for Subtask Creation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a "+ create subtask" button when I hover over a task,
so that I can quickly add subtasks without diving into menus.

## Acceptance Criteria

1. **Given** I hover my mouse over a parent task in the sidebar
2. **When** the hover actions appear
3. **Then** a "+ create subtask" button should be visible (replacing the Pin button)
4. **And** clicking it should trigger the task creation logic for a subtask
5. **And** the subtask should be linked to the hovered parent task via `parentId`
6. **And** the system should prevent creating multiple empty subtasks for the same parent (focus existing instead)

## Tasks / Subtasks

- [x] Update `TaskSidebar.tsx` to handle subtask creation trigger (AC: 1-5)
  - [x] Implement `handleCreateSubtask` function
  - [x] Integrate with `createNewTask` (or equivalent) passing the `parentId`
  - [x] Ensure the UI responds by expanding the parent and focusing the new subtask
- [x] Implement duplicate empty subtask prevention (AC: 6)
  - [x] Add logic to check for existing empty subtasks with the same `parentId` before calling the creation handler
  - [x] If found, select/focus the existing one instead of creating a new one
- [x] Refine hover button UI (AC: 3)
  - [x] Ensure consistent styling with other hover actions
  - [x] Add appropriate tooltip: "Create Subtask"

## Dev Notes

- **Previous Story Intelligence (2.2):**
  - Hover actions were updated to move Pin to the menu and add the Plus button.
  - Indentation and connector lines are now in place.
  - `expandedTaskIds` state is managed in `TaskSidebar.tsx`.
- **Architecture Compliance:**
  - Automated worktree inheritance is handled in the main process (Story 1.3).
  - Prevention of duplicate empty subtasks is a functional requirement (FR14).
- **Source Tree Components:**
  - `src/renderer/src/components/project/TaskSidebar.tsx`: Primary location for hover logic and creation trigger.
  - `src/renderer/src/stores/taskStore.ts`: Check if creation logic needs updates for `parentId`.
- **Testing Standards:**
  - Verify that clicking the Plus button creates a subtask with the correct `parentId`.
  - Verify that clicking Plus when an empty subtask exists focuses the existing one.

### Project Structure Notes

- Alignment with unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR14]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Experience Mechanics]

## Dev Agent Record

### Agent Model Used

Amelia (Developer Agent)

### Debug Log References

- Implemented automatic expansion of parent tasks in `TaskSidebar.tsx` when a subtask becomes active.
- Verified `createNewTask` in `ProjectView.tsx` correctly handles `parentId` and prevents duplicate empty subtasks.
- Verified hover button styling and tooltips in `TaskSidebar.tsx`.

### Completion Notes List

- Added `useEffect` in `TaskSidebar.tsx` to automatically expand parents of `activeTaskId`.
- Verified that clicking the `+` button in the sidebar triggers subtask creation with the correct `parentId`.
- Confirmed that trying to create a second empty subtask for the same parent focuses the existing one instead.
- Added unit tests in `src/renderer/src/components/project/__tests__/TaskSidebarSubtasks.test.tsx`.

### File List

- `src/renderer/src/components/project/TaskSidebar.tsx`
- `src/renderer/src/components/project/__tests__/TaskSidebarSubtasks.test.tsx`
