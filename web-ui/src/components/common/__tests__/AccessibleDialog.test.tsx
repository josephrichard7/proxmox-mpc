import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { AccessibleDialog, ConfirmationDialog } from '../AccessibleDialog';

describe('AccessibleDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with proper ARIA attributes', () => {
    render(
      <AccessibleDialog
        opened={true}
        onClose={mockOnClose}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('announces dialog opening and closing', async () => {
    const { rerender } = render(
      <AccessibleDialog
        opened={false}
        onClose={mockOnClose}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    // Open dialog
    rerender(
      <AccessibleDialog
        opened={true}
        onClose={mockOnClose}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    // Should announce opening
    await waitFor(() => {
      expect(screen.getByText(/dialog opened: test dialog/i)).toBeInTheDocument();
    });

    // Close dialog
    rerender(
      <AccessibleDialog
        opened={false}
        onClose={mockOnClose}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    // Should announce closing
    await waitFor(() => {
      expect(screen.getByText(/dialog closed/i)).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', () => {
    render(
      <AccessibleDialog
        opened={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test Dialog"
        confirmText="Save"
        cancelText="Cancel"
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    const dialog = screen.getByRole('dialog');

    // Test Escape key
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Test Tab navigation
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const confirmButton = screen.getByRole('button', { name: /save/i });

    cancelButton.focus();
    fireEvent.keyDown(cancelButton, { key: 'Tab' });
    expect(confirmButton).toHaveFocus();

    // Test Shift+Tab
    fireEvent.keyDown(confirmButton, { key: 'Tab', shiftKey: true });
    expect(cancelButton).toHaveFocus();
  });

  it('has proper button labels and descriptions', () => {
    render(
      <AccessibleDialog
        opened={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Delete Item"
        confirmText="Delete"
        cancelText="Cancel"
      >
        <p>Are you sure?</p>
      </AccessibleDialog>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel.*closes dialog/i });
    const confirmButton = screen.getByRole('button', { name: /delete.*performs action and closes dialog/i });

    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(
      <AccessibleDialog
        opened={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test Dialog"
        loading={true}
      >
        <p>Dialog content</p>
      </AccessibleDialog>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toHaveAttribute('data-loading', 'true');
  });
});

describe('ConfirmationDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with proper alert role for errors', () => {
    render(
      <ConfirmationDialog
        opened={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Error"
        message="Something went wrong"
        type="error"
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('uses polite aria-live for info messages', () => {
    render(
      <ConfirmationDialog
        opened={true}
        onClose={mockOnClose}
        title="Information"
        message="Task completed successfully"
        type="info"
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('applies correct styling based on type', () => {
    const { rerender } = render(
      <ConfirmationDialog
        opened={true}
        onClose={mockOnClose}
        title="Error"
        message="Error message"
        type="error"
      />
    );

    let messageContainer = screen.getByText('Error message').parentElement;
    expect(messageContainer).toHaveStyle({
      color: 'var(--mantine-color-red-7)',
      backgroundColor: 'var(--mantine-color-red-0)',
      border: '1px solid var(--mantine-color-red-3)'
    });

    rerender(
      <ConfirmationDialog
        opened={true}
        onClose={mockOnClose}
        title="Success"
        message="Success message"
        type="success"
      />
    );

    messageContainer = screen.getByText('Success message').parentElement;
    expect(messageContainer).toHaveStyle({
      color: 'var(--mantine-color-green-7)',
      backgroundColor: 'var(--mantine-color-green-0)',
      border: '1px solid var(--mantine-color-green-3)'
    });
  });
});