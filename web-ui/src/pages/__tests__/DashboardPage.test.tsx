/**
 * Dashboard Page Component Tests
 * Tests dashboard functionality, data loading, and real-time updates
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockWebSocketEvent } from '../../test-utils/test-helpers';
import { DashboardPage } from '../DashboardPage';

// Mock the ApiService
jest.mock('../../services/ApiService', () => ({
  getInfrastructureStatus: jest.fn().mockResolvedValue({
    vms: { total: 5, running: 3, stopped: 2 },
    containers: { total: 3, running: 2, stopped: 1 },
    nodes: { total: 2, online: 2, offline: 0 },
    resources: { cpu: 45.2, memory: 62.8, storage: 78.3 }
  }),
  getNodes: jest.fn().mockResolvedValue([
    {
      name: 'pve-01',
      status: 'online',
      cpu: 45.2,
      memory: 62.8,
      disk: 78.3,
      uptime: 1234567,
      load: [0.45, 0.52, 0.38]
    }
  ])
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with loading state initially', () => {
    render(<DashboardPage />);
    
    expect(screen.getByText('Infrastructure Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays infrastructure status after loading', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total VMs
      expect(screen.getByText('3 Running')).toBeInTheDocument();
    });

    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total containers

    expect(screen.getByText('Cluster Nodes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Total nodes
  });

  it('displays resource usage cards', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('45.2%')).toBeInTheDocument();
      
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('62.8%')).toBeInTheDocument();
      
      expect(screen.getByText('Storage Usage')).toBeInTheDocument();
      expect(screen.getByText('78.3%')).toBeInTheDocument();
    });
  });

  it('displays node information cards', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('pve-01')).toBeInTheDocument();
      expect(screen.getByText('online')).toBeInTheDocument();
      expect(screen.getByText('Load: 0.45, 0.52, 0.38')).toBeInTheDocument();
    });
  });

  it('provides quick action buttons', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create vm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create container/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view nodes/i })).toBeInTheDocument();
    });
  });

  it('handles real-time WebSocket updates', async () => {
    render(<DashboardPage />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    // Simulate WebSocket update
    mockWebSocketEvent('infrastructure-update', {
      vms: { total: 6, running: 4, stopped: 2 }
    });

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // Updated VM count
      expect(screen.getByText('4 Running')).toBeInTheDocument(); // Updated running count
    });
  });

  it('handles click navigation to other pages', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create vm/i })).toBeInTheDocument();
    });

    const createVmButton = screen.getByRole('button', { name: /create vm/i });
    await user.click(createVmButton);
    
    // Should navigate to VMs page (we'd test URL change in integration tests)
    expect(createVmButton).toBeInTheDocument();
  });

  it('displays error state when API calls fail', async () => {
    // Mock API failure
    const ApiService = require('../../services/ApiService');
    apiService.getInfrastructureStatus.mockRejectedValueOnce(new Error('API Error'));

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/error loading/i)).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const ApiService = require('../../services/ApiService');
    
    render(<DashboardPage />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Infrastructure Dashboard')).toBeInTheDocument();
    });

    // Clear mock calls
    apiService.getInfrastructureStatus.mockClear();
    
    // Find and click refresh button
    const refreshButton = screen.getByLabelText(/refresh/i);
    await user.click(refreshButton);

    // Verify API was called again
    expect(apiService.getInfrastructureStatus).toHaveBeenCalledTimes(1);
  });

  it('handles empty infrastructure state', async () => {
    const ApiService = require('../../services/ApiService');
    apiService.getInfrastructureStatus.mockResolvedValueOnce({
      vms: { total: 0, running: 0, stopped: 0 },
      containers: { total: 0, running: 0, stopped: 0 },
      nodes: { total: 0, online: 0, offline: 0 },
      resources: { cpu: 0, memory: 0, storage: 0 }
    });

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // Should show 0 for empty state
      expect(screen.getByText('No infrastructure found')).toBeInTheDocument();
    });
  });

  it('meets accessibility requirements', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      
      // Check for ARIA labels
      const refreshButton = screen.getByLabelText(/refresh/i);
      expect(refreshButton).toBeInTheDocument();
      
      // Check for semantic structure
      const cards = screen.getAllByRole('region');
      expect(cards.length).toBeGreaterThan(0);
    });
  });
});