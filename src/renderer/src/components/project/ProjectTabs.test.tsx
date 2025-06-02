import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DropResult } from 'react-beautiful-dnd';
import { ProjectTabs } from './ProjectTabs';
import { ProjectData } from '@common/types';

// Mock react-beautiful-dnd components
// We are mocking the components to allow us to directly call onDragEnd
// and to avoid the complexities of simulating HTML5 drag and drop.
const mockOnDragEnd = jest.fn();
jest.mock('react-beautiful-dnd', () => ({
  ...jest.requireActual('react-beautiful-dnd'),
  DragDropContext: ({ children, onDragEnd }) => {
    // Store the onDragEnd function so we can call it manually
    mockOnDragEnd.mockImplementation(onDragEnd);
    return <div data-testid="dnd-context">{children}</div>;
  },
  Droppable: ({ children }) => children({ innerRef: jest.fn(), droppableProps: {style: {}}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef: jest.fn(), draggableProps: {style: {}}, dragHandleProps: null }, {}),
}));

const mockProjects: ProjectData[] = [
  { baseDir: '/path/to/projectA', settings: {}, active: true },
  { baseDir: '/path/to/projectB', settings: {}, active: false },
  { baseDir: '/path/to/projectC', settings: {}, active: false },
];

describe('ProjectTabs', () => {
  let mockOnReorderProjects: jest.Mock;
  let mockOnSetActiveProject: jest.Mock;
  let mockOnCloseProject: jest.Mock;
  let mockOnAddProject: jest.Mock;

  beforeEach(() => {
    mockOnReorderProjects = jest.fn();
    mockOnSetActiveProject = jest.fn();
    mockOnCloseProject = jest.fn();
    mockOnAddProject = jest.fn();
    mockOnDragEnd.mockClear(); // Clear any previous implementations or calls
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

  test('should call onReorderProjects with reordered projects when onDragEnd is triggered', () => {
    renderComponent();

    const sourceIndex = 0; // Dragging Project A
    const destinationIndex = 2; // To Project C's position

    const dragResult: DropResult = {
      draggableId: mockProjects[sourceIndex].baseDir,
      source: { index: sourceIndex, droppableId: 'projectTabs' },
      destination: { index: destinationIndex, droppableId: 'projectTabs' },
      reason: 'DROP',
      mode: 'FLUID',
      type: 'DEFAULT',
    };

    // Call the onDragEnd function captured by the mocked DragDropContext
    // This simulates react-beautiful-dnd calling the onDragEnd prop
    if (mockOnDragEnd.getMockImplementation()) {
      mockOnDragEnd(dragResult);
    } else {
      throw new Error("onDragEnd was not captured by the mock DragDropContext. Check the mock implementation.");
    }
    

    expect(mockOnReorderProjects).toHaveBeenCalledTimes(1);
    const expectedReorderedProjects: ProjectData[] = [
      mockProjects[1], // Project B
      mockProjects[2], // Project C
      mockProjects[0], // Project A (moved to the end)
    ];
    expect(mockOnReorderProjects).toHaveBeenCalledWith(expectedReorderedProjects);
  });

  test('should not call onReorderProjects if destination is null', () => {
    renderComponent();
    const dragResult: DropResult = {
      draggableId: mockProjects[0].baseDir,
      source: { index: 0, droppableId: 'projectTabs' },
      destination: null, // No destination
      reason: 'DROP',
      mode: 'FLUID',
      type: 'DEFAULT',
    };

    if (mockOnDragEnd.getMockImplementation()) {
      mockOnDragEnd(dragResult);
    } else {
      throw new Error("onDragEnd was not captured by the mock DragDropContext.");
    }

    expect(mockOnReorderProjects).not.toHaveBeenCalled();
  });

  test('should not call onReorderProjects if source and destination are the same', () => {
    renderComponent();
    const dragResult: DropResult = {
      draggableId: mockProjects[0].baseDir,
      source: { index: 0, droppableId: 'projectTabs' },
      destination: { index: 0, droppableId: 'projectTabs' }, // Same source and destination
      reason: 'DROP',
      mode: 'FLUID',
      type: 'DEFAULT',
    };

    if (mockOnDragEnd.getMockImplementation()) {
      mockOnDragEnd(dragResult);
    } else {
      throw new Error("onDragEnd was not captured by the mock DragDropContext.");
    }

    expect(mockOnReorderProjects).not.toHaveBeenCalled();
  });
});
