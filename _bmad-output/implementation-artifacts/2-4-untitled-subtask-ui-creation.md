# Story 2.4: Untitled Subtask UI Creation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my subtask to be created as "Untitled Subtask" immediately,
so that it follows the same pattern as regular tasks.

## Acceptance Criteria

1. **Given** I click the "+ create subtask" button
2. **When** the subtask is created in the database
3. **Then** it should appear instantly in the sidebar as "Untitled Subtask"
4. **And** if an untitled subtask already exists for that parent, that existing task should be selected instead of creating a new one

## Tasks / Subtasks

- [x] Ensure subtask creation uses "Untitled Subtask" as default title (AC: 3)
  - [x] Update `createNewTask` in `src/main/project/project.ts` to set default name for subtasks
- [x] Implement localized display for untitled subtasks (AC: 3)
  - [x] Add `untitledSubtask` to `en.json` and `zh.json`
  - [x] Update `TaskSidebar.tsx` to use localized string for "Untitled Subtask" name
- [x] Verify duplicate empty subtask prevention (AC: 4)
  - [x] Logic already exists in `Project.ts` and `ProjectView.tsx`

## Dev Notes

- **Architecture Compliance:**
  - Uses `parentId` relational model.
  - Localized strings follow existing i18n patterns.
- **Source Tree Components:**
  - `src/main/project/project.ts`: Creation logic and duplicate prevention.
  * `src/renderer/src/components/project/TaskSidebar.tsx`: Hierarchical rendering and localized display.
- **Testing Standards:**
  - Verify subtask creation shows "Untitled Subtask" (or localized version).
  - Verify clicking "+" on parent with existing empty subtask focuses the existing one.

### Project Structure Notes

- Alignment with unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR13, FR14]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
- src/main/project/project.ts
- src/renderer/src/components/project/TaskSidebar.tsx
- src/common/locales/en.json
- src/common/locales/zh.json
