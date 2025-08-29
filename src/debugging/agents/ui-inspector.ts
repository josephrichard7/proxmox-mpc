/**
 * UI Inspector Agent - Autonomous Browser and Frontend Debugging
 *
 * Specialized agent for real-time UI monitoring, screenshot analysis,
 * console log monitoring, and visual regression detection using Playwright MCP
 */

import { EventEmitter } from "events";

import { Logger } from "../../observability/logger";
import {
  UIInspectorAgent as IUIInspectorAgent,
  DebuggingContext,
  ConsoleError,
  NetworkRequest,
  UserWorkflow,
  ValidationResult,
  DebuggingFinding,
  DebuggingEvidence,
  PerformanceMetric,
} from "../types";

export class UIInspectorAgent
  extends EventEmitter
  implements IUIInspectorAgent
{
  private logger: Logger;
  private isMonitoring = false;
  private monitoredUrls: string[] = [];
  private baselineScreenshots: Map<string, string> = new Map();
  private consoleErrors: ConsoleError[] = [];
  private networkRequests: NetworkRequest[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  /**
   * Start monitoring specified URLs
   */
  async startMonitoring(urls: string[]): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn("UI monitoring already active");
      return;
    }

    this.monitoredUrls = urls;
    this.isMonitoring = true;

    this.logger.info("Starting UI monitoring", { urls });

    try {
      // Initialize browser connections for each URL
      await this.initializeBrowsers(urls);

      // Take baseline screenshots
      await this.captureBaselineScreenshots(urls);

      // Start continuous monitoring
      this.startContinuousMonitoring();

      this.emit("monitoring-started", { urls });
    } catch (error) {
      this.logger.error("Failed to start UI monitoring", error as Error, {
        urls,
      });
      throw error;
    }
  }

  /**
   * Initialize browser connections using Playwright MCP
   */
  private async initializeBrowsers(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        // Using Playwright MCP to navigate to each URL
        // This would be coordinated by the main coordinator
        this.logger.info(`Initializing browser for ${url}`);

        // The actual Playwright MCP calls will be made by the coordinator
        // This agent provides the interface and logic
        this.emit("browser-init-request", { url });
      } catch (error) {
        this.logger.error(
          `Failed to initialize browser for ${url}`,
          error as Error,
        );
        throw error;
      }
    }
  }

  /**
   * Capture baseline screenshots for visual regression detection
   */
  private async captureBaselineScreenshots(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        const screenshot = await this.takeScreenshot(url);
        this.baselineScreenshots.set(url, screenshot);

        this.logger.info(`Captured baseline screenshot for ${url}`);
      } catch (error) {
        this.logger.error(
          `Failed to capture baseline screenshot for ${url}`,
          error as Error,
        );
      }
    }
  }

  /**
   * Take screenshot of specified URL
   */
  async takeScreenshot(url: string): Promise<string> {
    this.logger.debug(`Taking screenshot of ${url}`);

    // Emit request for coordinator to handle via Playwright MCP
    return new Promise((resolve, reject) => {
      const requestId = `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      // Set up one-time listener for response
      const responseHandler = (response: any) => {
        if (response.requestId === requestId) {
          this.off("screenshot-response", responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.screenshotPath);
          }
        }
      };

      this.on("screenshot-response", responseHandler);

      // Emit screenshot request
      this.emit("screenshot-request", {
        requestId,
        url,
        timestamp: new Date(),
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.off("screenshot-response", responseHandler);
        reject(new Error("Screenshot request timeout"));
      }, 30000);
    });
  }

  /**
   * Get console logs from specified URL
   */
  async getConsoleLogs(url: string): Promise<ConsoleError[]> {
    this.logger.debug(`Getting console logs for ${url}`);

    return new Promise((resolve, reject) => {
      const requestId = `console-logs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const responseHandler = (response: any) => {
        if (response.requestId === requestId) {
          this.off("console-logs-response", responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.consoleLogs);
          }
        }
      };

      this.on("console-logs-response", responseHandler);

      this.emit("console-logs-request", {
        requestId,
        url,
        timestamp: new Date(),
      });

      setTimeout(() => {
        this.off("console-logs-response", responseHandler);
        reject(new Error("Console logs request timeout"));
      }, 15000);
    });
  }

  /**
   * Monitor network requests for specified URL
   */
  async monitorNetworkRequests(url: string): Promise<NetworkRequest[]> {
    this.logger.debug(`Monitoring network requests for ${url}`);

    return new Promise((resolve, reject) => {
      const requestId = `network-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const responseHandler = (response: any) => {
        if (response.requestId === requestId) {
          this.off("network-response", responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.networkRequests);
          }
        }
      };

      this.on("network-response", responseHandler);

      this.emit("network-request", {
        requestId,
        url,
        timestamp: new Date(),
      });

      setTimeout(() => {
        this.off("network-response", responseHandler);
        reject(new Error("Network monitoring request timeout"));
      }, 20000);
    });
  }

  /**
   * Detect visual regression by comparing screenshots
   */
  async detectVisualRegression(
    beforePath: string,
    afterPath: string,
  ): Promise<boolean> {
    this.logger.debug("Detecting visual regression", { beforePath, afterPath });

    return new Promise((resolve, reject) => {
      const requestId = `visual-regression-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const responseHandler = (response: any) => {
        if (response.requestId === requestId) {
          this.off("visual-regression-response", responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.hasRegression);
          }
        }
      };

      this.on("visual-regression-response", responseHandler);

      this.emit("visual-regression-request", {
        requestId,
        beforePath,
        afterPath,
        timestamp: new Date(),
      });

      setTimeout(() => {
        this.off("visual-regression-response", responseHandler);
        reject(new Error("Visual regression detection timeout"));
      }, 30000);
    });
  }

  /**
   * Validate user workflow by automating the steps
   */
  async validateUserWorkflow(
    workflow: UserWorkflow,
  ): Promise<ValidationResult> {
    this.logger.info(`Validating user workflow: ${workflow.name}`, {
      workflowId: workflow.id,
      stepsCount: workflow.steps.length,
    });

    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      duration: 0,
      steps: [],
    };

    const startTime = Date.now();

    try {
      for (const step of workflow.steps) {
        const stepStart = Date.now();

        try {
          // Execute workflow step via Playwright MCP
          await this.executeWorkflowStep(step);

          result.steps.push({
            step,
            result: "passed",
            message: `Step completed successfully`,
            screenshot: await this.takeScreenshot(
              step.target || "current-page",
            ),
          });
        } catch (stepError: any) {
          result.passed = false;
          result.errors.push(
            `Step "${step.action}" failed: ${stepError.message}`,
          );

          result.steps.push({
            step,
            result: "failed",
            message: stepError.message,
            screenshot: await this.takeScreenshot(
              step.target || "current-page",
            ),
          });
        }
      }
    } catch (error: any) {
      result.passed = false;
      result.errors.push(`Workflow validation failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;

    this.logger.info(`Workflow validation completed`, {
      workflowId: workflow.id,
      passed: result.passed,
      duration: result.duration,
      errorsCount: result.errors.length,
    });

    return result;
  }

  /**
   * Execute individual workflow step
   */
  private async executeWorkflowStep(step: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = `workflow-step-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const responseHandler = (response: any) => {
        if (response.requestId === requestId) {
          this.off("workflow-step-response", responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        }
      };

      this.on("workflow-step-response", responseHandler);

      this.emit("workflow-step-request", {
        requestId,
        step,
        timestamp: new Date(),
      });

      setTimeout(() => {
        this.off("workflow-step-response", responseHandler);
        reject(new Error(`Workflow step timeout: ${step.action}`));
      }, step.timeout || 30000);
    });
  }

  /**
   * Start continuous monitoring loop
   */
  private startContinuousMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, 30000); // Monitor every 30 seconds

    this.logger.info("Continuous UI monitoring started");
  }

  /**
   * Perform single monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    if (!this.isMonitoring) return;

    for (const url of this.monitoredUrls) {
      try {
        // Check for console errors
        const consoleLogs = await this.getConsoleLogs(url);
        this.processConsoleErrors(url, consoleLogs);

        // Monitor network requests
        const networkRequests = await this.monitorNetworkRequests(url);
        this.processNetworkRequests(url, networkRequests);

        // Check for visual regressions
        await this.checkVisualRegression(url);
      } catch (error) {
        this.logger.error(`Monitoring cycle failed for ${url}`, error as Error);
      }
    }
  }

  /**
   * Process console errors and report findings
   */
  private processConsoleErrors(url: string, consoleLogs: ConsoleError[]): void {
    const newErrors = consoleLogs.filter(
      (log) =>
        log.level === "error" &&
        !this.consoleErrors.some(
          (existing) =>
            existing.message === log.message &&
            existing.timestamp.getTime() === log.timestamp.getTime(),
        ),
    );

    if (newErrors.length > 0) {
      this.consoleErrors.push(...newErrors);

      // Create debugging finding for console errors
      const finding: DebuggingFinding = {
        id: `console-errors-${Date.now()}`,
        timestamp: new Date(),
        severity: newErrors.some(
          (e) =>
            e.message.includes("TypeError") ||
            e.message.includes("ReferenceError"),
        )
          ? "high"
          : "medium",
        category: "ui",
        title: `Console Errors Detected on ${url}`,
        description: `${newErrors.length} new console errors detected`,
        source: "ui-inspector",
        evidence: {
          consoleErrors: newErrors,
          screenshots: [], // Will be populated by coordinator
        },
        recommendations: [
          "Review JavaScript code for undefined variables or functions",
          "Check browser compatibility",
          "Verify resource loading",
        ],
        status: "new",
      };

      this.emit("finding-detected", finding);
      this.logger.warn(`Console errors detected on ${url}`, {
        errorCount: newErrors.length,
        errors: newErrors.map((e) => e.message).slice(0, 3), // First 3 messages
      });
    }
  }

  /**
   * Process network requests and identify issues
   */
  private processNetworkRequests(
    url: string,
    requests: NetworkRequest[],
  ): void {
    const failedRequests = requests.filter(
      (req) => req.statusCode >= 400 || req.error || req.responseTime > 5000,
    );

    if (failedRequests.length > 0) {
      this.networkRequests.push(...requests);

      const finding: DebuggingFinding = {
        id: `network-issues-${Date.now()}`,
        timestamp: new Date(),
        severity: failedRequests.some((req) => req.statusCode >= 500)
          ? "high"
          : "medium",
        category: "network",
        title: `Network Issues Detected on ${url}`,
        description: `${failedRequests.length} failed network requests detected`,
        source: "ui-inspector",
        evidence: {
          networkRequests: failedRequests,
        },
        recommendations: [
          "Check API endpoint availability",
          "Verify network connectivity",
          "Review request timeout settings",
          "Check for CORS issues",
        ],
        status: "new",
      };

      this.emit("finding-detected", finding);
      this.logger.warn(`Network issues detected on ${url}`, {
        failedRequests: failedRequests.length,
      });
    }
  }

  /**
   * Check for visual regressions
   */
  private async checkVisualRegression(url: string): Promise<void> {
    const baselineScreenshot = this.baselineScreenshots.get(url);
    if (!baselineScreenshot) return;

    try {
      const currentScreenshot = await this.takeScreenshot(url);
      const hasRegression = await this.detectVisualRegression(
        baselineScreenshot,
        currentScreenshot,
      );

      if (hasRegression) {
        const finding: DebuggingFinding = {
          id: `visual-regression-${Date.now()}`,
          timestamp: new Date(),
          severity: "medium",
          category: "ui",
          title: `Visual Regression Detected on ${url}`,
          description: "Visual changes detected compared to baseline",
          source: "ui-inspector",
          evidence: {
            screenshots: [baselineScreenshot, currentScreenshot],
          },
          recommendations: [
            "Review recent UI changes",
            "Check CSS modifications",
            "Verify responsive design",
            "Update baseline if changes are intentional",
          ],
          status: "new",
        };

        this.emit("finding-detected", finding);
        this.logger.warn(`Visual regression detected on ${url}`);
      }
    } catch (error) {
      this.logger.error(
        `Visual regression check failed for ${url}`,
        error as Error,
      );
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.info("UI monitoring stopped");
    this.emit("monitoring-stopped");
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      monitoredUrls: this.monitoredUrls,
      consoleErrorsCount: this.consoleErrors.length,
      networkRequestsCount: this.networkRequests.length,
      baselineScreenshotsCount: this.baselineScreenshots.size,
    };
  }
}
