import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { AgentProfile } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

interface AgentsContextType {
  profiles: AgentProfile[];
  loading: boolean;
  error: string | null;
  getProfiles: (projectDir: string) => AgentProfile[];
  createProfile: (profile: AgentProfile, projectDir?: string) => Promise<void>;
  updateProfile: (profile: AgentProfile, projectDir?: string) => Promise<void>;
  deleteProfile: (profileId: string, projectDir?: string) => Promise<void>;
  refreshProfiles: (projectDir?: string) => Promise<void>;
  getProfile: (profileId: string, projectDir?: string) => Promise<AgentProfile | null>;
  updateProfilesOrder: (agentProfiles: AgentProfile[], baseDir?: string) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

interface AgentsProviderProps {
  children: ReactNode;
}

export const AgentsProvider = ({ children }: AgentsProviderProps) => {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const refreshProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getAllAgentProfiles();
      setProfiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent profiles');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const getProfiles = useCallback(
    (projectDir: string) => {
      return profiles.filter((p) => p.projectDir === projectDir || !p.projectDir);
    },
    [profiles],
  );

  const createProfile = async (profile: AgentProfile, projectDir?: string) => {
    try {
      await api.createAgentProfile(profile, projectDir);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent profile');
      throw err;
    }
  };

  const updateProfile = async (profile: AgentProfile, projectDir?: string) => {
    try {
      await api.updateAgentProfile(profile, projectDir);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent profile');
      throw err;
    }
  };

  const deleteProfile = async (profileId: string, projectDir?: string) => {
    try {
      await api.deleteAgentProfile(profileId, projectDir);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent profile');
      throw err;
    }
  };

  const getProfile = async (profileId: string, projectDir?: string): Promise<AgentProfile | null> => {
    try {
      return await api.getAgentProfile(profileId, projectDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get agent profile');
      throw err;
    }
  };

  const updateProfilesOrder = async (agentProfiles: AgentProfile[], baseDir?: string): Promise<void> => {
    try {
      await api.updateAgentProfilesOrder(agentProfiles, baseDir);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent profiles order');
      throw err;
    }
  };

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const value: AgentsContextType = {
    profiles,
    loading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    refreshProfiles,
    getProfiles,
    getProfile,
    updateProfilesOrder,
  };

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
};

export const useAgents = (): AgentsContextType => {
  const context = useContext(AgentsContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
};
