---
title: "Task Management"
sidebar_label: "Tasks"
---

# Task Management

AiderDesk's task management system provides a comprehensive way to organize, track, and manage your AI-assisted development work. Tasks have evolved from the previous sessions system to offer enhanced capabilities including cost tracking, Git worktree integration, and built-in todo management.

## What are Tasks?

A task represents a complete unit of work that includes:

- **Chat History**: All conversations and AI interactions
- **Context Files**: The files currently in the AI's context
- **Cost Tracking**: Per-task costs for both Aider and Agent usage
- **Metadata**: Creation/update timestamps, working mode, and more
- **Todo Items**: Built-in checklist for tracking subtasks
- **Worktree Integration**: Optional isolated Git worktree for safe experimentation

## Task Organization

Tasks are organized per project in the `.aider-desk/tasks/` directory. Each task has its own folder with:

```
.aider-desk/tasks/{taskId}/
├── settings.json    # Task metadata and configuration
├── context.json     # Messages and files context
└── todos.json       # Todo items for the task
```

### Task Sidebar

The **Task Sidebar** on the left side of the project view provides easy access to all your tasks:

- **Task List**: All tasks sorted by last update time
- **Status Indicators**: Shows processing state with spinners and question marks
- **Quick Actions**: Create, rename, delete, and duplicate tasks
- **Collapsible Interface**: Can be collapsed to save screen space

## Working Modes

Tasks support two working modes:

### Local Mode
Work directly in your main project directory. This is the default mode and is suitable for most development work.

### Worktree Mode
Create an isolated Git worktree for safe experimentation:

- **Complete Isolation**: Work doesn't affect your main branch
- **Safe Experimentation**: Try out ideas without risk
- **Easy Integration**: Merge changes back when ready
- **Revert Support**: Built-in revert functionality

## Task Management Features

### Creating Tasks
- **Automatic Creation**: Tasks are created automatically when you start a new conversation
- **Manual Creation**: Use the "New Task" button in the Task Sidebar
- **Smart Naming**: Tasks are automatically named based on your first prompt, or you can name them manually

### Task Operations
- **Rename**: Change the task name at any time
- **Duplicate**: Create a complete copy of a task including all state
- **Delete**: Remove tasks with confirmation
- **Export**: Export tasks as Markdown or images

### Task States
Tasks track various timestamps and states:
- **Created**: When the task was first created
- **Started**: When work on the task began
- **Updated**: Last time the task was modified
- **Completed**: When the task was marked as finished

## Cost Tracking

Each task independently tracks costs for both AI systems:

- **Aider Costs**: Token usage and costs for direct Aider interactions
- **Agent Costs**: Token usage and costs for Agent mode operations
- **Real-time Updates**: Costs are updated as you work
- **Persistent Storage**: Cost data is saved with the task

## Todo Management

Tasks include a built-in todo system for breaking down complex work:

### The Todo Window
A floating window appears when todos are present, providing:
- **Real-time View**: See all todos and their completion status
- **Manual Control**: Check/uncheck items to guide the work
- **Edit Capabilities**: Add, edit, or delete todo items
- **Agent Integration**: Agents can automatically manage todos

### Agent Todo Tools
When using Agent Mode, the AI can:
- **Set Items**: Create or overwrite the todo list with a plan
- **Get Items**: Read the current todo state
- **Update Completion**: Mark items as complete/incomplete
- **Clear Items**: Remove all todos when starting fresh

## Advanced Features

### Task Duplication
Create complete copies of tasks including:
- All chat messages and context
- Todo items and their completion state
- Cost tracking data
- Worktree configuration

### Export Options
- **Markdown Export**: Save the entire conversation as a formatted markdown file
- **Image Export**: Capture the task view as a PNG image
- **Context Preservation**: Maintains formatting and structure in exports

### Integration with Other Features
- **Git Worktrees**: Seamlessly works with isolated development environments
- **Agent Mode**: Enhanced capabilities when using AI agents
- **IDE Connectors**: Automatic context file management via IDE plugins
- **Custom Commands**: Task-aware command execution

## Best Practices

### Task Organization
- **Descriptive Names**: Use clear, descriptive names for your tasks
- **Focused Work**: Keep each task focused on a specific feature or bug fix
- **Regular Cleanup**: Delete completed tasks to keep your workspace organized

### Working with Worktrees
- **Experiment Freely**: Use worktree mode for risky experimental changes
- **Feature Isolation**: Create separate worktrees for different features
- **Safe Merging**: Use the built-in merge and revert functionality

### Cost Management
- **Monitor Costs**: Keep an eye on per-task costs to stay within budget
- **Compare Performance**: Use cost data to compare different approaches
- **Optimize Prompts**: Refine prompts based on cost-effectiveness

Tasks provide a powerful, flexible foundation for managing your AI-assisted development work, offering significant improvements over the previous sessions system while maintaining backward compatibility.
