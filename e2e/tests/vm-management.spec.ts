/**
 * VM Management E2E Tests
 */

import { test, expect } from '@playwright/test';

// Helper function to login
async function login(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'user-123',
      username: 'testuser',
      role: 'admin',
      proxmoxServer: 'https://proxmox.example.com'
    }));
  });

  // Mock VM data
  await page.route('**/api/vms*', async route => {
    const url = route.request().url();
    if (url.includes('/api/vms') && route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            vms: [
              {
                id: 100,
                name: 'web-server-01',
                description: 'Main web server',
                node: 'pve',
                status: 'running',
                template: false,
                memory: 4096,
                cores: 4,
                disk: 50,
                uptime: 86400,
                cpuUsage: 25.5,
                memoryUsage: 2048,
                tags: ['production', 'web'],
                startOnBoot: true,
                protection: false
              },
              {
                id: 101,
                name: 'database-01',
                description: 'Primary database server',
                node: 'pve',
                status: 'stopped',
                template: false,
                memory: 8192,
                cores: 8,
                disk: 100,
                uptime: 0,
                cpuUsage: 0,
                memoryUsage: 0,
                tags: ['production', 'database'],
                startOnBoot: false,
                protection: true
              }
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 2,
              totalPages: 1
            }
          }
        })
      });
    }
  });
}

test.describe('VM Management', () => {
  test('should display VM list with correct information', async ({ page }) => {
    await login(page);
    await page.goto('/vms');
    
    // Check page title and create button
    await expect(page.getByText('Virtual Machines')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create VM' })).toBeVisible();
    
    // Check search functionality
    await expect(page.getByPlaceholder('Search VMs...')).toBeVisible();
    
    // Check VM list table
    await expect(page.getByText('web-server-01')).toBeVisible();
    await expect(page.getByText('database-01')).toBeVisible();
    
    // Check status indicators
    await expect(page.getByText('Running')).toBeVisible();
    await expect(page.getByText('Stopped')).toBeVisible();
    
    // Check resource information
    await expect(page.getByText('4096 MB')).toBeVisible(); // Memory
    await expect(page.getByText('4 cores')).toBeVisible(); // CPU
  });

  test('should filter VMs using search', async ({ page }) => {
    await login(page);
    
    // Mock search response
    await page.route('**/api/vms?*search=web*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            vms: [
              {
                id: 100,
                name: 'web-server-01',
                description: 'Main web server',
                node: 'pve',
                status: 'running'
              }
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
          }
        })
      });
    });

    await page.goto('/vms');
    
    // Search for web server
    await page.getByPlaceholder('Search VMs...').fill('web');
    
    // Should show only web server
    await expect(page.getByText('web-server-01')).toBeVisible();
    await expect(page.getByText('database-01')).not.toBeVisible();
  });

  test('should start a stopped VM', async ({ page }) => {
    await login(page);
    
    // Mock start VM API
    await page.route('**/api/vms/101/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/vms');
    
    // Find the stopped VM (database-01) and click start
    const vmRow = page.locator('tr').filter({ hasText: 'database-01' });
    await vmRow.getByRole('button', { name: 'Start' }).click();
    
    // Should show confirmation or loading state
    await expect(page.getByText('Starting VM...')).toBeVisible();
  });

  test('should stop a running VM', async ({ page }) => {
    await login(page);
    
    // Mock stop VM API
    await page.route('**/api/vms/100/stop', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/vms');
    
    // Find the running VM (web-server-01) and click stop
    const vmRow = page.locator('tr').filter({ hasText: 'web-server-01' });
    await vmRow.getByRole('button', { name: 'Stop' }).click();
    
    // Should show confirmation dialog
    await expect(page.getByText('Confirm Action')).toBeVisible();
    await expect(page.getByText('Are you sure you want to stop web-server-01?')).toBeVisible();
    
    // Confirm stop
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    await expect(page.getByText('Stopping VM...')).toBeVisible();
  });

  test('should open VM creation modal', async ({ page }) => {
    await login(page);
    
    // Mock node list for VM creation
    await page.route('**/api/nodes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            nodes: [
              { node: 'pve', status: 'online' },
              { node: 'pve2', status: 'online' }
            ]
          }
        })
      });
    });

    await page.goto('/vms');
    
    // Click create VM button
    await page.getByRole('button', { name: 'Create VM' }).click();
    
    // Should show create VM modal
    await expect(page.getByText('Create Virtual Machine')).toBeVisible();
    await expect(page.getByLabel('VM Name')).toBeVisible();
    await expect(page.getByLabel('Node')).toBeVisible();
    await expect(page.getByLabel('Memory (MB)')).toBeVisible();
    await expect(page.getByLabel('CPU Cores')).toBeVisible();
    await expect(page.getByLabel('Disk Size (GB)')).toBeVisible();
  });

  test('should create a new VM', async ({ page }) => {
    await login(page);
    
    // Mock node list
    await page.route('**/api/nodes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            nodes: [{ node: 'pve', status: 'online' }]
          }
        })
      });
    });

    // Mock create VM API
    await page.route('**/api/vms', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              vm: {
                id: 102,
                name: 'test-vm-01',
                node: 'pve',
                memory: 2048,
                cores: 2,
                disk: 20
              }
            }
          })
        });
      }
    });

    await page.goto('/vms');
    
    // Open create VM modal
    await page.getByRole('button', { name: 'Create VM' }).click();
    
    // Fill form
    await page.getByLabel('VM Name').fill('test-vm-01');
    await page.getByLabel('Node').selectOption('pve');
    await page.getByLabel('Memory (MB)').fill('2048');
    await page.getByLabel('CPU Cores').fill('2');
    await page.getByLabel('Disk Size (GB)').fill('20');
    await page.getByLabel('Description').fill('Test VM for E2E testing');
    
    // Submit form
    await page.getByRole('button', { name: 'Create VM' }).click();
    
    // Should show success message
    await expect(page.getByText('VM created successfully')).toBeVisible();
    
    // Modal should close
    await expect(page.getByText('Create Virtual Machine')).not.toBeVisible();
  });

  test('should handle VM creation validation errors', async ({ page }) => {
    await login(page);
    await page.goto('/vms');
    
    // Open create VM modal
    await page.getByRole('button', { name: 'Create VM' }).click();
    
    // Try to submit empty form
    await page.getByRole('button', { name: 'Create VM' }).click();
    
    // Should show validation errors
    await expect(page.getByText('VM name is required')).toBeVisible();
    await expect(page.getByText('Node is required')).toBeVisible();
    await expect(page.getByText('Memory is required')).toBeVisible();
  });

  test('should show VM details on row click', async ({ page }) => {
    await login(page);
    
    // Mock VM details API
    await page.route('**/api/vms/100', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            vm: {
              id: 100,
              name: 'web-server-01',
              description: 'Main web server',
              node: 'pve',
              status: 'running',
              memory: 4096,
              cores: 4,
              disk: 50,
              uptime: 86400,
              cpuUsage: 25.5,
              memoryUsage: 2048,
              liveStatus: {
                cpu: 0.255,
                mem: 2147483648,
                maxmem: 4294967296,
                uptime: 86400
              }
            }
          }
        })
      });
    });

    await page.goto('/vms');
    
    // Click on VM row
    await page.getByText('web-server-01').click();
    
    // Should navigate to VM details page
    await expect(page).toHaveURL('/vms/100');
    await expect(page.getByText('VM Details')).toBeVisible();
    await expect(page.getByText('web-server-01')).toBeVisible();
    await expect(page.getByText('25.5% CPU Usage')).toBeVisible();
  });

  test('should handle protected VM deletion attempt', async ({ page }) => {
    await login(page);
    await page.goto('/vms');
    
    // Find protected VM (database-01) and try to delete
    const vmRow = page.locator('tr').filter({ hasText: 'database-01' });
    await vmRow.getByRole('button', { name: 'Delete' }).click();
    
    // Should show protection warning
    await expect(page.getByText('Cannot delete protected VM')).toBeVisible();
    await expect(page.getByText('This VM is protected from deletion')).toBeVisible();
  });

  test('should support keyboard navigation in VM list', async ({ page }) => {
    await login(page);
    await page.goto('/vms');
    
    // Tab to search box
    await page.keyboard.press('Tab');
    await expect(page.getByPlaceholder('Search VMs...')).toBeFocused();
    
    // Tab to create button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Create VM' })).toBeFocused();
    
    // Enter should open create modal
    await page.keyboard.press('Enter');
    await expect(page.getByText('Create Virtual Machine')).toBeVisible();
  });

  test('should show loading state while fetching VMs', async ({ page }) => {
    await login(page);
    
    // Mock slow VM loading
    await page.route('**/api/vms*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { vms: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }
        })
      });
    });

    await page.goto('/vms');
    
    // Should show loading spinner
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    await expect(page.getByText('Loading VMs...')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await login(page);
    
    // Mock API error
    await page.route('**/api/vms*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Failed to connect to Proxmox server'
        })
      });
    });

    await page.goto('/vms');
    
    // Should show error message
    await expect(page.getByText('Failed to load VMs')).toBeVisible();
    await expect(page.getByText('Failed to connect to Proxmox server')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});