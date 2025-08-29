/**
 * Authentication E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByText('Welcome to Proxmox-MPC')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Proxmox Server')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByText('Proxmox server URL is required')).toBeVisible();
  });

  test('should validate server URL format', async ({ page }) => {
    await page.goto('/');
    
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('password123');
    await page.getByLabel('Proxmox Server').fill('invalid-url');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText('Please enter a valid URL')).toBeVisible();
  });

  test('should handle login with valid credentials', async ({ page }) => {
    // Mock successful login response
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'user-123',
              username: 'testuser',
              email: 'test@example.com',
              role: 'admin',
              proxmoxServer: 'https://proxmox.example.com'
            }
          }
        })
      });
    });

    await page.goto('/');
    
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('password123');
    await page.getByLabel('Proxmox Server').fill('https://proxmox.example.com');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Infrastructure Overview')).toBeVisible();
  });

  test('should handle login failure', async ({ page }) => {
    // Mock failed login response
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Invalid credentials'
        })
      });
    });

    await page.goto('/');
    
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByLabel('Proxmox Server').fill('https://proxmox.example.com');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should show loading state during login', async ({ page }) => {
    // Mock slow login response
    await page.route('**/api/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'user-123',
              username: 'testuser'
            }
          }
        })
      });
    });

    await page.goto('/');
    
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('password123');
    await page.getByLabel('Proxmox Server').fill('https://proxmox.example.com');
    
    const submitPromise = page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    await submitPromise;
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Username')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Proxmox Server')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Remember me')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeFocused();
  });

  test('should handle remember me functionality', async ({ page }) => {
    await page.goto('/');
    
    const rememberCheckbox = page.getByLabel('Remember me');
    await expect(rememberCheckbox).not.toBeChecked();
    
    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();
    
    await rememberCheckbox.uncheck();
    await expect(rememberCheckbox).not.toBeChecked();
  });

  test('should logout successfully', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'user-123',
        username: 'testuser',
        role: 'admin'
      }));
    });

    // Mock logout API
    await page.route('**/api/auth/logout', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/dashboard');
    
    // Click user menu and logout
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByText('Logout').click();
    
    // Should redirect to login
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Welcome to Proxmox-MPC')).toBeVisible();
  });
});