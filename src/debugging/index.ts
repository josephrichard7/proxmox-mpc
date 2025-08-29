/**
 * Autonomous Web Application Debugging System - Main Export
 *
 * Central export point for the autonomous debugging system
 * Provides easy access to all debugging components and utilities
 */

// Core system
export { AutonomousWebDebugger } from "./autonomous-debugger";
export { AutonomousDebuggingCoordinator } from "./coordinator";
export { AutonomousDebuggingWorkflow } from "./workflows/autonomous-workflow";

// Agents
export { UIInspectorAgent } from "./agents/ui-inspector";
export { BackendMonitorAgent } from "./agents/backend-monitor";

// Types and interfaces
export * from "./types";

// Utility functions for creating common debugging contexts
export class DebuggerUtils {
  /**
   * Create a standard web application debugging context
   */
  static createWebAppContext(options: {
    frontendUrl: string;
    backendUrl?: string;
    apiUrl?: string;
    includeUI?: boolean;
    includeBackend?: boolean;
    includePerformance?: boolean;
    includeNetwork?: boolean;
  }) {
    return {
      applicationUrls: {
        frontend: options.frontendUrl,
        backend:
          options.backendUrl || options.frontendUrl.replace("3001", "3000"),
        api: options.apiUrl,
      },
      monitoringScope: {
        includeUI: options.includeUI !== false,
        includeBackend: options.includeBackend !== false,
        includeNetwork: options.includeNetwork !== false,
        includePerformance: options.includePerformance !== false,
      },
      thresholds: {
        responseTime: 3000, // 3 seconds
        errorRate: 5, // 5%
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        loadTime: 5000, // 5 seconds
      },
      userWorkflows: [],
    };
  }

  /**
   * Create a development debugging configuration
   */
  static createDevConfiguration() {
    return {
      enabled: true,
      mode: "continuous" as const,
      agentConfiguration: {
        "ui-inspector": { enabled: true, config: {} },
        "backend-monitor": { enabled: true, config: {} },
        planner: { enabled: true, config: {} },
        validator: { enabled: true, config: {} },
        documenter: { enabled: false, config: {} }, // Less noise in dev
      },
      monitoring: {
        interval: 15000, // 15 seconds for faster feedback
        batchSize: 50,
        retentionPeriod: 12, // 12 hours for dev
      },
      thresholds: {
        responseTime: 5000, // More lenient for dev
        errorRate: 10, // 10% for dev environments
        cpuUsage: 90,
        memoryUsage: 90,
        loadTime: 8000,
      },
      notifications: {
        enabled: true,
        channels: ["console"],
        severity: ["critical", "high"],
      },
    };
  }

  /**
   * Create a production debugging configuration
   */
  static createProductionConfiguration() {
    return {
      enabled: true,
      mode: "incident" as const, // Only activate on issues
      agentConfiguration: {
        "ui-inspector": { enabled: true, config: {} },
        "backend-monitor": { enabled: true, config: {} },
        planner: { enabled: true, config: {} },
        validator: { enabled: true, config: {} },
        documenter: { enabled: true, config: {} },
      },
      monitoring: {
        interval: 60000, // 1 minute for production
        batchSize: 100,
        retentionPeriod: 72, // 3 days
      },
      thresholds: {
        responseTime: 2000, // Strict for production
        errorRate: 2, // 2% max error rate
        cpuUsage: 70,
        memoryUsage: 75,
        loadTime: 3000,
      },
      notifications: {
        enabled: true,
        channels: ["console", "websocket"],
        severity: ["critical", "high", "medium"],
      },
    };
  }

  /**
   * Create common user workflows for web applications
   */
  static createCommonUserWorkflows(baseUrl: string) {
    return [
      {
        id: "login-flow",
        name: "User Login Flow",
        description: "Critical user authentication workflow",
        criticalPath: true,
        steps: [
          { action: "navigate" as const, target: `${baseUrl}/login` },
          { action: "verify" as const, expected: "login-form-visible" },
          { action: "type" as const, target: "#username", value: "testuser" },
          { action: "type" as const, target: "#password", value: "testpass" },
          { action: "click" as const, target: "#login-button" },
          {
            action: "verify" as const,
            expected: "dashboard-loaded",
            timeout: 10000,
          },
        ],
      },
      {
        id: "dashboard-load",
        name: "Dashboard Load",
        description: "Main dashboard loading workflow",
        criticalPath: true,
        steps: [
          { action: "navigate" as const, target: `${baseUrl}/dashboard` },
          {
            action: "verify" as const,
            expected: "dashboard-components-loaded",
          },
          { action: "wait" as const, value: "2000" },
          { action: "verify" as const, expected: "no-critical-errors" },
        ],
      },
      {
        id: "navigation-test",
        name: "Navigation Test",
        description: "Test primary navigation paths",
        criticalPath: false,
        steps: [
          { action: "navigate" as const, target: baseUrl },
          { action: "verify" as const, expected: "home-page-loaded" },
          { action: "click" as const, target: "nav-about" },
          { action: "verify" as const, expected: "about-page-loaded" },
          { action: "click" as const, target: "nav-home" },
          { action: "verify" as const, expected: "home-page-loaded" },
        ],
      },
    ];
  }

  /**
   * Validate debugging configuration
   */
  static validateConfiguration(config: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.enabled && config.enabled !== false) {
      errors.push("Configuration must specify enabled: boolean");
    }

    if (
      !config.mode ||
      !["continuous", "incident", "proactive", "validation"].includes(
        config.mode,
      )
    ) {
      errors.push(
        "Configuration must specify valid mode: continuous|incident|proactive|validation",
      );
    }

    if (!config.thresholds) {
      errors.push("Configuration must include thresholds");
    } else {
      if (typeof config.thresholds.responseTime !== "number") {
        errors.push("thresholds.responseTime must be a number");
      }
      if (typeof config.thresholds.errorRate !== "number") {
        errors.push("thresholds.errorRate must be a number");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create Playwright MCP integration helpers
   */
  static createPlaywrightHelpers() {
    return {
      /**
       * Generate Playwright automation script for user workflow
       */
      generatePlaywrightScript(workflow: any): string {
        const steps = workflow.steps
          .map((step: any) => {
            switch (step.action) {
              case "navigate":
                return `await page.goto('${step.target}');`;
              case "click":
                return `await page.click('${step.target}');`;
              case "type":
                return `await page.type('${step.target}', '${step.value}');`;
              case "wait":
                return `await page.waitForTimeout(${step.value});`;
              case "verify":
                return `// Verify: ${step.expected}`;
              default:
                return `// Unknown action: ${step.action}`;
            }
          })
          .join("\n  ");

        return `
// Generated Playwright script for workflow: ${workflow.name}
const { test, expect } = require('@playwright/test');

test('${workflow.name}', async ({ page }) => {
  ${steps}
});
        `.trim();
      },

      /**
       * Create browser configuration for different scenarios
       */
      getBrowserConfig(scenario: "development" | "testing" | "production") {
        const configs = {
          development: {
            headless: false,
            slowMo: 1000,
            viewport: { width: 1920, height: 1080 },
            timeout: 30000,
          },
          testing: {
            headless: true,
            slowMo: 0,
            viewport: { width: 1920, height: 1080 },
            timeout: 15000,
          },
          production: {
            headless: true,
            slowMo: 0,
            viewport: { width: 1920, height: 1080 },
            timeout: 10000,
          },
        };

        return configs[scenario];
      },
    };
  }
}
