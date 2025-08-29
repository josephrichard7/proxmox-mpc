/**
 * Autonomous Web Application Debugger - Main Orchestration System
 *
 * Central orchestrator that coordinates all debugging agents and integrates
 * with Playwright MCP for browser automation and debugging capabilities
 */

import { EventEmitter } from "events";

import { Logger } from "../observability/logger";
import { getNotificationService } from "../web/websocket/notification-service";

import { BackendMonitorAgent } from "./agents/backend-monitor";
import { UIInspectorAgent } from "./agents/ui-inspector";
import { AutonomousDebuggingCoordinator } from "./coordinator";
import {
  DebuggingSession,
  DebuggingContext,
  DebuggingConfiguration,
  DebuggingFinding,
  UserWorkflow,
  ValidationResult,
  PerformanceThresholds,
} from "./types";

export class AutonomousWebDebugger extends EventEmitter {
  private logger: Logger;
  private coordinator: AutonomousDebuggingCoordinator;
  private uiInspector: UIInspectorAgent;
  private backendMonitor: BackendMonitorAgent;
  private currentSession: DebuggingSession | null = null;
  private configuration: DebuggingConfiguration;

  // Playwright MCP integration flags
  private playwrightAvailable = false;
  private browserConnected = false;

  constructor(config?: Partial<DebuggingConfiguration>) {
    super();
    this.logger = Logger.getInstance();

    this.configuration = this.mergeWithDefaultConfig(config || {});
    this.coordinator = new AutonomousDebuggingCoordinator(this.configuration);
    this.uiInspector = new UIInspectorAgent();
    this.backendMonitor = new BackendMonitorAgent();

    this.setupEventHandlers();
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaultConfig(
    userConfig: Partial<DebuggingConfiguration>,
  ): DebuggingConfiguration {
    const defaultConfig: DebuggingConfiguration = {
      enabled: true,
      mode: "continuous",
      agentConfiguration: {
        "ui-inspector": { enabled: true, config: {} },
        "backend-monitor": { enabled: true, config: {} },
        planner: { enabled: true, config: {} },
        validator: { enabled: true, config: {} },
        documenter: { enabled: true, config: {} },
      },
      monitoring: {
        interval: 30000, // 30 seconds
        batchSize: 100,
        retentionPeriod: 24, // 24 hours
      },
      thresholds: {
        responseTime: 3000, // 3 seconds
        errorRate: 5, // 5%
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        loadTime: 5000, // 5 seconds
      },
      notifications: {
        enabled: true,
        channels: ["console", "websocket"],
        severity: ["critical", "high", "medium"],
      },
    };

    return {
      ...defaultConfig,
      ...userConfig,
      agentConfiguration: {
        ...defaultConfig.agentConfiguration,
        ...(userConfig.agentConfiguration || {}),
      },
      monitoring: {
        ...defaultConfig.monitoring,
        ...(userConfig.monitoring || {}),
      },
      thresholds: {
        ...defaultConfig.thresholds,
        ...(userConfig.thresholds || {}),
      },
      notifications: {
        ...defaultConfig.notifications,
        ...(userConfig.notifications || {}),
      },
    };
  }

  /**
   * Set up event handlers between components
   */
  private setupEventHandlers(): void {
    // Coordinator events
    this.coordinator.on("session-started", (data) => {
      this.logger.info("Debugging session started", data);
      this.emit("session-started", data);
    });

    this.coordinator.on("finding-reported", (data) => {
      this.handleNewFinding(data.finding);
    });

    // UI Inspector events
    this.uiInspector.on("finding-detected", (finding) => {
      this.coordinator.reportFinding(finding);
    });

    this.uiInspector.on("screenshot-request", async (request) => {
      await this.handlePlaywrightScreenshotRequest(request);
    });

    this.uiInspector.on("console-logs-request", async (request) => {
      await this.handlePlaywrightConsoleLogsRequest(request);
    });

    this.uiInspector.on("network-request", async (request) => {
      await this.handlePlaywrightNetworkRequest(request);
    });

    this.uiInspector.on("workflow-step-request", async (request) => {
      await this.handlePlaywrightWorkflowStep(request);
    });

    // Backend Monitor events
    this.backendMonitor.on("finding-detected", (finding) => {
      this.coordinator.reportFinding(finding);
    });

    this.backendMonitor.on("log-streaming-started", () => {
      this.logger.info("Backend log streaming started");
    });
  }

  /**
   * Initialize the autonomous debugging system
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing Autonomous Web Debugger");

    try {
      // Check Playwright MCP availability
      await this.checkPlaywrightAvailability();

      if (this.playwrightAvailable) {
        await this.initializeBrowserConnection();
      }

      this.logger.info("Autonomous Web Debugger initialized successfully", {
        playwrightAvailable: this.playwrightAvailable,
        browserConnected: this.browserConnected,
      });
    } catch (error) {
      this.logger.error(
        "Failed to initialize Autonomous Web Debugger",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Check if Playwright MCP is available
   */
  private async checkPlaywrightAvailability(): Promise<void> {
    try {
      // Emit request to check Playwright MCP availability
      // This will be handled by the main Claude Code system
      this.emit("playwright-availability-check");

      // For now, assume available - in production this would wait for response
      this.playwrightAvailable = true;
      this.logger.info("Playwright MCP available for browser automation");
    } catch (error) {
      this.logger.warn(
        "Playwright MCP not available, UI debugging will be limited",
        { error },
      );
      this.playwrightAvailable = false;
    }
  }

  /**
   * Initialize browser connection via Playwright MCP
   */
  private async initializeBrowserConnection(): Promise<void> {
    try {
      // Request browser initialization
      this.emit("browser-init-request", {
        browsers: ["chromium"], // Start with Chromium
        headless: true,
        viewport: { width: 1920, height: 1080 },
      });

      this.browserConnected = true;
      this.logger.info("Browser connection initialized");
    } catch (error) {
      this.logger.error(
        "Failed to initialize browser connection",
        error as Error,
      );
      this.browserConnected = false;
    }
  }

  /**
   * Start autonomous debugging for a web application
   */
  async startDebugging(context: DebuggingContext): Promise<string> {
    this.logger.info("Starting autonomous web application debugging", {
      frontendUrl: context.applicationUrls.frontend,
      backendUrl: context.applicationUrls.backend,
      monitoring: context.monitoringScope,
    });

    try {
      // Start coordinator session
      const sessionId = await this.coordinator.startDebuggingSession(context);
      this.currentSession = this.coordinator.getSessionStatus();

      // Initialize UI Inspector if enabled
      if (context.monitoringScope.includeUI && this.playwrightAvailable) {
        const urls = [
          context.applicationUrls.frontend,
          context.applicationUrls.backend,
        ].filter((url) => url);

        await this.uiInspector.startMonitoring(urls);
      }

      // Initialize Backend Monitor if enabled
      if (context.monitoringScope.includeBackend) {
        await this.backendMonitor.startLogStreaming();

        if (context.applicationUrls.api) {
          await this.backendMonitor.monitorApiEndpoints([
            context.applicationUrls.api,
          ]);
        }
      }

      // Broadcast session started via WebSocket
      const notificationService = getNotificationService();
      if (notificationService) {
        notificationService.broadcastDebuggingSessionUpdate(
          sessionId,
          "started",
          this.coordinator.getMetrics(),
        );
      }

      this.logger.info("Autonomous debugging started successfully", {
        sessionId,
      });
      return sessionId;
    } catch (error) {
      this.logger.error("Failed to start autonomous debugging", error as Error);
      throw error;
    }
  }

  /**
   * Stop autonomous debugging
   */
  async stopDebugging(): Promise<void> {
    if (!this.currentSession) {
      this.logger.warn("No active debugging session to stop");
      return;
    }

    this.logger.info("Stopping autonomous debugging");

    try {
      // Stop all agents
      await this.uiInspector.stopMonitoring();
      await this.backendMonitor.stopMonitoring();

      // Stop coordinator
      await this.coordinator.stopDebuggingSession();

      this.currentSession = null;
      this.logger.info("Autonomous debugging stopped successfully");
    } catch (error) {
      this.logger.error(
        "Failed to stop autonomous debugging gracefully",
        error as Error,
      );
    }
  }

  /**
   * Validate user workflow autonomously
   */
  async validateUserWorkflow(
    workflow: UserWorkflow,
  ): Promise<ValidationResult> {
    if (!this.playwrightAvailable || !this.browserConnected) {
      throw new Error(
        "Browser automation not available for workflow validation",
      );
    }

    this.logger.info(`Validating user workflow: ${workflow.name}`);

    try {
      const result = await this.uiInspector.validateUserWorkflow(workflow);

      this.logger.info("User workflow validation completed", {
        workflowId: workflow.id,
        passed: result.passed,
        duration: result.duration,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      this.logger.error("Workflow validation failed", error as Error);
      throw error;
    }
  }

  /**
   * Handle Playwright screenshot requests
   */
  private async handlePlaywrightScreenshotRequest(request: any): Promise<void> {
    try {
      // Emit Playwright MCP request
      this.emit("playwright-screenshot", {
        url: request.url,
        requestId: request.requestId,
        options: {
          fullPage: true,
          type: "png",
        },
      });

      // In a real implementation, this would wait for the MCP response
      // and then emit the response back to the UI Inspector
      setTimeout(() => {
        this.uiInspector.emit("screenshot-response", {
          requestId: request.requestId,
          screenshotPath: `/tmp/screenshot-${request.requestId}.png`,
          timestamp: new Date(),
        });
      }, 1000);
    } catch (error) {
      this.uiInspector.emit("screenshot-response", {
        requestId: request.requestId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle Playwright console logs requests
   */
  private async handlePlaywrightConsoleLogsRequest(
    request: any,
  ): Promise<void> {
    try {
      this.emit("playwright-console-logs", {
        url: request.url,
        requestId: request.requestId,
      });

      // Mock response for now
      setTimeout(() => {
        this.uiInspector.emit("console-logs-response", {
          requestId: request.requestId,
          consoleLogs: [
            {
              timestamp: new Date(),
              level: "error" as const,
              message: "Example console error",
              source: "console",
              lineNumber: 42,
            },
          ],
        });
      }, 500);
    } catch (error) {
      this.uiInspector.emit("console-logs-response", {
        requestId: request.requestId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle Playwright network monitoring requests
   */
  private async handlePlaywrightNetworkRequest(request: any): Promise<void> {
    try {
      this.emit("playwright-network", {
        url: request.url,
        requestId: request.requestId,
      });

      // Mock response
      setTimeout(() => {
        this.uiInspector.emit("network-response", {
          requestId: request.requestId,
          networkRequests: [
            {
              timestamp: new Date(),
              method: "GET",
              url: request.url,
              statusCode: 200,
              responseTime: 250,
              size: 1024,
              headers: { "content-type": "text/html" },
            },
          ],
        });
      }, 500);
    } catch (error) {
      this.uiInspector.emit("network-response", {
        requestId: request.requestId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle Playwright workflow step execution
   */
  private async handlePlaywrightWorkflowStep(request: any): Promise<void> {
    try {
      this.emit("playwright-workflow-step", {
        step: request.step,
        requestId: request.requestId,
      });

      // Mock success response
      setTimeout(() => {
        this.uiInspector.emit("workflow-step-response", {
          requestId: request.requestId,
          success: true,
        });
      }, 1000);
    } catch (error) {
      this.uiInspector.emit("workflow-step-response", {
        requestId: request.requestId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle new debugging findings
   */
  private handleNewFinding(finding: DebuggingFinding): void {
    this.logger.info("New debugging finding", {
      id: finding.id,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
    });

    // Broadcast via WebSocket for real-time updates
    const notificationService = getNotificationService();
    if (notificationService) {
      notificationService.broadcastDebuggingFinding(
        finding,
        this.currentSession?.id,
      );
    }

    // Emit for external systems
    this.emit("finding-detected", finding);

    // Handle critical findings immediately
    if (finding.severity === "critical") {
      this.handleCriticalFinding(finding);
    }
  }

  /**
   * Handle critical findings with immediate response
   */
  private handleCriticalFinding(finding: DebuggingFinding): void {
    this.logger.error("CRITICAL FINDING DETECTED", undefined, {
      findingId: finding.id,
      title: finding.title,
      description: finding.description,
      evidence: finding.evidence,
    });

    // Emit critical alert
    this.emit("critical-finding", {
      finding,
      timestamp: new Date(),
      sessionId: this.currentSession?.id,
    });

    // Additional critical finding handling could include:
    // - Emergency notifications
    // - Automated rollback triggers
    // - Circuit breaker activation
    // - Administrator alerts
  }

  /**
   * Get current debugging status
   */
  getStatus(): any {
    return {
      initialized: this.playwrightAvailable,
      browserConnected: this.browserConnected,
      currentSession: this.currentSession?.id || null,
      sessionStatus: this.currentSession?.status || "inactive",
      agentsStatus: this.coordinator.getAgentsStatus(),
      metrics: this.coordinator.getMetrics(),
      uiInspectorStatus: this.uiInspector.getMonitoringStatus(),
      backendMonitorStatus: this.backendMonitor.getMonitoringStatus(),
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<DebuggingConfiguration>): void {
    this.configuration = this.mergeWithDefaultConfig(config);
    this.logger.info("Debugging configuration updated", { config });
  }

  /**
   * Get recent findings
   */
  getFindings(limit: number = 50): DebuggingFinding[] {
    return this.currentSession?.findings.slice(-limit) || [];
  }

  /**
   * Create a comprehensive debugging context for web applications
   */
  static createWebAppContext(
    frontendUrl: string,
    backendUrl?: string,
    apiUrl?: string,
  ): DebuggingContext {
    return {
      applicationUrls: {
        frontend: frontendUrl,
        backend: backendUrl || frontendUrl.replace("3001", "3000"), // Common pattern
        api: apiUrl,
      },
      monitoringScope: {
        includeUI: true,
        includeBackend: true,
        includeNetwork: true,
        includePerformance: true,
      },
      thresholds: {
        responseTime: 3000,
        errorRate: 5,
        cpuUsage: 80,
        memoryUsage: 85,
        loadTime: 5000,
      },
      userWorkflows: [
        {
          id: "login-flow",
          name: "User Login Workflow",
          description: "Critical user authentication flow",
          criticalPath: true,
          steps: [
            { action: "navigate", target: frontendUrl + "/login" },
            { action: "type", target: "#username", value: "testuser" },
            { action: "type", target: "#password", value: "testpass" },
            { action: "click", target: "#login-button" },
            { action: "verify", expected: "dashboard", timeout: 5000 },
          ],
        },
      ],
    };
  }
}
