import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from './Home';
import { ProjectData } from '@common/types';

// Mock window.api
const mockUpdateOpenProjectsOrder = jest.fn(() => Promise.resolve([]));
const mockGetOpenProjects = jest.fn(() => Promise.resolve([]));
const mockGetReleaseNotes = jest.fn(() => Promise.resolve(null));
const mockLoadModelsInfo = jest.fn(() => Promise.resolve({}));

jest.mock('@/utils/routes', () => ({
  ROUTES: {
    Onboarding: '/onboarding',
    Home: '/home',
  },
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str) => str,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  }),
}));

// Mock child components
let capturedProjectTabsProps: any = {};
jest.mock('@/components/project/ProjectTabs', () => ({
  ProjectTabs: (props: any) => {
    capturedProjectTabsProps = props; // Capture props to inspect/invoke them
    return <div data-testid="project-tabs"></div>;
  },
}));
jest.mock('@/components/project/NoProjectsOpen', () => ({
  NoProjectsOpen: () => <div data-testid="no-projects-open"></div>,
}));
jest.mock('@/components/project/ProjectView', () => ({
  ProjectView: () => <div data-testid="project-view"></div>,
}));
jest.mock('@/components/settings/SettingsDialog', () => ({
  SettingsDialog: () => <div data-testid="settings-dialog"></div>,
}));
jest.mock('@/components/common/HtmlInfoDialog', () => ({
  HtmlInfoDialog: () => <div data-testid="html-info-dialog"></div>,
}));
jest.mock('@/components/Dialogs/TelemetryInfoDialog', () => ({
  TelemetryInfoDialog: () => <div data-testid="telemetry-info-dialog"></div>,
}));


// Mock global window.api
global.window = {
  ...global.window,
  api: {
    ...(global.window.api || {}),
    getOpenProjects: mockGetOpenProjects,
    updateOpenProjectsOrder: mockUpdateOpenProjectsOrder,
    getReleaseNotes: mockGetReleaseNotes,
    loadModelsInfo: mockLoadModelsInfo,
    // Add other necessary mock API functions if Home component uses them on mount or during test
    setActiveProject: jest.fn(() => Promise.resolve([])),
    removeOpenProject: jest.fn(() => Promise.resolve([])),
    addOpenProject: jest.fn(() => Promise.resolve([])),
    getVersions: jest.fn(() => Promise.resolve({ appVersion: '1.0.0', engineVersion: '1.0.0' })),
    getProjectSettings: jest.fn(() => Promise.resolve({ mainModel: 'test-model' })),
  },
} as any;


const initialProjects: ProjectData[] = [
  { baseDir: '/path/to/projectA', settings: {}, active: true },
  { baseDir: '/path/to/projectB', settings: {}, active: false },
  { baseDir: '/path/to/projectC', settings: {}, active: false },
];

describe('Home Page', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset captured props for each test
    capturedProjectTabsProps = {};
    // Setup initial mockResolvedValue for getOpenProjects
    mockGetOpenProjects.mockResolvedValue(initialProjects.map(p => ({...p}))); // Return fresh copies
    mockUpdateOpenProjectsOrder.mockResolvedValue([]);
  });

  test('handleReorderProjects updates openProjects state and calls window.api.updateOpenProjectsOrder', async () => {
    render(<Home />);

    // Wait for initial projects to be loaded and ProjectTabs to be rendered with props
    await waitFor(() => {
      expect(capturedProjectTabsProps.openProjects).toBeDefined();
    });
    
    expect(capturedProjectTabsProps.openProjects).toEqual(initialProjects);

    const reorderedProjects: ProjectData[] = [
      initialProjects[1], // Project B
      initialProjects[2], // Project C
      initialProjects[0], // Project A
    ];
    const reorderedBaseDirs = reorderedProjects.map(p => p.baseDir);

    // Simulate ProjectTabs calling onReorderProjects
    // Need to use `act` because `handleReorderProjects` will update state
    await act(async () => {
      capturedProjectTabsProps.onReorderProjects(reorderedProjects);
    });

    // Check if window.api.updateOpenProjectsOrder was called
    expect(mockUpdateOpenProjectsOrder).toHaveBeenCalledTimes(1);
    expect(mockUpdateOpenProjectsOrder).toHaveBeenCalledWith(reorderedBaseDirs);
    
    // After API call, Home component updates its state, which should re-render ProjectTabs
    // We expect ProjectTabs to receive the reordered projects
    // Need to wait for the re-render after state update
    await waitFor(() => {
        expect(capturedProjectTabsProps.openProjects).toEqual(reorderedProjects);
    });
  });

  test('handleReorderProjects handles API failure gracefully', async () => {
    // Simulate API failure
    mockUpdateOpenProjectsOrder.mockRejectedValueOnce(new Error('API Error'));
    // Store original projects to check for revert (optional, depends on error handling strategy)
    const originalProjectsBeforeReorder = initialProjects.map(p => ({...p}));
    mockGetOpenProjects.mockResolvedValue(originalProjectsBeforeReorder);


    render(<Home />);
    await waitFor(() => {
        expect(capturedProjectTabsProps.openProjects).toEqual(originalProjectsBeforeReorder);
    });


    const reorderedProjects: ProjectData[] = [
      initialProjects[1], 
      initialProjects[2], 
      initialProjects[0], 
    ];
    const reorderedBaseDirs = reorderedProjects.map(p => p.baseDir);
    
    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      capturedProjectTabsProps.onReorderProjects(reorderedProjects);
    });

    expect(mockUpdateOpenProjectsOrder).toHaveBeenCalledTimes(1);
    expect(mockUpdateOpenProjectsOrder).toHaveBeenCalledWith(reorderedBaseDirs);
    
    // Check if error was logged (or other error handling)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update open projects order:', expect.any(Error));

    // Verify that the state was still updated optimistically
    // or reverted if that's the desired behavior.
    // The current implementation in Home.tsx optimistically updates the state.
    await waitFor(() => {
        expect(capturedProjectTabsProps.openProjects).toEqual(reorderedProjects);
    });
    
    consoleErrorSpy.mockRestore();
  });
});
