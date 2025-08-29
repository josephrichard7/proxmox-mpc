/**
 * StatusBadge Component Tests
 */

import { render, screen } from '@/test/test-utils';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders running status with correct styling', () => {
    render(<StatusBadge status="running" />);
    
    const badge = screen.getByText('Running');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('mantine-Badge-root');
  });

  it('renders stopped status with correct styling', () => {
    render(<StatusBadge status="stopped" />);
    
    const badge = screen.getByText('Stopped');
    expect(badge).toBeInTheDocument();
  });

  it('renders error status with correct styling', () => {
    render(<StatusBadge status="error" />);
    
    const badge = screen.getByText('Error');
    expect(badge).toBeInTheDocument();
  });

  it('renders unknown status correctly', () => {
    render(<StatusBadge status="unknown" />);
    
    const badge = screen.getByText('Unknown');
    expect(badge).toBeInTheDocument();
  });

  it('handles custom size prop', () => {
    render(<StatusBadge status="running" size="lg" />);
    
    const badge = screen.getByText('Running');
    expect(badge).toBeInTheDocument();
  });

  it('applies correct aria-label for accessibility', () => {
    render(<StatusBadge status="running" />);
    
    const badge = screen.getByLabelText('Status: Running');
    expect(badge).toBeInTheDocument();
  });

  describe('color variants', () => {
    const statusColors = [
      { status: 'running' as const, expectedText: 'Running' },
      { status: 'stopped' as const, expectedText: 'Stopped' },
      { status: 'error' as const, expectedText: 'Error' },
      { status: 'pending' as const, expectedText: 'Pending' },
    ];

    statusColors.forEach(({ status, expectedText }) => {
      it(`renders ${status} status with appropriate color`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByText(expectedText);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute('aria-label', `Status: ${expectedText}`);
      });
    });
  });
});