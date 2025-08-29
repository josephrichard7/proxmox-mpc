/**
 * LoginPage Component Tests
 */

import { render, screen, waitFor } from '@/test/test-utils';
import { LoginPage } from '../LoginPage';
import * as AuthService from '@/services/AuthService';

// Mock AuthService
vi.mock('@/services/AuthService', () => ({
  login: vi.fn(),
}));

const mockLogin = vi.mocked(AuthService.login);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all required fields', () => {
    render(<LoginPage />, { authenticated: false });
    
    expect(screen.getByText('Welcome to Proxmox-MPC')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/proxmox server/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const { user } = render(<LoginPage />, { authenticated: false });
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Proxmox server URL is required')).toBeInTheDocument();
    });
  });

  it('validates server URL format', async () => {
    const { user } = render(<LoginPage />, { authenticated: false });
    
    const serverInput = screen.getByLabelText(/proxmox server/i);
    await user.type(serverInput, 'invalid-url');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    mockLogin.mockResolvedValueOnce({
      success: true,
      data: { token: 'mock-token', user: {} }
    });

    const { user } = render(<LoginPage />, { authenticated: false });
    
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/proxmox server/i), 'https://proxmox.example.com');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
        server: 'https://proxmox.example.com'
      });
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } }
    });

    const { user } = render(<LoginPage />, { authenticated: false });
    
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.type(screen.getByLabelText(/proxmox server/i), 'https://proxmox.example.com');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const { user } = render(<LoginPage />, { authenticated: false });
    
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/proxmox server/i), 'https://proxmox.example.com');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles remember me checkbox', async () => {
    const { user } = render(<LoginPage />, { authenticated: false });
    
    const rememberCheckbox = screen.getByLabelText(/remember me/i);
    expect(rememberCheckbox).not.toBeChecked();
    
    await user.click(rememberCheckbox);
    expect(rememberCheckbox).toBeChecked();
  });

  it('provides accessible form labels and structure', () => {
    render(<LoginPage />, { authenticated: false });
    
    const form = screen.getByRole('form');
    expect(form).toBeInTheDocument();
    
    // Check that all form inputs are properly labeled
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/proxmox server/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
  });

  it('redirects when user is already authenticated', () => {
    render(<LoginPage />, { authenticated: true });
    
    // Should not show login form when authenticated
    expect(screen.queryByText('Welcome to Proxmox-MPC')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const { user } = render(<LoginPage />, { authenticated: false });
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const serverInput = screen.getByLabelText(/proxmox server/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Tab through form elements
    await user.tab();
    expect(usernameInput).toHaveFocus();
    
    await user.tab();
    expect(passwordInput).toHaveFocus();
    
    await user.tab();
    expect(serverInput).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/remember me/i)).toHaveFocus();
    
    await user.tab();
    expect(submitButton).toHaveFocus();
  });
});