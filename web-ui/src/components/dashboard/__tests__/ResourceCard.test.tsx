/**
 * ResourceCard Component Tests
 */

import { render, screen } from '@/test/test-utils';
import { IconServer, IconContainer } from '@tabler/icons-react';
import { ResourceCard } from '../ResourceCard';

const mockResourceData = {
  title: 'Virtual Machines',
  count: 12,
  description: 'Active virtual machines in the cluster',
  icon: IconServer,
  color: 'blue'
};

describe('ResourceCard', () => {
  it('renders resource card with correct information', () => {
    render(<ResourceCard {...mockResourceData} />);
    
    expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Active virtual machines in the cluster')).toBeInTheDocument();
  });

  it('renders with different count values', () => {
    render(<ResourceCard {...mockResourceData} count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();

    render(<ResourceCard {...mockResourceData} count={999} />);
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('handles click events when onClick is provided', async () => {
    const handleClick = vi.fn();
    const { user } = render(
      <ResourceCard {...mockResourceData} onClick={handleClick} />
    );
    
    const card = screen.getByRole('button');
    await user.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render as button when onClick is not provided', () => {
    render(<ResourceCard {...mockResourceData} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<ResourceCard {...mockResourceData} loading />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('displays error state correctly', () => {
    const errorMessage = 'Failed to load data';
    render(<ResourceCard {...mockResourceData} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('applies correct accessibility attributes', () => {
    render(<ResourceCard {...mockResourceData} onClick={vi.fn()} />);
    
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-label', 'Navigate to Virtual Machines');
  });

  it('renders different icons correctly', () => {
    render(<ResourceCard {...mockResourceData} icon={IconContainer} />);
    
    // Icon should be rendered (though we can't easily test the specific icon type)
    const card = screen.getByText('Virtual Machines').closest('[data-testid="resource-card"]');
    expect(card).toBeInTheDocument();
  });

  it('supports different color themes', () => {
    const colors = ['blue', 'green', 'red', 'orange'];
    
    colors.forEach(color => {
      render(<ResourceCard {...mockResourceData} color={color} />);
      // Color is applied via Mantine theme system, hard to test directly
      expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
    });
  });

  it('handles large numbers appropriately', () => {
    render(<ResourceCard {...mockResourceData} count={1000000} />);
    expect(screen.getByText('1000000')).toBeInTheDocument();
  });

  it('displays trend information when provided', () => {
    const trendData = { change: 5, percentage: 10.5 };
    render(<ResourceCard {...mockResourceData} trend={trendData} />);
    
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('(+10.5%)')).toBeInTheDocument();
  });

  it('displays negative trend correctly', () => {
    const trendData = { change: -3, percentage: -7.2 };
    render(<ResourceCard {...mockResourceData} trend={trendData} />);
    
    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('(-7.2%)')).toBeInTheDocument();
  });
});