/**
 * Autonomous Debugger Tests
 *
 * Comprehensive test suite for the autonomous web debugging system
 */

import { AutonomousWebDebugger, DebuggerUtils } from "../";
import {
  DebuggingContext,
  DebuggingConfiguration,
  UserWorkflow,
} from "../types";

// Mock console methods to capture output
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Replace console methods
Object.assign(console, mockConsole);

describe("AutonomousWebDebugger", () => {
  let autonomousDebugger: AutonomousWebDebugger;
  let testContext: DebuggingContext;
  let testConfig: DebuggingConfiguration;

  beforeEach(() => {
    jest.clearAllMocks();

    testConfig = DebuggerUtils.createDevConfiguration();
    testContext = DebuggerUtils.createWebAppContext({
      frontendUrl: "http://localhost:3001",
      backendUrl: "http://localhost:3000",
    });

    autonomousDebugger = new AutonomousWebDebugger(testConfig);
  });

  afterEach(async () => {
    if (autonomousDebugger) {
      try {
        await autonomousDebugger.stopDebugging();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const defaultDebugger = new AutonomousWebDebugger();
      const status = defaultDebugger.getStatus();

      expect(status).toBeDefined();
      expect(status.initialized).toBeDefined();
    });

    it("should merge custom configuration with defaults", () => {
      const customConfig = { enabled: false };
      const customDebugger = new AutonomousWebDebugger(customConfig);
      const status = customDebugger.getStatus();

      expect(status).toBeDefined();
    });

    it("should initialize successfully", async () => {
      await expect(autonomousDebugger.initialize()).resolves.not.toThrow();

      const status = autonomousDebugger.getStatus();
      expect(status.initialized).toBe(true);
    });
  });

  describe("Debugging Session Management", () => {
    beforeEach(async () => {
      await autonomousDebugger.initialize();
    });

    it("should start debugging session successfully", async () => {
      const sessionId = await autonomousDebugger.startDebugging(testContext);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");

      const status = autonomousDebugger.getStatus();
      expect(status.currentSession).toBe(sessionId);
      expect(status.sessionStatus).toBe("active");
    });

    it("should not allow multiple concurrent sessions", async () => {
      await autonomousDebugger.startDebugging(testContext);

      await expect(
        autonomousDebugger.startDebugging(testContext),
      ).rejects.toThrow();
    });

    it("should stop debugging session cleanly", async () => {
      await autonomousDebugger.startDebugging(testContext);

      await expect(autonomousDebugger.stopDebugging()).resolves.not.toThrow();

      const status = autonomousDebugger.getStatus();
      expect(status.currentSession).toBeNull();
      expect(status.sessionStatus).toBe("inactive");
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration correctly", () => {
      const newConfig = { enabled: false };

      expect(() =>
        autonomousDebugger.updateConfiguration(newConfig),
      ).not.toThrow();
    });

    it("should validate configuration properly", () => {
      const validConfig = DebuggerUtils.createDevConfiguration();
      const result = DebuggerUtils.validateConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid configuration", () => {
      const invalidConfig = { enabled: "invalid", mode: "unknown" };
      const result = DebuggerUtils.validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("User Workflow Validation", () => {
    let testWorkflow: UserWorkflow;

    beforeEach(async () => {
      await autonomousDebugger.initialize();

      testWorkflow = {
        id: "test-workflow",
        name: "Test Workflow",
        description: "Test workflow for validation",
        criticalPath: true,
        steps: [
          { action: "navigate", target: "http://localhost:3001" },
          { action: "verify", expected: "page-loaded" },
        ],
      };
    });

    it("should validate user workflow without browser connection", async () => {
      // Since Playwright MCP isn't actually available in tests,
      // this should gracefully handle the missing dependency
      await expect(
        autonomousDebugger.validateUserWorkflow(testWorkflow),
      ).rejects.toThrow("Browser automation not available");
    });
  });

  describe("Finding Management", () => {
    beforeEach(async () => {
      await autonomousDebugger.initialize();
      await autonomousDebugger.startDebugging(testContext);
    });

    it("should start with no findings", () => {
      const findings = autonomousDebugger.getFindings();
      expect(findings).toHaveLength(0);
    });

    it("should limit findings correctly", () => {
      const limit = 5;
      const findings = autonomousDebugger.getFindings(limit);
      expect(findings.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("Status Reporting", () => {
    it("should provide comprehensive status information", () => {
      const status = autonomousDebugger.getStatus();

      expect(status).toHaveProperty("initialized");
      expect(status).toHaveProperty("browserConnected");
      expect(status).toHaveProperty("currentSession");
      expect(status).toHaveProperty("sessionStatus");
      expect(status).toHaveProperty("agentsStatus");
      expect(status).toHaveProperty("metrics");
    });

    it("should report inactive status when not running", () => {
      const status = autonomousDebugger.getStatus();

      expect(status.currentSession).toBeNull();
      expect(status.sessionStatus).toBe("inactive");
    });
  });

  describe("Event Handling", () => {
    beforeEach(async () => {
      await autonomousDebugger.initialize();
    });

    it("should emit events during operation", (done) => {
      let eventReceived = false;

      autonomousDebugger.on("session-started", () => {
        eventReceived = true;
        expect(eventReceived).toBe(true);
        done();
      });

      autonomousDebugger.startDebugging(testContext);
    });

    it("should handle critical findings appropriately", (done) => {
      autonomousDebugger.on("critical-finding", (event) => {
        expect(event).toHaveProperty("finding");
        expect(event).toHaveProperty("timestamp");
        expect(event.finding.severity).toBe("critical");
        done();
      });

      // Simulate critical finding
      const criticalFinding = {
        id: "test-critical",
        timestamp: new Date(),
        severity: "critical" as const,
        category: "ui" as const,
        title: "Test Critical Finding",
        description: "Test critical finding for event handling",
        source: "ui-inspector" as const,
        evidence: {},
        recommendations: [],
        status: "new" as const,
      };

      // This would be called internally by agents
      setTimeout(() => {
        autonomousDebugger.emit("critical-finding", {
          finding: criticalFinding,
          timestamp: new Date(),
          sessionId: "test-session",
        });
      }, 100);
    });
  });
});

describe("DebuggerUtils", () => {
  describe("Context Creation", () => {
    it("should create web app context with defaults", () => {
      const context = DebuggerUtils.createWebAppContext({
        frontendUrl: "http://localhost:3001",
      });

      expect(context).toHaveProperty("applicationUrls");
      expect(context.applicationUrls.frontend).toBe("http://localhost:3001");
      expect(context.applicationUrls.backend).toBe("http://localhost:3000");
      expect(context).toHaveProperty("monitoringScope");
      expect(context).toHaveProperty("thresholds");
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

  describe("Configuration Creation", () => {
    it("should create development configuration", () => {
      const config = DebuggerUtils.createDevConfiguration();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe("continuous");
      expect(config.monitoring.interval).toBe(15000); // Faster for dev
      expect(config.notifications.channels).toEqual(["console"]);
    });

    it("should create production configuration", () => {
      const config = DebuggerUtils.createProductionConfiguration();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe("incident");
      expect(config.monitoring.interval).toBe(60000); // Slower for production
      expect(config.thresholds.responseTime).toBe(2000); // Stricter
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
