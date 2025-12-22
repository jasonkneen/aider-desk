import { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Model, ProviderProfile } from '@common/types';
import { LlmProvider } from '@common/agent';

import { ModelDialog } from '../ModelDialog';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface BaseDialogProps {
  children: ReactNode;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}

// Mock BaseDialog
vi.mock('../../common/BaseDialog', () => ({
  BaseDialog: ({ children, title, onClose, footer }: BaseDialogProps) => (
    <div data-testid="base-dialog">
      <h1>{title}</h1>
      <div data-testid="dialog-content">{children}</div>
      <div data-testid="dialog-footer">{footer || <button onClick={onClose}>common.cancel</button>}</div>
    </div>
  ),
}));

const mockProviders: ProviderProfile[] = [
  {
    id: 'provider-1',
    name: 'openai',
    provider: { name: 'openai' } as LlmProvider,
  },
];

describe('ModelDialog', () => {
  it('renders for adding a new model', () => {
    render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('modelLibrary.addModel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('modelLibrary.modelIdPlaceholder')).toBeInTheDocument();
  });

  it('renders for editing an existing model', () => {
    const model: Model = {
      id: 'gpt-4',
      providerId: 'provider-1',
      isCustom: true,
    };
    render(<ModelDialog model={model} providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('modelLibrary.editModel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
  });

  it('calls onSave with model data when save is clicked', () => {
    const onSave = vi.fn();
    render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('modelLibrary.modelIdPlaceholder'), {
      target: { value: 'new-model' },
    });

    fireEvent.click(screen.getByText('common.confirm'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-model',
        providerId: 'provider-1',
      }),
    );
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
