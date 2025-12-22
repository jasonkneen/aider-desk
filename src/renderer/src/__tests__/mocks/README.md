# Test Mock Factories

This directory contains centralized mocking utilities for tests in the renderer.

## Available Mocks

### API Mock Factory (`api.ts`)

Comprehensive mock for the ApplicationAPI used throughout the application.

## Usage

### Basic Usage

The `createMockApi` function provides a comprehensive mock of the entire ApplicationAPI with sensible defaults:

```typescript
import { createMockApi } from '@/__tests__/mocks/api';

// Get a complete API mock with default implementations
const mockApi = createMockApi();

// Mock specific methods with custom behavior
const mockApi = createMockApi({
  getOpenProjects: vi.fn(() => Promise.resolve(mockProjects)),
  setActiveProject: vi.fn(() => Promise.resolve()),
});
```

### In Test Files

```typescript
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

// Mock the ApiContext to return our mock API
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

describe('MyComponent', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi({
      // Override specific methods for this test suite
      getOpenProjects: vi.fn(() => Promise.resolve([])),
    });
    
    vi.mocked(useApi).mockReturnValue(mockApi as any);
  });

  it('should handle API calls', async () => {
    // Use mockApi in your tests
    mockApi.getOpenProjects.mockResolvedValue(mockProjects);
    
    render(<MyComponent />);
    
    await waitFor(() => {
      expect(mockApi.getOpenProjects).toHaveBeenCalled();
    });
  });
});
```

### Global Setup

The API mock is also available globally through the setup file, which uses `globalMockApi`:

```typescript
// setup.ts imports and uses the global mock
import { globalMockApi } from './mocks/api';

Object.defineProperty(window, 'api', {
  value: globalMockApi,
  writable: true,
});
```

## Benefits

1. **DRY Principle**: No need to duplicate API mocks across test files
2. **Consistency**: All tests use the same mock structure
3. **Type Safety**: Full TypeScript support with ApplicationAPI interface
4. **Flexibility**: Easy to override specific methods while keeping defaults
5. **Maintenance**: Single place to update mock implementations

## Mock Defaults

The factory provides reasonable default implementations:

- **Promise-based methods**: Return empty arrays, empty objects, or mock data
- **Event listeners**: Return unsubscribe functions (`vi.fn()`)
- **Boolean methods**: Return sensible defaults (e.g., `true` for supported operations)
- **Complex objects**: Return mock objects with required properties

## Test-Specific Overrides

When you need custom behavior for specific tests, provide overrides:

```typescript
const mockApi = createMockApi({
  // Override for specific test scenario
  getOpenProjects: vi.fn()
    .mockResolvedValueOnce([])           // First call returns empty
    .mockResolvedValueOnce([mockProject]) // Second call returns project
    
  // Custom error handling
  startProject: vi.fn().mockRejectedValue(new Error('Start failed')),
  
  // Complex mock implementation
  setActiveProject: vi.fn().mockImplementation(async (baseDir) => {
    // Custom logic for this test
    updatedProjects = projects.map(p => ({ 
      ...p, 
      active: p.baseDir === baseDir 
    }));
    return updatedProjects;
  }),
});
```

## Migration Notes

To migrate existing tests:

1. Replace local API mock objects with `createMockApi()`
2. Remove the large mock object definitions
3. Add test-specific overrides as needed
4. Ensure proper typing with `ReturnType<typeof createMockApi>`

This reduces test file size significantly while maintaining full functionality.

## Context Mock Factories (`contexts.ts`)

Comprehensive mocks for React contexts used throughout the application.

### Task Context Mock

```typescript
import { createMockTaskContext } from '@/__tests__/mocks/contexts';

// Get a complete task context mock with default implementations
const mockTaskContext = createMockTaskContext();

// Override specific methods
const mockTaskContext = createMockTaskContext({
  getTaskState: vi.fn(() => mockTaskState),
  clearSession: vi.fn(),
});
```

### Model Provider Context Mock

```typescript
import { createMockModelProviderContext } from '@/__tests__/mocks/contexts';

// Get a complete model provider context mock
const mockModelProviderContext = createMockModelProviderContext();

// Override specific properties
const mockModelProviderContext = createMockModelProviderContext({
  models: [mockModel],
  modelsLoading: false,
});
```

### Agents Context Mock

```typescript
import { createMockAgentsContext } from '@/__tests__/mocks/contexts';

// Get a complete agents context mock
const mockAgentsContext = createMockAgentsContext();

// Override specific properties
const mockAgentsContext = createMockAgentsContext({
  profiles: [mockProfile],
  loading: true,
});
```

### Responsive Hook Mock

```typescript
import { createMockResponsive } from '@/__tests__/mocks/contexts';

// Get a complete responsive hook mock
const mockResponsive = createMockResponsive();

// Override specific properties
const mockResponsive = createMockResponsive({
  isMobile: true,
  isDesktop: false,
});
```

## Usage in Test Files

```typescript
import { createMockApi } from '@/__tests__/mocks/api';
import { createMockTaskContext, createMockModelProviderContext } from '@/__tests__/mocks/contexts';
import { useApi } from '@/contexts/ApiContext';
import { useTask } from '@/contexts/TaskContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({ useApi: vi.fn() }));
vi.mock('@/contexts/TaskContext', () => ({ useTask: vi.fn() }));
vi.mock('@/contexts/ModelProviderContext', () => ({ useModelProviders: vi.fn() }));

describe('MyComponent', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReturnValue(createMockApi());
    vi.mocked(useTask).mockReturnValue(createMockTaskContext());
    vi.mocked(useModelProviders).mockReturnValue(createMockModelProviderContext());
  });
});
```

### Context Migration
1. Replace local context mock objects with appropriate factory functions
2. Extract reusable context configurations to factory functions
3. Add test-specific overrides as needed

This reduces test file size significantly while maintaining full functionality and consistency across tests.