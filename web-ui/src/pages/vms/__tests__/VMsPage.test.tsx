/**
 * VMsPage Component Tests
 */

import { render, screen, waitFor, within } from '@/test/test-utils';
import { QueryClient } from '@tanstack/react-query';
import { VMsPage } from '../VMsPage';
import * as ApiService from '@/services/ApiService';
import { mockVMResponse, createTestQueryClient } from '@/test/test-utils';

// Mock ApiService
vi.mock('@/services/ApiService', () => ({
  vms: {
    getVMs: vi.fn(),
    startVM: vi.fn(),
    stopVM: vi.fn(),
    restartVM: vi.fn(),
    deleteVM: vi.fn(),
  }
}));

const mockApiService = vi.mocked(apiService.vms);

describe('VMsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockapiService.getVMs.mockResolvedValue(mockVMResponse);
  });

  it('renders VM list page with correct structure', async () => {
    render(<VMsPage />, { queryClient });
    
    expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create vm/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search vms/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
      expect(screen.getByText('test-vm-02')).toBeInTheDocument();
    });
  });

  it('displays VM data in table format', async () => {
    render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Check table headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('CPU')).toBeInTheDocument();
      
      // Check VM data
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
      expect(screen.getByText('2048 MB')).toBeInTheDocument();
      expect(screen.getByText('2 cores')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockapiService.getVMs.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<VMsPage />, { queryClient });
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockapiService.getVMs.mockRejectedValue(new Error('API Error'));
    render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load vms/i)).toBeInTheDocument();
    });
  });

  it('filters VMs based on search input', async () => {
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
      expect(screen.getByText('test-vm-02')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/search vms/i);
    await user.type(searchInput, 'test-vm-01');
    
    await waitFor(() => {
      expect(mockapiService.getVMs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'test-vm-01'
        })
      );
    });
  });

  it('handles VM actions correctly', async () => {
    mockapiService.startVM.mockResolvedValue({ success: true });
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-02')).toBeInTheDocument();
    });
    
    // Find the stopped VM row and click start button
    const stoppedVmRow = screen.getByText('test-vm-02').closest('tr');
    expect(stoppedVmRow).toBeInTheDocument();
    
    const startButton = within(stoppedVmRow!).getByRole('button', { name: /start/i });
    await user.click(startButton);
    
    await waitFor(() => {
      expect(mockapiService.startVM).toHaveBeenCalledWith(101);
    });
  });

  it('shows confirmation dialog for VM deletion', async () => {
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
    });
    
    // Find VM row and click delete button
    const vmRow = screen.getByText('test-vm-01').closest('tr');
    const deleteButton = within(vmRow!).getByRole('button', { name: /delete/i });
    await user.click(deleteButton);
    
    // Should show confirmation modal
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete test-vm-01?')).toBeInTheDocument();
  });

  it('supports pagination', async () => {
    const paginatedResponse = {
      ...mockVMResponse,
      data: {
        ...mockVMResponse.data,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3
        }
      }
    };
    mockapiService.getVMs.mockResolvedValue(paginatedResponse);
    
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(mockapiService.getVMs).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2
        })
      );
    });
  });

  it('opens create VM modal', async () => {
    const { user } = render(<VMsPage />, { queryClient });
    
    const createButton = screen.getByRole('button', { name: /create vm/i });
    await user.click(createButton);
    
    expect(screen.getByText('Create Virtual Machine')).toBeInTheDocument();
  });

  it('supports sorting by different columns', async () => {
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
    });
    
    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);
    
    await waitFor(() => {
      expect(mockapiService.getVMs).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc'
        })
      );
    });
  });

  it('provides accessible VM status information', async () => {
    render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      const runningStatus = screen.getByLabelText('Status: Running');
      const stoppedStatus = screen.getByLabelText('Status: Stopped');
      
      expect(runningStatus).toBeInTheDocument();
      expect(stoppedStatus).toBeInTheDocument();
    });
  });

  it('shows VM resource usage indicators', async () => {
    render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      // Check for CPU usage display
      expect(screen.getByText('12.5%')).toBeInTheDocument(); // CPU usage
      // Check for memory usage
      expect(screen.getByText('1.0 GB')).toBeInTheDocument(); // Memory usage
    });
  });

  it('supports keyboard navigation for VM actions', async () => {
    const { user } = render(<VMsPage />, { queryClient });
    
    await waitFor(() => {
      expect(screen.getByText('test-vm-01')).toBeInTheDocument();
    });
    
    // Tab to first VM action button
    await user.tab();
    const actionButton = screen.getAllByRole('button')[0];
    expect(actionButton).toHaveFocus();
    
    // Enter should activate the button
    await user.keyboard('{Enter}');
    // Button action should be triggered
  });
});