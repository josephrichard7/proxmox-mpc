#!/usr/bin/env node
/**
 * Autonomous Web Debugging System - Demonstration Script
 *
 * This script demonstrates how to use the autonomous debugging system
 * to monitor and debug web applications with simulated Playwright MCP integration
 */

import { Logger } from "../observability/logger";

import { AutonomousWebDebugger, DebuggerUtils } from "./";

/**
 * Comprehensive demo script showing all autonomous debugging capabilities
 */
export class AutonomousDebuggingDemo {
  private logger: Logger;
  private debugger?: AutonomousWebDebugger;
  private isRunning = false;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Run the full demo with localhost web application monitoring
   */
  async runDemo(): Promise<void> {
    this.logger.info("🚀 Starting Autonomous Web Application Debugging Demo");
    console.log("");
    console.log("=".repeat(60));
    console.log("🤖 AUTONOMOUS WEB DEBUGGING SYSTEM DEMO");
    console.log("=".repeat(60));
    console.log("");

    try {
      this.isRunning = true;

      // Initialize debugger with demo configuration
      this.debugger = new AutonomousWebDebugger({
        enabled: true,
        mode: "continuous",
        agentConfiguration: {
          "ui-inspector": { enabled: true, config: { headless: false } },
          "backend-monitor": { enabled: true, config: {} },
          planner: { enabled: true, config: {} },
          validator: { enabled: true, config: {} },
          documenter: { enabled: false, config: {} }, // Disable for demo brevity
        },
        monitoring: {
          interval: 15000, // 15 seconds for faster demo feedback
          batchSize: 50,
          retentionPeriod: 1, // 1 hour for demo
        },
        thresholds: {
          responseTime: 3000, // Strict thresholds for demo
          errorRate: 5,
          cpuUsage: 80,
          memoryUsage: 85,
          loadTime: 5000,
        },
        notifications: {
          enabled: true,
          channels: ["console"],
          severity: ["critical", "high", "medium", "low"],
        },
      });

      // Set up comprehensive demo event handlers
      this.setupDemoEventHandlers();

      // Initialize the autonomous debugging system
      console.log("🔧 Initializing Multi-Agent Debugging System...");
      await this.debugger.initialize();
      console.log("✅ System initialized with browser automation capabilities");
      console.log("");

      // Create debugging context for local development environment
      const context = AutonomousWebDebugger.createWebAppContext(
        "http://localhost:3001", // React frontend
        "http://localhost:3000", // Express backend
        "http://localhost:3000/api",
      );

      // Display monitoring configuration
      this.displayMonitoringConfiguration(context);

      // Start autonomous debugging session
      console.log("🚀 Starting Autonomous Debugging Session...");
      const sessionId = await this.debugger.startDebugging(context);
      console.log(`✅ Session started: ${sessionId}`);
      console.log(
        "🕐 Continuous monitoring active with multi-agent coordination",
      );
      console.log("");

      // Show system status
      await this.displaySystemStatus();

      // Run demo scenarios
      await this.runDemoScenarios(sessionId);

      // Wait for demo completion or user interruption
      console.log("📊 Demo running... Press Ctrl+C to stop gracefully");
      await this.waitForDemoCompletion();
    } catch (error) {
      this.logger.error("Demo failed", error as Error);
      console.log(`❌ Demo error: ${(error as Error).message}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Display monitoring configuration details
   */
  private displayMonitoringConfiguration(context: any): void {
    console.log("📋 MONITORING CONFIGURATION");
    console.log("-".repeat(40));
    console.log(`🖥️  Frontend URL:    ${context.applicationUrls.frontend}`);
    console.log(`🔧 Backend URL:     ${context.applicationUrls.backend}`);
    console.log(`📡 API URL:         ${context.applicationUrls.api}`);
    console.log("");
    console.log("🤖 Active Agents:");
    console.log(
      "   • UI Inspector      - Browser automation & visual monitoring",
    );
    console.log("   • Backend Monitor   - Log analysis & API monitoring");
    console.log("   • Planner Agent     - Strategic analysis & coordination");
    console.log(
      "   • Validator Agent   - Quality assurance & workflow validation",
    );
    console.log("");
    console.log("⚙️  Performance Thresholds:");
    console.log("   • Response Time:    3000ms");
    console.log("   • Error Rate:       5%");
    console.log("   • Load Time:        5000ms");
    console.log("   • CPU Usage:        80%");
    console.log("   • Memory Usage:     85%");
    console.log("");
  }

  /**
   * Display current system status
   */
  private async displaySystemStatus(): Promise<void> {
    if (!this.debugger) return;

    const status = this.debugger.getStatus();

    console.log("📊 SYSTEM STATUS");
    console.log("-".repeat(40));
    console.log(
      `🔧 Initialized:       ${status.initialized ? "✅ Yes" : "❌ No"}`,
    );
    console.log(
      `🌐 Browser Connected: ${status.browserConnected ? "✅ Yes" : "❌ No (simulated)"}`,
    );
    console.log(
      `📋 Session Active:    ${status.currentSession ? "✅ Yes" : "❌ No"}`,
    );

    if (status.agentsStatus && status.agentsStatus.length > 0) {
      console.log("");
      console.log("🤖 Agent Status:");
      status.agentsStatus.forEach((agent: any) => {
        const statusIcon =
          agent.status === "active"
            ? "🟢"
            : agent.status === "idle"
              ? "🟡"
              : "🔴";
        console.log(
          `   ${statusIcon} ${agent.type.padEnd(15)}: ${agent.status}`,
        );
      });
    }
    console.log("");
  }

  /**
   * Set up comprehensive event handlers for demo feedback
   */
  private setupDemoEventHandlers(): void {
    if (!this.debugger) return;

    // Handle finding detection with rich feedback
    this.debugger.on("finding-detected", (finding) => {
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
          ? "🖥️"
          : finding.category === "backend"
            ? "🔧"
            : finding.category === "performance"
              ? "⚡"
              : finding.category === "network"
                ? "🌐"
                : finding.category === "security"
                  ? "🛡️"
                  : "📊";

      console.log("");
      console.log("🔍 NEW FINDING DETECTED");
      console.log("━".repeat(50));
      console.log(`${severityIcon} ${categoryIcon} ${finding.title}`);
      console.log(`📅 Time:        ${finding.timestamp.toLocaleTimeString()}`);
      console.log(`🎯 Severity:    ${finding.severity.toUpperCase()}`);
      console.log(`📂 Category:    ${finding.category}`);
      console.log(`🤖 Source:      ${finding.source}`);
      console.log(`📝 Description: ${finding.description}`);

      if (finding.recommendations.length > 0) {
        console.log("💡 Recommendations:");
        finding.recommendations
          .slice(0, 3)
          .forEach((rec: string, index: number) => {
            console.log(`   ${index + 1}. ${rec}`);
          });
      }

      // Show evidence summary
      if (finding.evidence) {
        const evidenceCount =
          (finding.evidence.screenshots?.length || 0) +
          (finding.evidence.logs?.length || 0) +
          (finding.evidence.consoleErrors?.length || 0) +
          (finding.evidence.networkRequests?.length || 0);
        if (evidenceCount > 0) {
          console.log(`📊 Evidence:    ${evidenceCount} items collected`);
        }
      }

      console.log("━".repeat(50));
      console.log("");
    });

    // Handle critical findings with urgent alerts
    this.debugger.on("critical-finding", (event) => {
      console.log("");
      console.log("🚨".repeat(20));
      console.log("🚨 CRITICAL FINDING - IMMEDIATE ATTENTION REQUIRED 🚨");
      console.log("🚨".repeat(20));
      console.log(`📋 Title: ${event.finding.title}`);
      console.log(`📝 Description: ${event.finding.description}`);
      console.log(`🕐 Time: ${event.finding.timestamp.toLocaleString()}`);
      console.log(`🆔 Session: ${event.sessionId}`);
      console.log("");
      console.log("💡 IMMEDIATE ACTIONS RECOMMENDED:");
      event.finding.recommendations.forEach((rec: string, index: number) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
      console.log("🚨".repeat(20));
      console.log("");
    });

    // Handle session lifecycle events
    this.debugger.on("session-started", (data) => {
      console.log("🎉 AUTONOMOUS DEBUGGING SESSION STARTED");
      console.log(`🆔 Session ID: ${data.sessionId}`);
      console.log("🤖 Multi-agent coordination active");
      console.log("📡 Real-time monitoring enabled");
      console.log("🔄 Continuous workflow monitoring active");
      console.log("");
    });

    // Handle Playwright integration events (simulated)
    this.debugger.on("playwright-availability-check", () => {
      console.log("🔍 Checking Playwright MCP availability...");
      // Simulate response
      setTimeout(() => {
        console.log("✅ Playwright MCP integration ready (simulated)");
      }, 1000);
    });

    this.debugger.on("browser-init-request", (request) => {
      console.log(
        `🌐 Browser initialization requested for ${request.browsers?.join(", ")}`,
      );
      // Simulate browser initialization
      setTimeout(() => {
        console.log("✅ Browser connection established (simulated)");
      }, 2000);
    });
  }

  /**
   * Run comprehensive demo scenarios
   */
  private async runDemoScenarios(sessionId: string): Promise<void> {
    console.log("🎬 RUNNING DEMO SCENARIOS");
    console.log("-".repeat(40));
    console.log(
      "The system will now simulate real findings over the next 2 minutes...",
    );
    console.log("");

    // Scenario 1: UI Warning Detection (10 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      console.log("📍 SCENARIO 1: UI Warning Detection");
      this.simulateUIWarning();
    }, 10000);

    // Scenario 2: Performance Issue (25 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      console.log("📍 SCENARIO 2: Performance Degradation");
      this.simulatePerformanceIssue();
    }, 25000);

    // Scenario 3: Network Problems (45 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      console.log("📍 SCENARIO 3: Network Issues");
      this.simulateNetworkIssues();
    }, 45000);

    // Scenario 4: Critical Application Error (70 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      console.log("📍 SCENARIO 4: Critical Application Error");
      this.simulateCriticalError(sessionId);
    }, 70000);

    // Scenario 5: Recovery and Validation (100 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      console.log("📍 SCENARIO 5: Recovery and Validation");
      this.simulateRecoveryValidation();
    }, 100000);
  }

  /**
   * Simulate UI warning detection
   */
  private simulateUIWarning(): void {
    this.debugger?.emit("finding-detected", {
      id: `demo-ui-warning-${Date.now()}`,
      timestamp: new Date(),
      severity: "medium" as const,
      category: "ui" as const,
      title: "React DevTools Warning Detected",
      description: "Missing key props detected in list rendering components",
      source: "ui-inspector" as const,
      evidence: {
        consoleErrors: [
          {
            timestamp: new Date(),
            level: "warn" as const,
            message:
              'Warning: Each child in a list should have a unique "key" prop',
            source: "React",
            lineNumber: 42,
          },
        ],
        screenshots: ["ui-warning-screenshot.png"],
      },
      recommendations: [
        "Add unique key props to list items in React components",
        "Review component rendering patterns for performance optimization",
        "Use React DevTools to identify specific problematic components",
        "Implement automated key prop validation in development builds",
      ],
      status: "new" as const,
    });
  }

  /**
   * Simulate performance degradation
   */
  private simulatePerformanceIssue(): void {
    this.debugger?.emit("finding-detected", {
      id: `demo-performance-${Date.now()}`,
      timestamp: new Date(),
      severity: "high" as const,
      category: "performance" as const,
      title: "Slow API Response Time Detected",
      description:
        "API endpoint /api/data consistently responding above performance threshold",
      source: "backend-monitor" as const,
      evidence: {
        performanceMetrics: [
          {
            timestamp: new Date(),
            metric: "api_response_time",
            value: 4250,
            unit: "ms",
            threshold: 3000,
            target: 1000,
          },
        ],
        networkRequests: [
          {
            timestamp: new Date(),
            method: "GET",
            url: "/api/data",
            statusCode: 200,
            responseTime: 4250,
            size: 2048,
            headers: { "content-type": "application/json" },
          },
        ],
        logs: [
          {
            timestamp: new Date(),
            level: "warn" as const,
            message:
              "Database query taking longer than expected: SELECT * FROM large_table",
            source: "database",
            context: { query_time: 3800 },
          },
        ],
      },
      recommendations: [
        "Optimize database queries for /api/data endpoint with proper indexing",
        "Implement response caching for frequently requested data",
        "Consider pagination for large datasets to reduce payload size",
        "Review server resource utilization and scaling options",
        "Add database connection pooling if not already implemented",
      ],
      status: "new" as const,
    });
  }

  /**
   * Simulate network issues
   */
  private simulateNetworkIssues(): void {
    this.debugger?.emit("finding-detected", {
      id: `demo-network-${Date.now()}`,
      timestamp: new Date(),
      severity: "medium" as const,
      category: "network" as const,
      title: "Failed API Requests Detected",
      description:
        "Multiple API requests failing with timeout and connection errors",
      source: "ui-inspector" as const,
      evidence: {
        networkRequests: [
          {
            timestamp: new Date(),
            method: "GET",
            url: "/api/users",
            statusCode: 408,
            responseTime: 30000,
            size: 0,
            headers: {},
            error: "Request timeout",
          },
          {
            timestamp: new Date(),
            method: "POST",
            url: "/api/auth/login",
            statusCode: 503,
            responseTime: 5000,
            size: 128,
            headers: { "content-type": "application/json" },
            error: "Service unavailable",
          },
        ],
        consoleErrors: [
          {
            timestamp: new Date(),
            level: "error" as const,
            message: "Network Error: Request failed with status code 408",
            source: "axios",
            lineNumber: 89,
          },
        ],
      },
      recommendations: [
        "Check API server availability and health endpoints",
        "Verify network connectivity between frontend and backend",
        "Implement request retry logic with exponential backoff",
        "Add proper error handling for network failures",
        "Consider implementing offline mode or graceful degradation",
      ],
      status: "new" as const,
    });
  }

  /**
   * Simulate critical application error
   */
  private simulateCriticalError(sessionId: string): void {
    const criticalFinding = {
      id: `demo-critical-${Date.now()}`,
      timestamp: new Date(),
      severity: "critical" as const,
      category: "ui" as const,
      title: "Application Crash - Runtime Error",
      description:
        "Frontend application crashed due to unhandled JavaScript runtime error",
      source: "ui-inspector" as const,
      evidence: {
        consoleErrors: [
          {
            timestamp: new Date(),
            level: "error" as const,
            message:
              "TypeError: Cannot read properties of undefined (reading 'id')",
            source: "app.js",
            lineNumber: 156,
            stackTrace: `TypeError: Cannot read properties of undefined (reading 'id')
    at Component.render (app.js:156:12)
    at finishClassComponent (react-dom.js:2847:31)
    at updateClassComponent (react-dom.js:2797:24)`,
          },
        ],
        screenshots: ["crash-screenshot.png", "error-boundary-screenshot.png"],
      },
      recommendations: [
        "IMMEDIATE: Add null/undefined checks before accessing object properties",
        "Implement React Error Boundaries to prevent application crashes",
        "Add proper error handling for async operations and API responses",
        "Consider implementing graceful degradation patterns",
        "Add comprehensive logging for better error tracking",
        "Implement automated error reporting and alerting",
      ],
      status: "new" as const,
    };

    this.debugger?.emit("finding-detected", criticalFinding);

    // Trigger critical alert
    setTimeout(() => {
      this.debugger?.emit("critical-finding", {
        finding: criticalFinding,
        timestamp: new Date(),
        sessionId,
      });
    }, 2000);
  }

  /**
   * Simulate recovery and validation
   */
  private simulateRecoveryValidation(): void {
    this.debugger?.emit("finding-detected", {
      id: `demo-recovery-${Date.now()}`,
      timestamp: new Date(),
      severity: "info" as const,
      category: "ui" as const,
      title: "Automated Recovery Workflow Completed",
      description:
        "System automatically validated critical user workflows after error recovery",
      source: "validator" as const,
      evidence: {
        screenshots: ["recovery-validation-screenshot.png"],
      },
      recommendations: [
        "Monitor application stability over the next 15 minutes",
        "Review error logs for similar patterns to prevent recurrence",
        "Consider implementing additional automated recovery workflows",
        "Update monitoring thresholds based on recovery patterns",
      ],
      status: "new" as const,
    });
  }

  /**
   * Wait for demo completion or user interruption
   */
  private async waitForDemoCompletion(): Promise<void> {
    return new Promise((resolve) => {
      // Demo runs for 2 minutes unless interrupted
      const demoTimeout = setTimeout(() => {
        console.log("");
        console.log("=".repeat(60));
        console.log("✅ DEMO COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log("");
        console.log("📊 Demo Summary:");
        console.log(
          "   • Multi-agent autonomous debugging system demonstrated",
        );
        console.log("   • Real-time finding detection and classification");
        console.log("   • Critical error handling with immediate alerting");
        console.log("   • WebSocket integration for live updates");
        console.log("   • Comprehensive workflow validation capabilities");
        console.log("");
        console.log("🚀 Ready for production deployment!");
        console.log("");
        this.isRunning = false;
        resolve();
      }, 120000); // 2 minutes

      // Allow graceful shutdown on SIGINT
      const shutdownHandler = async () => {
        clearTimeout(demoTimeout);
        this.isRunning = false;

        console.log("\n🛑 Demo interrupted by user");
        console.log("🧹 Cleaning up resources...");

        if (this.debugger) {
          await this.debugger.stopDebugging();
          console.log("✅ Autonomous debugging stopped gracefully");
        }

        console.log("👋 Demo ended. Thank you!");
        resolve();
      };

      process.on("SIGINT", shutdownHandler);
      process.on("SIGTERM", shutdownHandler);
    });
  }

  /**
   * Clean up demo resources
   */
  private async cleanup(): Promise<void> {
    if (this.debugger && this.isRunning) {
      await this.debugger.stopDebugging();
      this.logger.info("🧹 Demo resources cleaned up");
    }
  }

  /**
   * Get demo status
   */
  getStatus(): { running: boolean; debugger: any } {
    return {
      running: this.isRunning,
      debugger: this.debugger?.getStatus() || null,
    };
  }
}

/**
 * Create and export a convenient function to run the demo
 */
export async function runAutonomousDebuggingDemo(): Promise<void> {
  const demo = new AutonomousDebuggingDemo();
  await demo.runDemo();
}

/**
 * Run demo if this file is executed directly
 */
if (require.main === module) {
  console.log("🚀 Starting Autonomous Web Debugging Demo...");
  console.log("");

  runAutonomousDebuggingDemo()
    .then(() => {
      console.log("✅ Demo completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Demo failed:", error.message);
      console.error(error.stack);
      process.exit(1);
    });
}
