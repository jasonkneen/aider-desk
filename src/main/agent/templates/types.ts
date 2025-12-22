import { AgentProfile } from '@common/types';

export interface ToolPermissions {
  aiderTools: boolean;
  powerTools: {
    semanticSearch: boolean;
    fileRead: boolean;
    fileWrite: boolean;
    fileEdit: boolean;
    glob: boolean;
    grep: boolean;
    bash: boolean;
    anyEnabled: boolean;
  };
  todoTools: boolean;
  subagents: boolean;
  memory: {
    enabled: boolean;
    retrieveAllowed: boolean;
    storeAllowed: boolean;
    listAllowed: boolean;
    deleteAllowed: boolean;
  };
  skills: {
    allowed: boolean;
  };
  autoApprove: boolean;
}

export interface SystemPromptData {
  projectDir: string;
  taskDir: string;
  agentProfile: AgentProfile;
  additionalInstructions?: string;
  osName: string;
  currentDate: string;
  rulesFiles: string;
  customInstructions: string;
  toolPermissions: ToolPermissions;
  toolConstants: Record<string, string>;
  workflow: string;
  projectGitRootDirectory?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InitProjectPromptData {
  // Static for now
}

export interface CompactConversationPromptData {
  customInstructions?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CommitMessagePromptData {
  // Static for now
}

export interface ConflictResolutionSystemPromptData {
  POWER_TOOL_GROUP_NAME: string;
  TOOL_GROUP_NAME_SEPARATOR: string;
  POWER_TOOL_FILE_EDIT: string;
}

export interface ConflictResolutionPromptData {
  filePath: string;
  basePath?: string;
  oursPath?: string;
  theirsPath?: string;
}
