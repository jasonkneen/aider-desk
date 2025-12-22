import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BaseDialog } from '../BaseDialog';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock focus-trap-react as it can be tricky in tests
vi.mock('focus-trap-react', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('BaseDialog', () => {
  it('renders with title and children', () => {
    const title = 'Test Dialog';
    const content = 'Dialog Content';
    render(
      <BaseDialog title={title} onClose={vi.fn()}>
        <div>{content}</div>
      </BaseDialog>,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseDialog title="Test" onClose={onClose}>
        <div>Content</div>
      </BaseDialog>,
    );

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <BaseDialog title="Test" onClose={onClose}>
        <div>Content</div>
      </BaseDialog>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape key is pressed and closeOnEscape is false', () => {
    const onClose = vi.fn();
    render(
      <BaseDialog title="Test" onClose={onClose} closeOnEscape={false}>
        <div>Content</div>
      </BaseDialog>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders custom footer when provided', () => {
    const footer = <button data-testid="custom-footer">Custom Button</button>;
    render(
      <BaseDialog title="Test" onClose={vi.fn()} footer={footer}>
        <div>Content</div>
      </BaseDialog>,
    );

    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
    expect(screen.queryByText('common.cancel')).not.toBeInTheDocument();
  });
});
