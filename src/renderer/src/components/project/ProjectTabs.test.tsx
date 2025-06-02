import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { DragEndEvent } from '@dnd-kit/core';
import { ProjectTabs } from './ProjectTabs';
import { ProjectData } from '@common/types';
import { useSortable } from '@dnd-kit/sortable'; // Import the actual hook

// Mock @dnd-kit/sortable's useSortable hook
// This is used by the internal SortableTabItem component.
vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...actual, // Import actual implementations for things like arrayMove, SortableContext
    useSortable: vi.fn(() => ({ // This is the mock function we want to clear
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
  };
});

// Ensure other @dnd-kit/core components are either actual or appropriately mocked if needed
// For this test, DndContext is specially mocked to capture onDragEnd.


// To capture the onDragEnd handler from DndContext
let capturedOnDragEnd: (event: DragEndEvent) => void = () => {};

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: any) => {
      capturedOnDragEnd = props.onDragEnd; // Capture the onDragEnd passed to DndContext
      return <div data-testid="dnd-context">{props.children}</div>;
    },
    // Sensors can be left as actual implementations or mocked if specific sensor logic needs to be bypassed/controlled
  };
});


const mockProjects: ProjectData[] = [
  { baseDir: '/path/to/projectA', settings: {}, active: true, id: 'projectA' }, // Assuming id for dnd-kit
  { baseDir: '/path/to/projectB', settings: {}, active: false, id: 'projectB' },
  { baseDir: '/path/to/projectC', settings: {}, active: false, id: 'projectC' },
];

describe('ProjectTabs with @dnd-kit', () => {
  let mockOnReorderProjects: ReturnType<typeof vi.fn>;
  let mockOnSetActiveProject: ReturnType<typeof vi.fn>;
  let mockOnCloseProject: ReturnType<typeof vi.fn>;
  let mockOnAddProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnReorderProjects = vi.fn();
    mockOnSetActiveProject = vi.fn();
    mockOnCloseProject = vi.fn();
    mockOnAddProject = vi.fn();
    capturedOnDragEnd = () => {}; // Reset captured function
    
    // Clear the specific mock function for useSortable
    // Check if useSortable is indeed a mock function before calling mockClear
    const mockedUseSortable = useSortable as ReturnType<typeof vi.fn>;
    if (mockedUseSortable && typeof mockedUseSortable.mockClear === 'function') {
      mockedUseSortable.mockClear();
    }
  });

  const renderComponent = (projects: ProjectData[] = mockProjects, activeProject?: ProjectData) => {
    return render(
      <ProjectTabs
        openProjects={projects}
        activeProject={activeProject || projects.find(p => p.active)}
        onAddProject={mockOnAddProject}
        onSetActiveProject={mockOnSetActiveProject}
        onCloseProject={mockOnCloseProject}
        onReorderProjects={mockOnReorderProjects}
      />
    );
  };

  test('should call onReorderProjects with reordered projects when handleDragEnd is triggered', () => {
    renderComponent();

    const activeItemId = mockProjects[0].baseDir; // Dragging Project A
    const overItemId = mockProjects[2].baseDir;   // To Project C's position

    const dragEndEvent = {
      active: { id: activeItemId, data: { current: null } },
      over: { id: overItemId, data: { current: null } },
      // other DragEndEvent properties can be added if necessary, but active and over are key
    } as unknown as DragEndEvent;


    if (capturedOnDragEnd) {
      capturedOnDragEnd(dragEndEvent);
    } else {
      throw new Error("onDragEnd was not captured from DndContext. Check the mock implementation.");
    }
    

    expect(mockOnReorderProjects).toHaveBeenCalledTimes(1);
    const expectedReorderedProjects: ProjectData[] = [
      mockProjects[1], // Project B
      mockProjects[2], // Project C
      mockProjects[0], // Project A (moved to the end)
    ];
    expect(mockOnReorderProjects).toHaveBeenCalledWith(expectedReorderedProjects);
  });

  test('should not call onReorderProjects if over is null (dropped outside)', () => {
    renderComponent();
    const dragEndEvent = {
      active: { id: mockProjects[0].baseDir, data: { current: null } },
      over: null,
    } as unknown as DragEndEvent;

    if (capturedOnDragEnd) {
      capturedOnDragEnd(dragEndEvent);
    } else {
      throw new Error("onDragEnd was not captured from DndContext.");
    }

    expect(mockOnReorderProjects).not.toHaveBeenCalled();
  });

  test('should not call onReorderProjects if active and over IDs are the same (no move)', () => {
    renderComponent();
    const dragEndEvent = {
      active: { id: mockProjects[0].baseDir, data: { current: null } },
      over: { id: mockProjects[0].baseDir, data: { current: null } },
    } as unknown as DragEndEvent;

    if (capturedOnDragEnd) {
      capturedOnDragEnd(dragEndEvent);
    } else {
      throw new Error("onDragEnd was not captured from DndContext.");
    }

    expect(mockOnReorderProjects).not.toHaveBeenCalled();
  });
});
