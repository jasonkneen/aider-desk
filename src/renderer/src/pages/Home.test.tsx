import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Home } from './Home';
import { ProjectData } from '@common/types';

// Mock window.api
const mockUpdateOpenProjectsOrder = vi.fn(() => Promise.resolve([]));
const mockGetOpenProjects = vi.fn(() => Promise.resolve([]));
const mockGetReleaseNotes = vi.fn(() => Promise.resolve(null));
const mockLoadModelsInfo = vi.fn(() => Promise.resolve({}));

vi.mock('@/utils/routes', () => ({
  ROUTES: {
    Onboarding: '/onboarding',
    Home: '/home',
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str) => str,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  }),
}));

// Mock child components
let capturedProjectTabsProps: any = {};
vi.mock('@/components/project/ProjectTabs', () => ({
  ProjectTabs: (props: any) => {
    capturedProjectTabsProps = props; // Capture props to inspect/invoke them
    return <div data-testid="project-tabs"></div>;
  },
}));
vi.mock('@/components/project/NoProjectsOpen', () => ({
  NoProjectsOpen: () => <div data-testid="no-projects-open"></div>,
}));
vi.mock('@/components/project/ProjectView', () => ({
  ProjectView: () => <div data-testid="project-view"></div>,
}));
vi.mock('@/components/settings/SettingsDialog', () => ({
  SettingsDialog: () => <div data-testid="settings-dialog"></div>,
}));
vi.mock('@/components/common/HtmlInfoDialog', () => ({
  HtmlInfoDialog: () => <div data-testid="html-info-dialog"></div>,
}));
vi.mock('@/components/Dialogs/TelemetryInfoDialog', () => ({
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
    setActiveProject: vi.fn(() => Promise.resolve([])),
    removeOpenProject: vi.fn(() => Promise.resolve([])),
    addOpenProject: vi.fn(() => Promise.resolve([])),
    getVersions: vi.fn(() => Promise.resolve({ appVersion: '1.0.0', engineVersion: '1.0.0' })),
    getProjectSettings: vi.fn(() => Promise.resolve({ mainModel: 'test-model' })),
  },
} as any;


const initialProjects: ProjectData[] = [
  { baseDir: '/path/to/projectA', settings: {}, active: true },
  { baseDir: '/path/to/projectB', settings: {}, active: false },
  { baseDir: '/path/to/projectC', settings: {}, active: false },
];

describe('Home Page', () => {
  beforeEach(() => { // Removed async here, setup mocks synchronously
    vi.clearAllMocks();
    capturedProjectTabsProps = {};
    // Ensure all API calls that Home makes on mount are mocked BEFORE render
    mockGetOpenProjects.mockResolvedValue([...initialProjects.map(p => ({...p}))]);
    mockGetReleaseNotes.mockResolvedValue(null); // Assuming this is used in a useEffect
    mockLoadModelsInfo.mockResolvedValue({}); // Assuming this is used in a useEffect
    // Ensure getVersions is mocked if used in useEffect
    (window.api.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue({ aiderDeskCurrentVersion: '1', aiderCurrentVersion: '1' });


    mockUpdateOpenProjectsOrder.mockResolvedValue([]);
  });

  test('handleReorderProjects updates openProjects state and calls window.api.updateOpenProjectsOrder', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await act(async () => {
      render(<Home />);
      // Ensure all initial useEffect async operations settle
      await Promise.resolve(); // Flushes microtasks
    });

    // Check initial state after render and useEffects
    await waitFor(() => {
      expect(capturedProjectTabsProps.openProjects).toEqual(initialProjects);
    });

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
    // Ensure getOpenProjects is reset if it's meant to be called again after an error by some logic
    mockGetOpenProjects.mockResolvedValue([...originalProjectsBeforeReorder]);


    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await act(async () => {
      render(<Home />);
      await Promise.resolve(); // Flush microtasks for initial render effects
    });
    
    await waitFor(() => {
        expect(capturedProjectTabsProps.openProjects).toEqual(originalProjectsBeforeReorder);
    });


    const reorderedProjects: ProjectData[] = [
      initialProjects[1], 
      initialProjects[2], 
      initialProjects[0], 
    ];
    const reorderedBaseDirs = reorderedProjects.map(p => p.baseDir);
    
    await act(async () => {
      // Simulate ProjectTabs calling onReorderProjects
      if (capturedProjectTabsProps.onReorderProjects) {
         capturedProjectTabsProps.onReorderProjects(reorderedProjects);
      } else {
        throw new Error('onReorderProjects prop not captured or available');
      }
      await Promise.resolve(); // Flush microtasks for state update from onReorderProjects
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
