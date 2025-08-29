/**
 * Integration tests for autonomous debugging system
 */

import { DebuggerUtils } from "../";

describe("DebuggerUtils", () => {
  describe("Configuration Creation", () => {
    it("should create development configuration", () => {
      const config = DebuggerUtils.createDevConfiguration();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe("continuous");
      expect(config.monitoring.interval).toBe(15000);
      expect(config.notifications.channels).toContain("console");
    });

    it("should create production configuration", () => {
      const config = DebuggerUtils.createProductionConfiguration();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe("incident");
      expect(config.monitoring.interval).toBe(60000);
      expect(config.thresholds.responseTime).toBe(2000);
    });

    it("should validate valid configuration", () => {
      const validConfig = DebuggerUtils.createDevConfiguration();
      const result = DebuggerUtils.validateConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid configuration", () => {
      const invalidConfig = {
        enabled: "invalid" as any,
        mode: "unknown" as any,
      };
      const result = DebuggerUtils.validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Context Creation", () => {
    it("should create web app context with defaults", () => {
      const context = DebuggerUtils.createWebAppContext({
        frontendUrl: "http://localhost:3001",
      });

      expect(context.applicationUrls.frontend).toBe("http://localhost:3001");
      expect(context.applicationUrls.backend).toBe("http://localhost:3000");
      expect(context.monitoringScope.includeUI).toBe(true);
      expect(context.monitoringScope.includeBackend).toBe(true);
    });

    it("should create context with custom options", () => {
      const context = DebuggerUtils.createWebAppContext({
        frontendUrl: "http://localhost:3001",
        backendUrl: "http://localhost:8080",
        includeUI: false,
      });

      expect(context.applicationUrls.backend).toBe("http://localhost:8080");
      expect(context.monitoringScope.includeUI).toBe(false);
    });
  });

  describe("Workflow Creation", () => {
    it("should create common user workflows", () => {
      const workflows = DebuggerUtils.createCommonUserWorkflows(
        "http://localhost:3001",
      );

      expect(workflows).toBeInstanceOf(Array);
      expect(workflows.length).toBeGreaterThan(0);

      const loginFlow = workflows.find((w) => w.id === "login-flow");
      expect(loginFlow).toBeDefined();
      expect(loginFlow?.steps.length).toBeGreaterThan(0);
    });
  });

  describe("Playwright Integration", () => {
    it("should generate Playwright script for workflow", () => {
      const workflow = {
        name: "Test Workflow",
        steps: [
          { action: "navigate", target: "http://localhost:3001" },
          { action: "click", target: "#button" },
          { action: "type", target: "#input", value: "test" },
          { action: "wait", value: "1000" },
        ],
      };

      const helpers = DebuggerUtils.createPlaywrightHelpers();
      const script = helpers.generatePlaywrightScript(workflow);

      expect(script).toContain("await page.goto('http://localhost:3001')");
      expect(script).toContain("await page.click('#button')");
      expect(script).toContain("await page.type('#input', 'test')");
      expect(script).toContain("await page.waitForTimeout(1000)");
    });

    it("should provide browser configuration for different scenarios", () => {
      const helpers = DebuggerUtils.createPlaywrightHelpers();

      const devConfig = helpers.getBrowserConfig("development");
      const prodConfig = helpers.getBrowserConfig("production");

      expect(devConfig.headless).toBe(false);
      expect(prodConfig.headless).toBe(true);
      expect(devConfig.timeout).toBeGreaterThan(prodConfig.timeout);
    });
  });
});
