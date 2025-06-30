# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
AiderDesk is an Electron desktop application that provides a modern GUI for Aider, the command-line AI coding assistant. It wraps the Aider CLI tool in a cross-platform desktop interface with enhanced features like IDE integration, project management, and a rich UI.

## Architecture
- **Electron Application**: Multi-process architecture with main and renderer processes
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Electron main process with Node.js
- **State Management**: React Context API
- **IPC Communication**: Electron IPC for process communication
- **AI Integration**: Multiple providers (OpenAI, Anthropic, Gemini, Groq, etc.)
- **IDE Connectors**: Plugin system for IntelliJ and VSCode
- **MCP Support**: Model Context Protocol server integration

## Build Commands
- Development: `npm run dev`
- Build All Platforms: `npm run build`
- Build Windows: `npm run build:win`
- Build macOS: `npm run build:mac`
- Build Linux: `npm run build:linux`
- Type Check: `npm run typecheck`
- Lint: `npm run lint`
- Format Check: `npm run format`
- Format Fix: `npm run format:fix`
- Preview: `npm run preview`
- Test: `npm run test` (vitest)

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, explicit return types preferred
- **React**: Functional components with hooks only
- **Imports**: Organized by type with consistent ordering
- **Formatting**: 
  - 2-space indentation
  - Single quotes for strings
  - No semicolons
  - Trailing commas in multi-line structures
  - 100 character line width
- **Naming**: 
  - camelCase for variables/functions
  - PascalCase for components/types/interfaces
  - UPPER_SNAKE_CASE for constants
- **File Organization**: One component per file, co-locate related files

## Project Structure
```
src/
├── main/              # Electron main process
│   ├── agent/         # AI agent functionality
│   ├── aider/         # Aider CLI integration
│   ├── store/         # Persistent data storage
│   ├── utils/         # Main process utilities
│   └── index.ts       # Main entry point
├── renderer/          # React application
│   ├── components/    # Reusable UI components
│   ├── context/       # React contexts
│   ├── hooks/         # Custom React hooks
│   ├── pages/         # Page components
│   └── App.tsx        # Root component
├── preload/           # Electron preload scripts
├── mcp-server/        # MCP server implementation
└── common/            # Shared types and utilities
```

## Key Technologies & Dependencies
- **Electron**: v33.2.1 - Desktop application framework
- **React**: v18.3.1 - UI framework
- **Vite**: v6.0.1 - Build tool
- **electron-vite**: v2.3.0 - Electron-specific Vite config
- **Tailwind CSS**: v3.4.17 - Utility-first CSS
- **better-sqlite3**: v11.6.0 - Local database
- **simple-git**: v3.27.0 - Git operations
- **socket.io**: v4.8.1 - IDE connector communication
- **AI SDKs**: Multiple providers (@ai-sdk/openai, @ai-sdk/anthropic, etc.)

## Development Notes
- **Environment Variables**: Stored in `.env` files, managed via electron-store
- **Hot Reload**: Enabled in development mode for both main and renderer
- **Code Signing**: Configured for macOS via electron-builder
- **Auto-Updates**: Integrated via electron-updater
- **Multi-Platform**: Builds for Windows, macOS (Intel & Apple Silicon), and Linux

## Testing
- Framework: vitest (configured but no tests currently implemented)
- Run tests: `npm run test`
- Test file pattern: `*.test.ts` or `*.spec.ts`

## Important Patterns
1. **IPC Handlers**: All main process functionality exposed via `ipcMain.handle()`
2. **Context Pattern**: AppContext provides global state management
3. **Service Classes**: Singleton managers for different domains (ProjectManager, SessionManager)
4. **Error Handling**: Consistent error boundaries and IPC error propagation
5. **Type Safety**: Shared types in `/src/common/types/`

## Common Tasks
- **Adding a new IPC handler**: Add to `src/preload/index.ts` and implement in `src/main/`
- **Creating a component**: Add to `src/renderer/components/` with TypeScript types
- **Adding a new AI provider**: Extend providers in `src/main/providers/`
- **Modifying build**: Update `electron-builder.yml` and `electron.vite.config.ts`
- **Adding MCP tools**: Implement in `src/mcp-server/`