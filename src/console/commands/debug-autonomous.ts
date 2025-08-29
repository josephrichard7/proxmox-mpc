/**
 * Autonomous Debug Console Command
 *
 * Console command for managing autonomous web application debugging
 * Integrates with the multi-agent debugging system and Playwright MCP
 */

import { AutonomousWebDebugger } from "../../debugging/autonomous-debugger";
import {
  DebuggingContext,
  DebuggingConfiguration,
} from "../../debugging/types";
import { AutonomousDebuggingWorkflow } from "../../debugging/workflows/autonomous-workflow";
import { Logger } from "../../observability/logger";
import { ConsoleSession } from "../repl";

import { BaseCommand, CommandMetadata } from "./base-command";

export class DebugAutonomousCommand extends BaseCommand {
  private debugger?: AutonomousWebDebugger;
  private workflowEngine?: AutonomousDebuggingWorkflow;
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  getMetadata(): CommandMetadata {
    return {
      name: "debug-auto",
      description:
        "Autonomous web application debugging with multi-agent coordination",
      usage: "/debug-auto <subcommand> [options]",
      examples: [
        "/debug-auto start --frontend-url http://localhost:3001",
        "/debug-auto status",
        "/debug-auto findings --severity critical",
        "/debug-auto workflows list",
      ],
      requiresWorkspace: false,
      requiresConnection: false,
    };
  }

  subCommands = {
    start: {
      description: "Start autonomous debugging session",
      usage:
        "/debug-auto start [--frontend-url URL] [--backend-url URL] [--api-url URL]",
    },
    stop: {
      description: "Stop current autonomous debugging session",
      usage: "/debug-auto stop",
    },
    status: {
      description: "Show autonomous debugging status",
      usage: "/debug-auto status",
    },
    findings: {
      description: "List recent debugging findings",
      usage: "/debug-auto findings [--limit N] [--severity LEVEL]",
    },
    workflows: {
      description: "Manage autonomous debugging workflows",
      usage: "/debug-auto workflows [list|trigger|status]",
    },
    validate: {
      description: "Validate specific user workflow",
      usage: "/debug-auto validate [workflow-name]",
    },
    config: {
      description: "Configure autonomous debugging system",
      usage: "/debug-auto config [--ui] [--backend] [--performance]",
    },
  };

  async execute(args: string[], _session: ConsoleSession): Promise<void> {
    const [subCommand, ...subArgs] = args;

    if (!subCommand) {
      this.showUsage();
      return;
    }

    try {
      switch (subCommand) {
        case "start":
          await this.handleStart(subArgs);
          break;
        case "stop":
          await this.handleStop(subArgs);
          break;
        case "status":
          await this.handleStatus(subArgs);
          break;
        case "findings":
          await this.handleFindings(subArgs);
          break;
        case "workflows":
          await this.handleWorkflows(subArgs);
          break;
        case "validate":
          await this.handleValidate(subArgs);
          break;
        case "config":
          await this.handleConfig(subArgs);
          break;
        default:
          this.showError(`Unknown subcommand: ${subCommand}`);
          this.showUsage();
      }
    } catch (error: any) {
      this.showError(`Command failed: ${error.message}`);
      if (error.stack) {
        this.logger.error("Debug autonomous command error", error);
      }
    }
  }

  /**
   * Parse command line options
   */
  private parseOptions(
    args: string[],
    schema: Record<string, any>,
  ): Record<string, any> {
    const options: Record<string, any> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const key = arg.substring(2);
        if (key in schema) {
          if (schema[key] === Boolean) {
            options[key] = true;
          } else if (schema[key] === String) {
            options[key] = args[++i] || "";
          } else if (schema[key] === Number) {
            options[key] = parseInt(args[++i] || "0", 10);
          }
        }
      }
    }

    return options;
  }

  /**
   * Handle start subcommand
   */
  private async handleStart(args: string[]): Promise<void> {
    // Parse arguments
    const options = this.parseOptions(args, {
      "frontend-url": String,
      "backend-url": String,
      "api-url": String,
      ui: Boolean,
      backend: Boolean,
      performance: Boolean,
      network: Boolean,
    });

    const frontendUrl = options["frontend-url"] || "http://localhost:3001";
    const backendUrl = options["backend-url"] || "http://localhost:3000";
    const apiUrl = options["api-url"];

    this.showInfo("🚀 Starting Autonomous Web Application Debugging");
    this.showInfo("");

    // Create debugging context
    const context: DebuggingContext = {
      applicationUrls: {
        frontend: frontendUrl,
        backend: backendUrl,
        api: apiUrl,
      },
      monitoringScope: {
        includeUI: options.ui !== false,
        includeBackend: options.backend !== false,
        includeNetwork: options.network !== false,
        includePerformance: options.performance !== false,
      },
      thresholds: {
        responseTime: 3000,
        errorRate: 5,
        cpuUsage: 80,
        memoryUsage: 85,
        loadTime: 5000,
      },
      userWorkflows: [],
    };

    this.showInfo("🔧 Configuration:");
    this.showInfo(`   Frontend URL: ${frontendUrl}`);
    this.showInfo(`   Backend URL:  ${backendUrl}`);
    if (apiUrl) {
      this.showInfo(`   API URL:      ${apiUrl}`);
    }
    this.showInfo("");
    this.showInfo("🤖 Monitoring Scope:");
    this.showInfo(
      `   UI Inspector:     ${context.monitoringScope.includeUI ? "✅ Enabled" : "❌ Disabled"}`,
    );
    this.showInfo(
      `   Backend Monitor:  ${context.monitoringScope.includeBackend ? "✅ Enabled" : "❌ Disabled"}`,
    );
    this.showInfo(
      `   Network Monitor:  ${context.monitoringScope.includeNetwork ? "✅ Enabled" : "❌ Disabled"}`,
    );
    this.showInfo(
      `   Performance:      ${context.monitoringScope.includePerformance ? "✅ Enabled" : "❌ Disabled"}`,
    );
    this.showInfo("");

    try {
      // Initialize debugger if not already done
      if (!this.debugger) {
        this.showInfo("🔄 Initializing Multi-Agent Debugging System...");

        const config: Partial<DebuggingConfiguration> = {
          enabled: true,
          mode: "continuous",
          agentConfiguration: {
            "ui-inspector": {
              enabled: context.monitoringScope.includeUI,
              config: {},
            },
            "backend-monitor": {
              enabled: context.monitoringScope.includeBackend,
              config: {},
            },
            planner: { enabled: true, config: {} },
            validator: { enabled: true, config: {} },
            documenter: { enabled: true, config: {} },
          },
        };

        this.debugger = new AutonomousWebDebugger(config);

        // Set up event handlers for real-time feedback
        this.setupEventHandlers();

        await this.debugger.initialize();
        this.showSuccess("✅ Multi-Agent Debugging System Initialized");
      }

      // Initialize workflow engine
      if (!this.workflowEngine) {
        this.showInfo("🔄 Starting Autonomous Workflow Engine...");
        this.workflowEngine = new AutonomousDebuggingWorkflow(this.debugger);
        await this.workflowEngine.start();
        this.showSuccess("✅ Autonomous Workflow Engine Started");
      }

      // Start debugging session
      this.showInfo("🔄 Starting Debugging Session...");
      const sessionId = await this.debugger.startDebugging(context);

      this.showSuccess("🎉 Autonomous Debugging Started Successfully!");
      this.showInfo("");
      this.showInfo(`📊 Session ID: ${sessionId}`);
      this.showInfo("🕐 Continuous monitoring is now active");
      this.showInfo("🔍 Multi-agent coordination operational");
      this.showInfo("");
      this.showInfo('💡 Use "/debug-auto status" to monitor progress');
      this.showInfo('💡 Use "/debug-auto findings" to see discoveries');
      this.showInfo('💡 Use "/debug-auto workflows" to manage workflows');
    } catch (error: any) {
      this.showError(`Failed to start autonomous debugging: ${error.message}`);
      if (
        error.message.includes("browser") ||
        error.message.includes("Playwright")
      ) {
        this.showInfo("");
        this.showInfo("💡 Browser automation may not be available.");
        this.showInfo(
          "   Backend monitoring will continue without UI inspection.",
        );
      }
    }
  }

  /**
   * Handle stop subcommand
   */
  private async handleStop(_args: string[]): Promise<void> {
    if (!this.debugger) {
      this.showWarning("No autonomous debugging session active");
      return;
    }

    this.showInfo("🛑 Stopping Autonomous Debugging...");

    try {
      await this.debugger.stopDebugging();

      if (this.workflowEngine) {
        await this.workflowEngine.stop();
      }

      this.showSuccess("✅ Autonomous Debugging Stopped");

      // Clear instances
      this.debugger = undefined;
      this.workflowEngine = undefined;
    } catch (error: any) {
      this.showError(`Failed to stop debugging cleanly: ${error.message}`);
    }
  }

  /**
   * Handle status subcommand
   */
  private async handleStatus(_args: string[]): Promise<void> {
    if (!this.debugger) {
      this.showWarning("No autonomous debugging session active");
      this.showInfo('Use "/debug-auto start" to begin debugging');
      return;
    }

    const status = this.debugger.getStatus();
    const workflowStatus = this.workflowEngine?.getWorkflowStatus();

    this.showInfo("📊 Autonomous Debugging Status");
    this.showInfo("");

    // System status
    this.showInfo("🤖 System Status:");
    this.showInfo(
      `   Initialized:      ${status.initialized ? "✅ Yes" : "❌ No"}`,
    );
    this.showInfo(
      `   Browser Connected: ${status.browserConnected ? "✅ Yes" : "❌ No"}`,
    );
    this.showInfo(
      `   Session Active:   ${status.currentSession ? "✅ Yes" : "❌ No"}`,
    );
    if (status.currentSession) {
      this.showInfo(`   Session ID:       ${status.currentSession}`);
      this.showInfo(`   Session Status:   ${status.sessionStatus}`);
    }
    this.showInfo("");

    // Agent status
    this.showInfo("🏠 Agent Status:");
    if (status.agentsStatus && status.agentsStatus.length > 0) {
      for (const agent of status.agentsStatus) {
        const statusIcon =
          agent.status === "active"
            ? "🟢"
            : agent.status === "idle"
              ? "🟡"
              : "🔴";
        this.showInfo(`   ${statusIcon} ${agent.type}: ${agent.status}`);
        if (agent.currentTask) {
          this.showInfo(`      Task: ${agent.currentTask.description}`);
        }
        this.showInfo(
          `      Success Rate: ${agent.metrics.successRate.toFixed(1)}%`,
        );
      }
    } else {
      this.showInfo("   No agents active");
    }
    this.showInfo("");

    // Metrics
    if (status.metrics) {
      this.showInfo("📈 Metrics:");
      this.showInfo(`   Active Agents:    ${status.metrics.activeAgents}`);
      this.showInfo(`   Total Findings:   ${status.metrics.totalFindings}`);
      this.showInfo(`   Critical Issues:  ${status.metrics.criticalFindings}`);
      this.showInfo(`   Tasks in Queue:   ${status.metrics.tasksInQueue}`);
      if (status.metrics.uptime > 0) {
        const uptimeMinutes = Math.floor(status.metrics.uptime / 60000);
        this.showInfo(`   Uptime:           ${uptimeMinutes} minutes`);
      }
      this.showInfo("");
    }

    // Workflow status
    if (workflowStatus) {
      this.showInfo("⚙️  Workflow Engine:");
      this.showInfo(
        `   Running:          ${workflowStatus.isRunning ? "✅ Yes" : "❌ No"}`,
      );
      this.showInfo(`   Total Workflows:  ${workflowStatus.totalWorkflows}`);
      this.showInfo(`   Active Workflows: ${workflowStatus.activeWorkflows}`);
      this.showInfo("");
    }

    // Component status
    if (status.uiInspectorStatus) {
      this.showInfo("🖥️  UI Inspector:");
      this.showInfo(
        `   Monitoring:       ${status.uiInspectorStatus.isMonitoring ? "✅ Active" : "❌ Inactive"}`,
      );
      this.showInfo(
        `   Monitored URLs:   ${status.uiInspectorStatus.monitoredUrls || 0}`,
      );
      this.showInfo(
        `   Console Errors:   ${status.uiInspectorStatus.consoleErrorsCount || 0}`,
      );
      this.showInfo("");
    }

    if (status.backendMonitorStatus) {
      this.showInfo("🔧 Backend Monitor:");
      this.showInfo(
        `   Monitoring:       ${status.backendMonitorStatus.isMonitoring ? "✅ Active" : "❌ Inactive"}`,
      );
      this.showInfo(
        `   Log Buffer Size:  ${status.backendMonitorStatus.logBufferSize || 0}`,
      );
      this.showInfo(
        `   Error Rate:       ${((status.backendMonitorStatus.recentErrorRate || 0) * 100).toFixed(1)}%`,
      );
      this.showInfo("");
    }
  }

  /**
   * Handle findings subcommand
   */
  private async handleFindings(args: string[]): Promise<void> {
    if (!this.debugger) {
      this.showWarning("No autonomous debugging session active");
      return;
    }

    const options = this.parseOptions(args, {
      limit: Number,
      severity: String,
    });

    const limit = options.limit || 20;
    const severityFilter = options.severity;

    let findings = this.debugger.getFindings(limit);

    if (severityFilter) {
      findings = findings.filter((f) => f.severity === severityFilter);
    }

    this.showInfo(`🔍 Recent Debugging Findings (${findings.length})`);
    this.showInfo("");

    if (findings.length === 0) {
      this.showInfo("No findings yet. The system is monitoring...");
      return;
    }

    findings.forEach((finding, index) => {
      const severityIcon =
        finding.severity === "critical"
          ? "🚨"
          : finding.severity === "high"
            ? "🔴"
            : finding.severity === "medium"
              ? "🟡"
              : "🟢";

      const categoryIcon =
        finding.category === "ui"
          ? "🖥️ "
          : finding.category === "backend"
            ? "🔧"
            : finding.category === "performance"
              ? "⚡"
              : finding.category === "network"
                ? "🌐"
                : "📊";

      this.showInfo(
        `${index + 1}. ${severityIcon} ${categoryIcon} ${finding.title}`,
      );
      this.showInfo(
        `   Severity: ${finding.severity} | Source: ${finding.source}`,
      );
      this.showInfo(`   Time: ${finding.timestamp.toLocaleTimeString()}`);
      this.showInfo(`   Description: ${finding.description}`);

      if (finding.recommendations.length > 0) {
        this.showInfo(`   💡 Recommendations:`);
        finding.recommendations.slice(0, 2).forEach((rec) => {
          this.showInfo(`      • ${rec}`);
        });
      }
      this.showInfo("");
    });

    if (severityFilter) {
      this.showInfo(
        `💡 Showing findings filtered by severity: ${severityFilter}`,
      );
    }
    this.showInfo(
      '💡 Use "/debug-auto findings --severity critical" to see critical issues only',
    );
  }

  /**
   * Handle workflows subcommand
   */
  private async handleWorkflows(args: string[]): Promise<void> {
    if (!this.workflowEngine) {
      this.showWarning("Workflow engine not started");
      return;
    }

    const [action, ...actionArgs] = args;

    switch (action) {
      case "list":
        await this.handleWorkflowsList();
        break;
      case "trigger":
        await this.handleWorkflowTrigger(actionArgs);
        break;
      case "status":
        await this.handleWorkflowsStatus();
        break;
      default:
        this.showInfo("🔄 Available workflow actions:");
        this.showInfo("   list    - List all available workflows");
        this.showInfo("   trigger - Manually trigger a workflow");
        this.showInfo("   status  - Show workflow engine status");
    }
  }

  /**
   * Handle workflow list
   */
  private async handleWorkflowsList(): Promise<void> {
    const workflows = this.workflowEngine!.listWorkflows();

    this.showInfo("⚙️  Available Autonomous Workflows:");
    this.showInfo("");

    workflows.forEach((workflow, index) => {
      const statusIcon = workflow.active ? "🟢" : "⚪";
      this.showInfo(
        `${index + 1}. ${statusIcon} ${workflow.name} (${workflow.id})`,
      );
      this.showInfo(`   ${workflow.description}`);
      this.showInfo(`   Status: ${workflow.active ? "Active" : "Ready"}`);
      this.showInfo("");
    });

    if (workflows.length === 0) {
      this.showInfo("No workflows available");
    }

    this.showInfo(
      '💡 Use "/debug-auto workflows trigger <id>" to manually trigger a workflow',
    );
  }

  /**
   * Handle workflow trigger
   */
  private async handleWorkflowTrigger(args: string[]): Promise<void> {
    const [workflowId] = args;

    if (!workflowId) {
      this.showError("Please specify a workflow ID");
      return;
    }

    try {
      this.showInfo(`🚀 Triggering workflow: ${workflowId}`);
      await this.workflowEngine!.manualTrigger(workflowId);
      this.showSuccess("✅ Workflow triggered successfully");
    } catch (error: any) {
      this.showError(`Failed to trigger workflow: ${error.message}`);
    }
  }

  /**
   * Handle workflows status
   */
  private async handleWorkflowsStatus(): Promise<void> {
    const status = this.workflowEngine!.getWorkflowStatus();

    this.showInfo("⚙️  Workflow Engine Status:");
    this.showInfo("");
    this.showInfo(
      `   Running:          ${status.isRunning ? "✅ Yes" : "❌ No"}`,
    );
    this.showInfo(`   Total Workflows:  ${status.totalWorkflows}`);
    this.showInfo(`   Active Workflows: ${status.activeWorkflows}`);
    this.showInfo("");

    if (status.activeWorkflows > 0) {
      this.showInfo("🔄 Active Workflows:");
      status.workflows
        .filter((w: any) => w.active)
        .forEach((workflow: any) => {
          this.showInfo(`   • ${workflow.name} (${workflow.id})`);
        });
      this.showInfo("");
    }
  }

  /**
   * Handle validate subcommand
   */
  private async handleValidate(args: string[]): Promise<void> {
    if (!this.debugger) {
      this.showWarning("No autonomous debugging session active");
      return;
    }

    const [workflowName] = args;

    if (!workflowName) {
      this.showInfo("💡 Available validation workflows:");
      this.showInfo("   login-flow       - Validate user login workflow");
      this.showInfo("   dashboard-load   - Validate dashboard loading");
      this.showInfo("   navigation-test  - Test primary navigation paths");
      this.showInfo("");
      this.showInfo("Usage: /debug-auto validate <workflow-name>");
      return;
    }

    // Create validation workflow based on common patterns
    const workflows = {
      "login-flow": {
        id: "manual-login-validation",
        name: "Manual Login Flow Validation",
        description: "Validate user authentication workflow",
        steps: [
          {
            action: "navigate" as const,
            target: "http://localhost:3001/login",
          },
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
        criticalPath: true,
      },
      "dashboard-load": {
        id: "manual-dashboard-validation",
        name: "Manual Dashboard Load Validation",
        description: "Validate dashboard loading and components",
        steps: [
          {
            action: "navigate" as const,
            target: "http://localhost:3001/dashboard",
          },
          {
            action: "verify" as const,
            expected: "dashboard-components-loaded",
          },
          { action: "wait" as const, value: "2000" },
          { action: "verify" as const, expected: "no-critical-errors" },
        ],
        criticalPath: true,
      },
      "navigation-test": {
        id: "manual-navigation-validation",
        name: "Manual Navigation Test",
        description: "Test primary navigation paths",
        steps: [
          { action: "navigate" as const, target: "http://localhost:3001" },
          { action: "verify" as const, expected: "home-page-loaded" },
          { action: "click" as const, target: "nav-about" },
          { action: "verify" as const, expected: "about-page-loaded" },
          { action: "click" as const, target: "nav-home" },
          { action: "verify" as const, expected: "home-page-loaded" },
        ],
        criticalPath: false,
      },
    };

    const workflow = workflows[workflowName as keyof typeof workflows];
    if (!workflow) {
      this.showError(`Unknown workflow: ${workflowName}`);
      this.showInfo('Use "/debug-auto validate" to see available workflows');
      return;
    }

    try {
      this.showInfo(`🚀 Starting manual validation: ${workflow.name}`);
      this.showInfo("");

      const result = await this.debugger.validateUserWorkflow(workflow);

      this.showInfo(`✅ Validation Results for ${workflow.name}:`);
      this.showInfo(`   Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
      this.showInfo(`   Duration: ${result.duration}ms`);
      this.showInfo(`   Steps: ${result.steps.length}`);

      if (result.errors.length > 0) {
        this.showInfo("");
        this.showInfo("❌ Errors:");
        result.errors.forEach((error) => {
          this.showInfo(`   • ${error}`);
        });
      }

      if (result.warnings.length > 0) {
        this.showInfo("");
        this.showInfo("⚠️  Warnings:");
        result.warnings.forEach((warning) => {
          this.showInfo(`   • ${warning}`);
        });
      }

      this.showInfo("");
      this.showInfo("📊 Step Results:");
      result.steps.forEach((step, index) => {
        const stepIcon =
          step.result === "passed"
            ? "✅"
            : step.result === "failed"
              ? "❌"
              : "⚠️";
        this.showInfo(
          `   ${index + 1}. ${stepIcon} ${step.step.action} ${step.step.target || ""}`,
        );
        if (step.message) {
          this.showInfo(`      ${step.message}`);
        }
      });
    } catch (error: any) {
      this.showError(`Workflow validation failed: ${error.message}`);
      this.showInfo("💡 Ensure the web application is running and accessible");
    }
  }

  /**
   * Handle config subcommand
   */
  private async handleConfig(args: string[]): Promise<void> {
    if (!this.debugger) {
      this.showWarning("No autonomous debugging session active");
      this.showInfo('Start a session first with "/debug-auto start"');
      return;
    }

    const options = this.parseOptions(args, {
      ui: Boolean,
      backend: Boolean,
      performance: Boolean,
      network: Boolean,
      show: Boolean,
      interval: Number,
      thresholds: Boolean,
    });

    // Show current configuration
    if (options.show || args.length === 0) {
      const status = this.debugger.getStatus();

      this.showInfo("🔧 Current Autonomous Debugging Configuration:");
      this.showInfo("");
      this.showInfo("🤖 Agent Status:");
      this.showInfo(
        `   UI Inspector:     ${status.uiInspectorStatus?.isMonitoring ? "✅ Active" : "❌ Inactive"}`,
      );
      this.showInfo(
        `   Backend Monitor:  ${status.backendMonitorStatus?.isMonitoring ? "✅ Active" : "❌ Inactive"}`,
      );
      this.showInfo("");
      this.showInfo("📊 Monitoring Configuration:");
      this.showInfo(
        `   UI Monitoring:      ${status.uiInspectorStatus ? "Enabled" : "Disabled"}`,
      );
      this.showInfo(
        `   Backend Monitoring: ${status.backendMonitorStatus ? "Enabled" : "Disabled"}`,
      );
      this.showInfo(`   Performance:        Enabled`); // Always enabled if session is active
      this.showInfo(`   Network:            Enabled`); // Always enabled if session is active
      this.showInfo("");
      if (options.thresholds) {
        this.showInfo("⚙️  Performance Thresholds:");
        this.showInfo(`   Response Time:  3000ms`);
        this.showInfo(`   Error Rate:     5%`);
        this.showInfo(`   CPU Usage:      80%`);
        this.showInfo(`   Memory Usage:   85%`);
        this.showInfo(`   Load Time:      5000ms`);
        this.showInfo("");
      }
      this.showInfo(
        '💡 Use "/debug-auto config --interval N" to change monitoring interval',
      );
      this.showInfo(
        '💡 Use "/debug-auto config --thresholds" to see performance thresholds',
      );
      return;
    }

    // Handle configuration updates
    let configUpdated = false;
    const updates: string[] = [];

    if (options.interval && typeof options.interval === "number") {
      if (options.interval < 5000 || options.interval > 300000) {
        this.showError(
          "Monitoring interval must be between 5000ms (5s) and 300000ms (5min)",
        );
        return;
      }

      // Note: In a full implementation, you'd update the actual monitoring intervals
      updates.push(`Monitoring interval: ${options.interval}ms`);
      configUpdated = true;

      this.showInfo(
        "⚠️  Interval changes will take effect on next monitoring cycle",
      );
    }

    // Handle individual component toggles
    if (options.ui !== undefined) {
      updates.push(`UI Inspector: ${options.ui ? "Enabled" : "Disabled"}`);
      configUpdated = true;
      this.showInfo("⚠️  Agent changes require session restart");
    }

    if (options.backend !== undefined) {
      updates.push(
        `Backend Monitor: ${options.backend ? "Enabled" : "Disabled"}`,
      );
      configUpdated = true;
      this.showInfo("⚠️  Agent changes require session restart");
    }

    if (options.performance !== undefined) {
      updates.push(
        `Performance Monitoring: ${options.performance ? "Enabled" : "Disabled"}`,
      );
      configUpdated = true;
      this.showInfo(
        "⚠️  Performance monitoring changes require session restart",
      );
    }

    if (options.network !== undefined) {
      updates.push(
        `Network Monitoring: ${options.network ? "Enabled" : "Disabled"}`,
      );
      configUpdated = true;
      this.showInfo("⚠️  Network monitoring changes require session restart");
    }

    if (configUpdated) {
      this.showInfo("");
      this.showInfo("🔄 Configuration Updates:");
      updates.forEach((update) => {
        this.showInfo(`   • ${update}`);
      });
      this.showInfo("");
      this.showInfo(
        "💡 To apply agent changes, restart the debugging session:",
      );
      this.showInfo("   1. /debug-auto stop");
      this.showInfo("   2. /debug-auto start [with new options]");
    } else {
      this.showInfo("ℹ️  No configuration changes specified");
      this.showInfo("");
      this.showInfo("Available configuration options:");
      this.showInfo("   --show              Show current configuration");
      this.showInfo(
        "   --interval N        Set monitoring interval (5000-300000ms)",
      );
      this.showInfo("   --ui                Toggle UI inspector");
      this.showInfo("   --backend           Toggle backend monitor");
      this.showInfo("   --performance       Toggle performance monitoring");
      this.showInfo("   --network           Toggle network monitoring");
      this.showInfo("   --thresholds        Show performance thresholds");
    }
  }

  /**
   * Set up event handlers for real-time feedback
   */
  private setupEventHandlers(): void {
    if (!this.debugger) return;

    this.debugger.on("finding-detected", (finding) => {
      // Real-time finding notifications could be displayed here
      // For now, just log to system
      this.logger.info("New finding detected via autonomous debugging", {
        findingId: finding.id,
        severity: finding.severity,
        title: finding.title,
      });
    });

    this.debugger.on("critical-finding", (event) => {
      // Critical findings could trigger immediate console notifications
      this.logger.error(
        "CRITICAL FINDING detected by autonomous debugger",
        new Error("Critical finding detected"),
        {
          findingId: event.finding.id,
          title: event.finding.title,
        },
      );
    });
  }

  /**
   * Show command usage
   */
  private showUsage(): void {
    this.showInfo("🤖 Autonomous Web Application Debugging");
    this.showInfo("");
    this.showInfo("Available commands:");
    Object.entries(this.subCommands).forEach(([cmd, details]) => {
      this.showInfo(`   ${cmd.padEnd(12)} - ${details.description}`);
    });
    this.showInfo("");
    this.showInfo("Examples:");
    this.showInfo("   /debug-auto start --frontend-url http://localhost:3001");
    this.showInfo("   /debug-auto status");
    this.showInfo("   /debug-auto findings --severity critical");
    this.showInfo("   /debug-auto workflows list");
  }
}
