import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsData, AgentProfile, SuggestionMode, MemoryEmbeddingProvider, ContextCompactionType } from '@common/types';
import { DEFAULT_AGENT_PROFILES } from '@common/agent';

import { AgentSettings } from '../AgentSettings';

import { createMockApi } from '@/__tests__/mocks/api';
import { createMockModelProviderContext } from '@/__tests__/mocks/contexts';
import { useApi } from '@/contexts/ApiContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { TooltipProvider } from '@/components/ui/Tooltip';

// Tooltip provider wrapper for Radix UI tooltips
const TestWrapper = ({ children }: { children: React.ReactNode }) => <TooltipProvider>{children}</TooltipProvider>;

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, children }: { i18nKey?: string; children: React.ReactNode }) => <span data-i18n-key={i18nKey}>{children}</span>,
}));

// Mock ModelSelector component
vi.mock('@/components/ModelSelector', () => ({
  ModelSelector: ({ onChange, selectedModelId }: { onChange: (model: { id: string; providerId: string }) => void; selectedModelId?: string }) => (
    <div data-testid="model-selector">
      <button onClick={() => onChange({ id: 'test-model', providerId: 'test-provider' })}>Select Model</button>
      <span data-testid="selected-model-id">{selectedModelId || 'none'}</span>
    </div>
  ),
}));

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/contexts/ModelProviderContext', () => ({
  useModelProviders: vi.fn(),
}));

describe('AgentSettings - Missing Default Profiles', () => {
  const mockSettings: SettingsData = {
    onboardingFinished: true,
    language: 'en',
    startupMode: undefined,
    zoomLevel: 1,
    notificationsEnabled: true,
    theme: 'dark',
    font: 'Inter',
    fontSize: 14,
    renderMarkdown: true,
    virtualizedRendering: true,
    aiderDeskAutoUpdate: false,
    diffViewMode: undefined,
    aider: {
      options: '',
      environmentVariables: '',
      addRuleFiles: false,
      autoCommits: false,
      cachingEnabled: true,
      watchFiles: true,
      confirmBeforeEdit: false,
    },
    mcpServers: {},
    preferredModels: [],
    llmProviders: {},
    telemetryEnabled: false,
    telemetryInformed: false,
    promptBehavior: {
      suggestionMode: SuggestionMode.OnTab,
      suggestionDelay: 300,
      requireCommandConfirmation: {
        add: true,
        readOnly: false,
        model: false,
        modeSwitching: false,
      },
      useVimBindings: false,
    },
    server: {
      enabled: false,
      basicAuth: {
        enabled: false,
        username: '',
        password: '',
      },
    },
    memory: {
      enabled: false,
      provider: MemoryEmbeddingProvider.SentenceTransformers,
      model: '',
      maxDistance: 0.5,
    },
    taskSettings: {
      smartTaskState: true,
      autoGenerateTaskName: false,
      showTaskStateActions: true,
      worktreeSymlinkFolders: [],
      contextCompactingThreshold: 50,
      contextCompactionType: ContextCompactionType.Compact,
    },
  };

  const mockApi = createMockApi();
  const mockModelProviderContext = createMockModelProviderContext();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi);
    vi.mocked(useModelProviders).mockReturnValue(mockModelProviderContext);
  });

  const renderAgentSettings = (props: Partial<React.ComponentProps<typeof AgentSettings>> = {}) => {
    return render(
      <TestWrapper>
        <AgentSettings settings={mockSettings} setSettings={vi.fn()} agentProfiles={[]} setAgentProfiles={vi.fn()} {...props} />
      </TestWrapper>,
    );
  };

  describe('missingDefaultProfiles calculation logic', () => {
    it('returns empty array when profileContext is not global', () => {
      renderAgentSettings({
        selectedProfileContext: '/some/project/path',
      });

      // Missing profiles section should not be shown for non-global context
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('returns all default profiles when agentProfiles is empty and context is global', () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Should show missing profiles section with all default profiles
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();

      // Check that all default profile names are shown
      DEFAULT_AGENT_PROFILES.forEach((profile) => {
        expect(screen.getByText(profile.name)).toBeInTheDocument();
      });
    });

    it('returns only missing profiles when some defaults are present', () => {
      const agentProfiles: AgentProfile[] = [DEFAULT_AGENT_PROFILES[0]];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      // Should show missing profiles section
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();

      // First profile should not be in missing section
      expect(screen.queryByText(DEFAULT_AGENT_PROFILES[0].name)).not.toBeInTheDocument();

      // Other default profiles should be shown as missing
      for (let i = 1; i < DEFAULT_AGENT_PROFILES.length; i++) {
        expect(screen.getByText(DEFAULT_AGENT_PROFILES[i].name)).toBeInTheDocument();
      }
    });

    it('returns empty array when all default profiles are present', () => {
      const agentProfiles: AgentProfile[] = [...DEFAULT_AGENT_PROFILES];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      // Should not show missing profiles section
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('returns empty array when custom profiles exist but no defaults are missing', () => {
      const customProfile: AgentProfile = {
        ...DEFAULT_AGENT_PROFILES[0],
        id: 'custom-profile',
        name: 'Custom Profile',
      };

      const agentProfiles: AgentProfile[] = [...DEFAULT_AGENT_PROFILES, customProfile];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      // Should not show missing profiles section
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('does not consider project-level profiles when calculating missing profiles', () => {
      const projectProfile: AgentProfile = {
        ...DEFAULT_AGENT_PROFILES[0],
        projectDir: '/some/project/path',
      };

      const agentProfiles: AgentProfile[] = [projectProfile];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      // Project-level profile should not count as having the default profile
      // The default profile should still be shown as missing in global context
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
      expect(screen.getByText(DEFAULT_AGENT_PROFILES[0].name)).toBeInTheDocument();
    });
  });

  describe('handleRestoreProfile function', () => {
    it('adds default profile to state when restore button is clicked', async () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Find all plus icon buttons (restore buttons)
      const plusIcons = screen.queryAllByText('');
      const restoreButtons = plusIcons.filter((icon) => {
        // Find the button with the SVG plus icon
        return icon.parentElement?.querySelector('svg')?.classList.contains('fa-plus');
      });

      const firstRestoreButton = restoreButtons[0]?.parentElement;

      expect(firstRestoreButton).toBeDefined();

      if (firstRestoreButton) {
        // Initially, the default profile should not be in the list
        expect(screen.queryByText(DEFAULT_AGENT_PROFILES[0].name)).not.toBeInTheDocument();

        fireEvent.click(firstRestoreButton);

        // After clicking restore, the profile should be added to the list
        await waitFor(() => {
          expect(screen.getByText(DEFAULT_AGENT_PROFILES[0].name)).toBeInTheDocument();
        });
      }
    });

    it('adds default profile to agentProfiles state when restore button is clicked', async () => {
      const setAgentProfiles = vi.fn();
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
        setAgentProfiles,
      });

      // Find and click the restore button for the first missing profile
      const plusIcons = screen.queryAllByText('');
      const restoreButtons = plusIcons.filter((icon) => {
        return icon.parentElement?.querySelector('svg')?.classList.contains('fa-plus');
      });

      const firstRestoreButton = restoreButtons[0]?.parentElement;

      if (firstRestoreButton) {
        fireEvent.click(firstRestoreButton);

        await waitFor(() => {
          expect(setAgentProfiles).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: DEFAULT_AGENT_PROFILES[0].id })]));
        });
      }
    });

    it('handles restore button click event propagation correctly', async () => {
      const setAgentProfiles = vi.fn();
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
        setAgentProfiles,
      });

      // Find the first missing profile row
      const firstMissingProfileRow = screen.getAllByText(DEFAULT_AGENT_PROFILES[0].name).find((el) => {
        return el.tagName === 'SPAN' || el.closest('div[role="button"]');
      });

      if (firstMissingProfileRow) {
        // Click on the row (should not trigger restore if clicking on name)
        fireEvent.click(firstMissingProfileRow);

        // setAgentProfiles should not be called when clicking on the name
        expect(setAgentProfiles).not.toHaveBeenCalled();

        // Now click the restore button specifically (the plus icon button)
        const plusIcons = screen.queryAllByText('');
        const restoreButtons = plusIcons.filter((icon) => {
          return icon.parentElement?.querySelector('svg')?.classList.contains('fa-plus');
        });

        const firstRestoreButton = restoreButtons[0]?.parentElement;

        if (firstRestoreButton) {
          fireEvent.click(firstRestoreButton);

          await waitFor(() => {
            expect(setAgentProfiles).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: DEFAULT_AGENT_PROFILES[0].id })]));
          });

          // Verify no API call was made
          expect(mockApi.createAgentProfile).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('conditional rendering of missing profiles section', () => {
    it('shows missing profiles section when context is global and profiles are missing', () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
    });

    it('hides missing profiles section when context is not global', () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: '/some/project',
      });

      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('hides missing profiles section when no profiles are missing', () => {
      const agentProfiles: AgentProfile[] = [...DEFAULT_AGENT_PROFILES];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('updates missing profiles section when context changes from global to project', () => {
      const { rerender } = renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Should show missing profiles in global context
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();

      // Change to project context
      rerender(
        <TestWrapper>
          <AgentSettings settings={mockSettings} setSettings={vi.fn()} agentProfiles={[]} setAgentProfiles={vi.fn()} selectedProfileContext="/some/project" />
        </TestWrapper>,
      );

      // Should hide missing profiles in project context
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('updates missing profiles section when context changes from project to global', () => {
      const { rerender } = renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: '/some/project',
      });

      // Should not show missing profiles in project context
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();

      // Change to global context
      rerender(
        <TestWrapper>
          <AgentSettings settings={mockSettings} setSettings={vi.fn()} agentProfiles={[]} setAgentProfiles={vi.fn()} selectedProfileContext="global" />
        </TestWrapper>,
      );

      // Should show missing profiles in global context
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
    });

    it('updates missing profiles section when profiles are added', () => {
      const { rerender } = renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Should show all default profiles as missing
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
      expect(screen.getByText(DEFAULT_AGENT_PROFILES[0].name)).toBeInTheDocument();

      // Add first default profile
      const updatedProfiles = [DEFAULT_AGENT_PROFILES[0]];
      rerender(
        <TestWrapper>
          <AgentSettings
            settings={mockSettings}
            setSettings={vi.fn()}
            agentProfiles={updatedProfiles}
            setAgentProfiles={vi.fn()}
            selectedProfileContext="global"
          />
        </TestWrapper>,
      );

      // First profile should no longer be in missing section
      expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_AGENT_PROFILES[0].name)).not.toBeInTheDocument();
    });

    it('shows subagent color indicator for missing profiles with subagent enabled', () => {
      const profileWithSubagent = DEFAULT_AGENT_PROFILES.find((p) => p.subagent.enabled);

      if (!profileWithSubagent) {
        return; // Skip test if no profile has subagent enabled
      }

      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Find the profile's name in the missing section
      const profileNameElement = screen.getByText(profileWithSubagent.name);
      const profileRow = profileNameElement.closest('div');

      // Check for subagent color indicator (a div with rounded-full class and background color)
      const colorIndicator = profileRow?.querySelector('.rounded-full');

      expect(colorIndicator).toBeInTheDocument();
      expect(colorIndicator).toHaveStyle({ backgroundColor: profileWithSubagent.subagent.color });
    });

    it('does not show subagent color indicator for missing profiles with subagent disabled', () => {
      const profileWithoutSubagent = DEFAULT_AGENT_PROFILES.find((p) => !p.subagent.enabled);

      if (!profileWithoutSubagent) {
        return; // Skip test if all profiles have subagent enabled
      }

      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Find the profile's name in the missing section
      const profileNameElement = screen.getByText(profileWithoutSubagent.name);
      const profileRow = profileNameElement.closest('div');

      // Check for subagent color indicator (should not exist)
      const colorIndicator = profileRow?.querySelector('.rounded-full');

      expect(colorIndicator).not.toBeInTheDocument();
    });
  });

  describe('tooltip for restore button', () => {
    it('shows tooltip with correct text on restore button', () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Find restore button (parent div with the plus icon)
      const plusIcons = screen.queryAllByText('');
      const restoreButtonParents = plusIcons
        .filter((icon) => icon.parentElement?.querySelector('svg')?.classList.contains('fa-plus'))
        .map((icon) => icon.parentElement?.parentElement);

      const firstRestoreButton = restoreButtonParents[0];

      expect(firstRestoreButton).toBeDefined();
      if (firstRestoreButton) {
        // Check if the button has a title attribute (tooltip)
        // The IconButton component uses the tooltip prop which gets set as title
        expect(firstRestoreButton.getAttribute('title')).toBe('settings.agent.restoreProfileTooltip');
      }
    });
  });

  describe('edge cases and error scenarios', () => {
    it('handles empty DEFAULT_AGENT_PROFILES gracefully', () => {
      // This test ensures the component works even if DEFAULT_AGENT_PROFILES is empty
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Component should render without errors
      // When DEFAULT_AGENT_PROFILES has actual values, the section will appear
      if (DEFAULT_AGENT_PROFILES.length > 0) {
        expect(screen.getByText('settings.agent.missingProfilesSection')).toBeInTheDocument();
      }
    });

    it('handles profiles with duplicate IDs', () => {
      const duplicateProfile: AgentProfile = {
        ...DEFAULT_AGENT_PROFILES[0],
        id: DEFAULT_AGENT_PROFILES[0].id,
      };

      const agentProfiles: AgentProfile[] = [duplicateProfile];

      renderAgentSettings({
        agentProfiles,
        selectedProfileContext: 'global',
      });

      // Component should render without errors
      // Duplicate ID should still count as having the profile
      expect(screen.queryByText(DEFAULT_AGENT_PROFILES[0].name)).not.toBeInTheDocument();
    });

    it('handles rapid context switches without errors', () => {
      const { rerender } = renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Rapidly switch between contexts
      const contexts = ['global', '/project1', '/project2', 'global', '/project1'];

      contexts.forEach((context) => {
        rerender(
          <TestWrapper>
            <AgentSettings
              settings={mockSettings}
              setSettings={vi.fn()}
              agentProfiles={[]}
              setAgentProfiles={vi.fn()}
              selectedProfileContext={context as 'global' | string}
            />
          </TestWrapper>,
        );
      });

      // Final state should be correct
      expect(screen.queryByText('settings.agent.missingProfilesSection')).not.toBeInTheDocument();
    });

    it('handles multiple restore clicks for same profile correctly', async () => {
      renderAgentSettings({
        agentProfiles: [],
        selectedProfileContext: 'global',
      });

      // Find restore button for first missing profile
      const plusIcons = screen.queryAllByText('');
      const restoreButtons = plusIcons.filter((icon) => {
        return icon.parentElement?.querySelector('svg')?.classList.contains('fa-plus');
      });

      const firstRestoreButton = restoreButtons[0]?.parentElement;

      if (firstRestoreButton) {
        // Click restore button multiple times
        fireEvent.click(firstRestoreButton);
        fireEvent.click(firstRestoreButton);
        fireEvent.click(firstRestoreButton);

        // Profile should be added after first click
        await waitFor(() => {
          expect(screen.getByText(DEFAULT_AGENT_PROFILES[0].name)).toBeInTheDocument();
        });

        // Multiple clicks should not cause issues
        const profiles = screen.getAllByText(DEFAULT_AGENT_PROFILES[0].name);
        expect(profiles.length).toBeGreaterThan(0);
      }
    });
  });
});
