/**
 * Autonomous Debugging Workflow Engine
 *
 * Automated debugging workflows that can run without human intervention
 * and integrate with the console command system
 */

import { EventEmitter } from "events";

import { Logger } from "../../observability/logger";
import { AutonomousWebDebugger } from "../autonomous-debugger";
import {
  DebuggingWorkflow,
  TriggerCondition,
  DebuggingContext,
  UserWorkflow,
  DebuggingFinding,
  ValidationResult,
} from "../types";

export class AutonomousDebuggingWorkflow extends EventEmitter {
  private logger: Logger;
  private debugger: AutonomousWebDebugger;
  private workflows: Map<string, DebuggingWorkflow> = new Map();
  private activeWorkflows: Set<string> = new Set();
  private isRunning = false;

  constructor(autonomousDebugger: AutonomousWebDebugger) {
    super();
    this.logger = Logger.getInstance();
    this.debugger = autonomousDebugger;
    this.initializeDefaultWorkflows();
  }

  /**
   * Initialize default autonomous debugging workflows
   */
  private initializeDefaultWorkflows(): void {
    // Critical error response workflow
    this.registerWorkflow({
      id: "critical-error-response",
      name: "Critical Error Response",
      description: "Immediate response to critical application errors",
      triggerConditions: [
        { type: "error-rate", threshold: 10, timeWindow: 5 }, // 10% error rate in 5 minutes
        { type: "console-error", pattern: "TypeError|ReferenceError" },
      ],
      steps: [
        { action: "navigate", target: "frontend" },
        { action: "verify", expected: "loaded" },
        { action: "click", target: "critical-feature" },
        { action: "wait", value: "2000" },
      ],
      timeout: 120000, // 2 minutes
      retryCount: 3,
      requiredAgents: ["ui-inspector", "backend-monitor", "validator"],
    });

    // Performance degradation workflow
    this.registerWorkflow({
      id: "performance-degradation",
      name: "Performance Degradation Response",
      description: "Automated response to performance issues",
      triggerConditions: [
        { type: "response-time", threshold: 5000, timeWindow: 10 }, // 5s response time
      ],
      steps: [
        { action: "navigate", target: "frontend" },
        { action: "verify", expected: "performance-baseline" },
      ],
      timeout: 180000, // 3 minutes
      retryCount: 2,
      requiredAgents: ["ui-inspector", "backend-monitor"],
    });

    // Network failure recovery workflow
    this.registerWorkflow({
      id: "network-failure-recovery",
      name: "Network Failure Recovery",
      description: "Automated network failure detection and recovery testing",
      triggerConditions: [
        { type: "network-failure", threshold: 5, timeWindow: 5 },
      ],
      steps: [
        { action: "navigate", target: "frontend" },
        { action: "verify", expected: "connectivity" },
        { action: "wait", value: "5000" },
        { action: "verify", expected: "data-loaded" },
      ],
      timeout: 300000, // 5 minutes
      retryCount: 1,
      requiredAgents: ["ui-inspector", "backend-monitor"],
    });

    // User workflow validation
    this.registerWorkflow({
      id: "user-workflow-validation",
      name: "Critical User Workflow Validation",
      description: "Periodic validation of critical user workflows",
      triggerConditions: [
        { type: "manual" }, // Can be triggered manually or on schedule
      ],
      steps: [
        { action: "navigate", target: "frontend" },
        { action: "verify", expected: "login-available" },
        { action: "click", target: "#login-form" },
        { action: "type", target: "#username", value: "testuser" },
        { action: "type", target: "#password", value: "testpass" },
        { action: "click", target: "#login-button" },
        { action: "verify", expected: "dashboard-loaded", timeout: 10000 },
      ],
      timeout: 180000, // 3 minutes
      retryCount: 2,
      requiredAgents: ["ui-inspector", "validator"],
    });

    this.logger.info("Default autonomous debugging workflows initialized", {
      workflowCount: this.workflows.size,
    });
  }

  /**
   * Register a new debugging workflow
   */
  registerWorkflow(workflow: DebuggingWorkflow): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Registered debugging workflow: ${workflow.name}`, {
      workflowId: workflow.id,
      triggerConditions: workflow.triggerConditions.length,
    });
  }

  /**
   * Start autonomous workflow engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Autonomous workflow engine already running");
      return;
    }

    this.logger.info("Starting autonomous debugging workflow engine");

    // Listen for findings that might trigger workflows
    this.debugger.on("finding-detected", (finding: DebuggingFinding) => {
      this.evaluateWorkflowTriggers(finding);
    });

    // Listen for critical findings
    this.debugger.on("critical-finding", (event) => {
      this.triggerEmergencyWorkflow(event.finding);
    });

    this.isRunning = true;
    this.emit("workflow-engine-started");
  }

  /**
   * Stop autonomous workflow engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info("Stopping autonomous debugging workflow engine");

    // Stop all active workflows
    for (const workflowId of this.activeWorkflows) {
      await this.stopWorkflow(workflowId);
    }

    this.isRunning = false;
    this.emit("workflow-engine-stopped");
  }

  /**
   * Evaluate workflow triggers based on findings
   */
  private evaluateWorkflowTriggers(finding: DebuggingFinding): void {
    for (const [workflowId, workflow] of this.workflows) {
      if (this.activeWorkflows.has(workflowId)) {
        continue; // Already running
      }

      const shouldTrigger = this.shouldTriggerWorkflow(workflow, finding);
      if (shouldTrigger) {
        this.triggerWorkflow(workflowId, finding);
      }
    }
  }

  /**
   * Check if workflow should be triggered based on finding
   */
  private shouldTriggerWorkflow(
    workflow: DebuggingWorkflow,
    finding: DebuggingFinding,
  ): boolean {
    return workflow.triggerConditions.some((condition) => {
      switch (condition.type) {
        case "error-rate":
          return finding.category === "backend" && finding.severity === "high";

        case "response-time":
          return (
            finding.category === "performance" &&
            finding.evidence.performanceMetrics?.some(
              (m) => m.value > (condition.threshold || 5000),
            )
          );

        case "console-error":
          return (
            finding.category === "ui" &&
            finding.evidence.consoleErrors?.some((error) =>
              condition.pattern
                ? new RegExp(condition.pattern).test(error.message)
                : true,
            )
          );

        case "network-failure":
          return finding.category === "network" && finding.severity === "high";

        default:
          return false;
      }
    });
  }

  /**
   * Trigger emergency workflow for critical findings
   */
  private async triggerEmergencyWorkflow(
    finding: DebuggingFinding,
  ): Promise<void> {
    this.logger.error(
      "Triggering emergency workflow for critical finding",
      new Error("Emergency workflow triggered"),
      {
        findingId: finding.id,
        severity: finding.severity,
        category: finding.category,
      },
    );

    // Use critical error response workflow
    await this.triggerWorkflow("critical-error-response", finding);
  }

  /**
   * Trigger specific workflow
   */
  async triggerWorkflow(
    workflowId: string,
    trigger?: DebuggingFinding,
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      this.logger.error(
        "Workflow not found",
        new Error(`Workflow not found: ${workflowId}`),
      );
      return;
    }

    if (this.activeWorkflows.has(workflowId)) {
      this.logger.warn(`Workflow already active: ${workflowId}`);
      return;
    }

    this.logger.info(`Triggering autonomous workflow: ${workflow.name}`, {
      workflowId,
      trigger: trigger?.id,
    });

    this.activeWorkflows.add(workflowId);

    try {
      await this.executeWorkflow(workflow, trigger);
    } catch (error) {
      this.logger.error(
        `Workflow execution failed: ${workflowId}`,
        error as Error,
      );
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(
    workflow: DebuggingWorkflow,
    trigger?: DebuggingFinding,
  ): Promise<void> {
    const startTime = Date.now();

    this.emit("workflow-started", {
      workflowId: workflow.id,
      trigger: trigger?.id,
    });

    try {
      // Convert workflow steps to user workflow format
      const userWorkflow: UserWorkflow = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        criticalPath: true,
      };

      // Execute workflow using the debugger's validation system
      const result: ValidationResult =
        await this.debugger.validateUserWorkflow(userWorkflow);

      const duration = Date.now() - startTime;

      this.logger.info(`Workflow completed: ${workflow.name}`, {
        workflowId: workflow.id,
        passed: result.passed,
        duration,
        errors: result.errors.length,
      });

      // Create finding based on workflow result
      const workflowFinding: DebuggingFinding = {
        id: `workflow-result-${Date.now()}`,
        timestamp: new Date(),
        severity: result.passed ? "info" : "high",
        category: "ui",
        title: `Autonomous Workflow Result: ${workflow.name}`,
        description: result.passed
          ? "Workflow completed successfully"
          : `Workflow failed with ${result.errors.length} errors`,
        source: "validator",
        evidence: {
          screenshots: result.steps
            .map((step) => step.screenshot)
            .filter((s): s is string => Boolean(s)),
        },
        recommendations: result.passed
          ? []
          : [
              "Review failed workflow steps",
              "Check application state",
              "Verify user interface elements",
              "Consider manual intervention",
            ],
        status: "new",
      };

      // Report workflow result
      this.debugger.emit("finding-detected", workflowFinding);

      this.emit("workflow-completed", {
        workflowId: workflow.id,
        result,
        duration,
        trigger: trigger?.id,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `Workflow execution error: ${workflow.name}`,
        error as Error,
        {
          workflowId: workflow.id,
          duration,
        },
      );

      this.emit("workflow-failed", {
        workflowId: workflow.id,
        error: (error as Error).message,
        duration,
        trigger: trigger?.id,
      });

      // Retry logic
      if (workflow.retryCount > 0) {
        this.logger.info(`Retrying workflow: ${workflow.name}`, {
          workflowId: workflow.id,
          retriesLeft: workflow.retryCount,
        });

        setTimeout(async () => {
          workflow.retryCount--;
          await this.executeWorkflow(workflow, trigger);
        }, 10000); // Wait 10 seconds before retry
      }
    }
  }

  /**
   * Stop specific workflow
   */
  private async stopWorkflow(workflowId: string): Promise<void> {
    if (!this.activeWorkflows.has(workflowId)) return;

    this.logger.info(`Stopping workflow: ${workflowId}`);
    this.activeWorkflows.delete(workflowId);

    this.emit("workflow-stopped", { workflowId });
  }

  /**
   * Manually trigger workflow (for console commands)
   */
  async manualTrigger(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.logger.info(`Manual trigger for workflow: ${workflow.name}`, {
      workflowId,
    });
    await this.triggerWorkflow(workflowId);
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(): any {
    return {
      isRunning: this.isRunning,
      totalWorkflows: this.workflows.size,
      activeWorkflows: this.activeWorkflows.size,
      workflows: Array.from(this.workflows.values()).map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        active: this.activeWorkflows.has(w.id),
        triggerConditions: w.triggerConditions.length,
        steps: w.steps.length,
      })),
    };
  }

  /**
   * List available workflows
   */
  listWorkflows(): {
    id: string;
    name: string;
    description: string;
    active: boolean;
  }[] {
    return Array.from(this.workflows.values()).map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      active: this.activeWorkflows.has(workflow.id),
    }));
  }

  /**
   * Get workflow details
   */
  getWorkflow(workflowId: string): DebuggingWorkflow | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Create context-specific debugging workflows based on application type
   */
  static createWebAppWorkflows(context: DebuggingContext): DebuggingWorkflow[] {
    const workflows: DebuggingWorkflow[] = [];

    // Login flow validation
    workflows.push({
      id: "login-validation",
      name: "Login Flow Validation",
      description: "Validate critical user authentication workflow",
      triggerConditions: [
        { type: "manual" },
        { type: "console-error", pattern: "auth|login" },
      ],
      steps: [
        {
          action: "navigate",
          target: context.applicationUrls.frontend + "/login",
        },
        { action: "verify", expected: "login-form-visible" },
        { action: "type", target: "#username", value: "testuser" },
        { action: "type", target: "#password", value: "testpass" },
        { action: "click", target: "#login-button" },
        { action: "verify", expected: "dashboard-loaded", timeout: 10000 },
      ],
      timeout: 120000,
      retryCount: 2,
      requiredAgents: ["ui-inspector", "validator"],
    });

    // Dashboard loading validation
    workflows.push({
      id: "dashboard-validation",
      name: "Dashboard Loading Validation",
      description: "Ensure dashboard loads correctly with all components",
      triggerConditions: [
        { type: "response-time", threshold: 5000 },
        { type: "console-error", pattern: "dashboard|component" },
      ],
      steps: [
        {
          action: "navigate",
          target: context.applicationUrls.frontend + "/dashboard",
        },
        { action: "verify", expected: "dashboard-components-loaded" },
        { action: "wait", value: "2000" },
        { action: "verify", expected: "no-console-errors" },
      ],
      timeout: 60000,
      retryCount: 1,
      requiredAgents: ["ui-inspector"],
    });

    return workflows;
  }
}
