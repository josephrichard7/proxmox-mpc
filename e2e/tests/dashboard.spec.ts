/**
 * Dashboard E2E Tests
 */

import { test, expect } from '@playwright/test';

// Helper function to setup authenticated state
async function setupAuth(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'user-123',
      username: 'testuser',
      role: 'admin',
      proxmoxServer: 'https://proxmox.example.com'
    }));
  });

  // Mock dashboard data
  await page.route('**/api/vms*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          vms: [
            { id: 100, name: 'web-01', status: 'running' },
            { id: 101, name: 'db-01', status: 'stopped' },
            { id: 102, name: 'test-01', status: 'running' }
          ],
          pagination: { total: 3 }
        }
      })
    });
  });

  await page.route('**/api/containers*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          containers: [
            { id: 200, name: 'proxy-01', status: 'running' },
            { id: 201, name: 'cache-01', status: 'running' }
          ],
          pagination: { total: 2 }
        }
      })
    });
  });

  await page.route('**/api/nodes*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          nodes: [
            {
              node: 'pve',
              status: 'online',
              uptime: 3600000,
              cpu: 0.25,
              memory: { used: 8589934592, total: 17179869184 },
              storage: { used: 107374182400, total: 214748364800 }
            }
          ]
        }
      })
    });
  });
}

test.describe('Dashboard', () => {
  test('should display infrastructure overview', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Check main title
    await expect(page.getByText('Infrastructure Overview')).toBeVisible();
    
    // Check resource cards
    await expect(page.getByText('Virtual Machines')).toBeVisible();
    await expect(page.getByText('3')).toBeVisible(); // VM count
    
    await expect(page.getByText('Containers')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible(); // Container count
    
    await expect(page.getByText('Cluster Nodes')).toBeVisible();
    await expect(page.getByText('1')).toBeVisible(); // Node count
  });

  test('should display resource cards with correct status breakdown', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // VM status breakdown
    const vmCard = page.locator('[data-testid="vm-resource-card"]');
    await expect(vmCard.getByText('2 Running')).toBeVisible();
    await expect(vmCard.getByText('1 Stopped')).toBeVisible();
    
    // Container status breakdown  
    const containerCard = page.locator('[data-testid="container-resource-card"]');
    await expect(containerCard.getByText('2 Running')).toBeVisible();
  });

  test('should navigate to VMs page when VM card is clicked', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Click on VM resource card
    await page.locator('[data-testid="vm-resource-card"]').click();
    
    // Should navigate to VMs page
    await expect(page).toHaveURL('/vms');
    await expect(page.getByText('Virtual Machines')).toBeVisible();
  });

  test('should navigate to containers page when container card is clicked', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Click on container resource card
    await page.locator('[data-testid="container-resource-card"]').click();
    
    // Should navigate to containers page
    await expect(page).toHaveURL('/containers');
  });

  test('should display quick actions panel', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Check quick action buttons
    await expect(page.getByRole('button', { name: 'Create VM' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Container' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync Infrastructure' })).toBeVisible();
  });

  test('should trigger infrastructure sync from dashboard', async ({ page }) => {
    await setupAuth(page);
    
    // Mock sync API
    await page.route('**/api/infrastructure/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Infrastructure sync started'
        })
      });
    });

    await page.goto('/dashboard');
    
    // Click sync infrastructure button
    await page.getByRole('button', { name: 'Sync Infrastructure' }).click();
    
    // Should show confirmation dialog
    await expect(page.getByText('Sync Infrastructure')).toBeVisible();
    await expect(page.getByText('This will discover and sync all resources from your Proxmox server')).toBeVisible();
    
    // Confirm sync
    await page.getByRole('button', { name: 'Start Sync' }).click();
    
    // Should show success message
    await expect(page.getByText('Infrastructure sync started')).toBeVisible();
  });

  test('should display cluster node status', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Check node status section
    await expect(page.getByText('Cluster Status')).toBeVisible();
    await expect(page.getByText('pve')).toBeVisible();
    await expect(page.getByText('Online')).toBeVisible();
    
    // Check resource utilization
    await expect(page.getByText('CPU: 25%')).toBeVisible();
    await expect(page.getByText('Memory: 50%')).toBeVisible(); // 8GB / 16GB
    await expect(page.getByText('Storage: 50%')).toBeVisible(); // 100GB / 200GB
  });

  test('should show performance metrics charts', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Check for performance charts section
    await expect(page.getByText('Performance Metrics')).toBeVisible();
    
    // Check for chart containers (charts may be implemented with Canvas or SVG)
    await expect(page.locator('[data-testid="cpu-usage-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-usage-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-usage-chart"]')).toBeVisible();
  });

  test('should display recent operations', async ({ page }) => {
    await setupAuth(page);
    
    // Mock recent operations
    await page.route('**/api/operations/recent', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            operations: [
              {
                id: 'op-1',
                type: 'vm_start',
                resource: 'web-01',
                status: 'completed',
                timestamp: new Date().toISOString(),
                user: 'testuser'
              },
              {
                id: 'op-2',
                type: 'container_stop',
                resource: 'proxy-01',
                status: 'completed',
                timestamp: new Date(Date.now() - 300000).toISOString(),
                user: 'testuser'
              }
            ]
          }
        })
      });
    });

    await page.goto('/dashboard');
    
    // Check recent operations section
    await expect(page.getByText('Recent Operations')).toBeVisible();
    await expect(page.getByText('Started VM web-01')).toBeVisible();
    await expect(page.getByText('Stopped container proxy-01')).toBeVisible();
    await expect(page.getByText('Completed')).toHaveCount(2);
  });

  test('should handle real-time updates via WebSocket', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Simulate WebSocket event for VM status change
    await page.evaluate(() => {
      // Simulate receiving WebSocket event
      window.dispatchEvent(new CustomEvent('websocket-vm-status-update', {
        detail: {
          vmId: 101,
          status: 'running'
        }
      }));
    });
    
    // VM count should update (1 stopped -> 0 stopped, 2 running -> 3 running)
    await expect(page.getByText('3 Running')).toBeVisible();
    await expect(page.getByText('0 Stopped')).toBeVisible();
  });

  test('should show alert notifications for resource thresholds', async ({ page }) => {
    await setupAuth(page);
    
    // Mock node with high resource usage
    await page.route('**/api/nodes*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            nodes: [
              {
                node: 'pve',
                status: 'online',
                cpu: 0.95, // 95% CPU usage - should trigger alert
                memory: { used: 15032385536, total: 17179869184 }, // 87% memory
                storage: { used: 193273528320, total: 214748364800 } // 90% storage
              }
            ]
          }
        })
      });
    });

    await page.goto('/dashboard');
    
    // Should show resource threshold alerts
    await expect(page.getByText('High CPU Usage Alert')).toBeVisible();
    await expect(page.getByText('Memory usage is at 87%')).toBeVisible();
    await expect(page.getByText('Storage usage is at 90%')).toBeVisible();
  });

  test('should support keyboard navigation on dashboard', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Tab through dashboard elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="vm-resource-card"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="container-resource-card"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="nodes-resource-card"]')).toBeFocused();
    
    // Enter should navigate to respective page
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/nodes');
  });

  test('should handle dashboard loading states', async ({ page }) => {
    await setupAuth(page);
    
    // Mock slow API responses
    await page.route('**/api/vms*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { vms: [], pagination: { total: 0 } }
        })
      });
    });

    await page.goto('/dashboard');
    
    // Should show loading skeletons or spinners
    await expect(page.locator('[data-testid="resource-card-loading"]')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await setupAuth(page);
    
    // Mock API errors
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

    await page.goto('/dashboard');
    
    // Should show error states in resource cards
    await expect(page.getByText('Unable to load VMs')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/dashboard');
    
    // Wait for initial load
    await expect(page.getByText('3')).toBeVisible(); // VM count
    
    // Mock updated data
    await page.route('**/api/vms*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            vms: [
              { id: 100, name: 'web-01', status: 'running' },
              { id: 101, name: 'db-01', status: 'running' }, // Changed from stopped
              { id: 102, name: 'test-01', status: 'running' },
              { id: 103, name: 'new-vm', status: 'running' } // New VM
            ],
            pagination: { total: 4 }
          }
        })
      });
    });
    
    // Click refresh button
    await page.getByRole('button', { name: 'Refresh' }).click();
    
    // Should show updated count
    await expect(page.getByText('4')).toBeVisible(); // Updated VM count
    await expect(page.getByText('4 Running')).toBeVisible(); // All running now
  });
});