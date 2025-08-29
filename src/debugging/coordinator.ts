/**
 * Progress Coordinator Agent - Master Orchestrator for Autonomous Debugging
 *
 * Central coordination hub managing all debugging agents and workflows
 */

import { EventEmitter } from "events";

import { Logger } from "../observability/logger";

import {
  DebuggingSession,
  DebuggingContext,
  ActiveAgent,
  AgentType,
  DebuggingFinding,
  AgentMessage,
  DebuggingEvent,
  DebuggingConfiguration,
  DebuggingWorkflow,
  AgentTask,
} from "./types";

export class AutonomousDebuggingCoordinator extends EventEmitter {
  private logger: Logger;
  private currentSession: DebuggingSession | null = null;
  private agents: Map<AgentType, ActiveAgent> = new Map();
  private workflows: DebuggingWorkflow[] = [];
  private configuration: DebuggingConfiguration;
  private taskQueue: AgentTask[] = [];
  private isActive = false;

  constructor(configuration: DebuggingConfiguration) {
    super();
    this.logger = Logger.getInstance();
    this.configuration = configuration;
    this.initializeAgents();
  }

  /**
   * Initialize all debugging agents
   */
  private initializeAgents(): void {
    const agentTypes: AgentType[] = [
      "planner",
      "ui-inspector",
      "backend-monitor",
      "implementer",
      "validator",
      "documenter",
    ];

    agentTypes.forEach((type) => {
      if (this.configuration.agentConfiguration[type]?.enabled) {
        const agent: ActiveAgent = {
          type,
          status: "initializing",
          lastActivity: new Date(),
          metrics: {
            tasksCompleted: 0,
            averageTaskTime: 0,
            successRate: 100,
            errorCount: 0,
          },
        };
        this.agents.set(type, agent);
        this.logger.info(`Initialized ${type} agent`);
      }
    });
  }

  /**
   * Start autonomous debugging session
   */
  async startDebuggingSession(context: DebuggingContext): Promise<string> {
    if (this.currentSession) {
      throw new Error("Debugging session already active");
    }

    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      status: "initializing",
      mode: "continuous",
      context,
      agents: Array.from(this.agents.values()),
      findings: [],
    };

    this.logger.info(`Starting debugging session: ${sessionId}`, {
      sessionId,
      context,
      agentCount: this.agents.size,
    });

    try {
      // Initialize agents for this session
      await this.initializeSessionAgents(context);

      // Start monitoring workflows
      await this.startMonitoringWorkflows();

      this.currentSession.status = "active";
      this.isActive = true;

      this.emit("session-started", { sessionId, context });

      return sessionId;
    } catch (error) {
      this.currentSession.status = "error";
      this.logger.error("Failed to start debugging session", error as Error, {
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Initialize agents for the current debugging session
   */
  private async initializeSessionAgents(
    context: DebuggingContext,
  ): Promise<void> {
    const initializationTasks: Promise<void>[] = [];

    // Initialize UI Inspector Agent if UI monitoring is enabled
    if (context.monitoringScope.includeUI) {
      const uiAgent = this.agents.get("ui-inspector");
      if (uiAgent) {
        initializationTasks.push(this.initializeUIInspector(context));
      }
    }

    // Initialize Backend Monitor Agent if backend monitoring is enabled
    if (context.monitoringScope.includeBackend) {
      const backendAgent = this.agents.get("backend-monitor");
      if (backendAgent) {
        initializationTasks.push(this.initializeBackendMonitor(context));
      }
    }

    // Initialize other agents
    initializationTasks.push(this.initializePlanner(context));
    initializationTasks.push(this.initializeValidator(context));

    await Promise.all(initializationTasks);
  }

  /**
   * Initialize UI Inspector Agent
   */
  private async initializeUIInspector(
    context: DebuggingContext,
  ): Promise<void> {
    const task: AgentTask = {
      id: `ui-init-${Date.now()}`,
      type: "initialization",
      description: "Initialize UI Inspector Agent for browser automation",
      startTime: new Date(),
      estimatedDuration: 30000, // 30 seconds
      status: "in-progress",
    };

    await this.assignTaskToAgent("ui-inspector", task);

    // UI Inspector will use Playwright MCP to:
    // - Connect to browsers
    // - Start monitoring specified URLs
    // - Begin screenshot baseline capture
    // - Initialize console log monitoring

    this.logger.info("UI Inspector Agent initialized", {
      urls: [context.applicationUrls.frontend, context.applicationUrls.backend],
    });
  }

  /**
   * Initialize Backend Monitor Agent
   */
  private async initializeBackendMonitor(
    context: DebuggingContext,
  ): Promise<void> {
    const task: AgentTask = {
      id: `backend-init-${Date.now()}`,
      type: "initialization",
      description: "Initialize Backend Monitor Agent for log streaming",
      startTime: new Date(),
      estimatedDuration: 15000, // 15 seconds
      status: "in-progress",
    };

    await this.assignTaskToAgent("backend-monitor", task);

    // Backend Monitor will:
    // - Connect to existing observability system
    // - Start log streaming
    // - Initialize API endpoint monitoring
    // - Begin performance metrics collection

    this.logger.info("Backend Monitor Agent initialized");
  }

  /**
   * Initialize Planner Agent
   */
  private async initializePlanner(context: DebuggingContext): Promise<void> {
    const task: AgentTask = {
      id: `planner-init-${Date.now()}`,
      type: "initialization",
      description: "Initialize Planner Agent for strategic analysis",
      startTime: new Date(),
      estimatedDuration: 10000, // 10 seconds
      status: "in-progress",
    };

    await this.assignTaskToAgent("planner", task);

    // Planner will use Sequential thinking MCP to:
    // - Analyze debugging requirements
    // - Create monitoring strategies
    // - Plan workflow orchestration

    this.logger.info("Planner Agent initialized");
  }

  /**
   * Initialize Validator Agent
   */
  private async initializeValidator(context: DebuggingContext): Promise<void> {
    const task: AgentTask = {
      id: `validator-init-${Date.now()}`,
      type: "initialization",
      description: "Initialize Validator Agent for quality assurance",
      startTime: new Date(),
      estimatedDuration: 10000, // 10 seconds
      status: "in-progress",
    };

    await this.assignTaskToAgent("validator", task);

    this.logger.info("Validator Agent initialized");
  }

  /**
   * Start continuous monitoring workflows
   */
  private async startMonitoringWorkflows(): Promise<void> {
    if (!this.currentSession) return;

    // Start continuous UI monitoring if enabled
    if (this.currentSession.context.monitoringScope.includeUI) {
      await this.startUIMonitoringWorkflow();
    }

    // Start backend monitoring if enabled
    if (this.currentSession.context.monitoringScope.includeBackend) {
      await this.startBackendMonitoringWorkflow();
    }

    // Start performance monitoring
    if (this.currentSession.context.monitoringScope.includePerformance) {
      await this.startPerformanceMonitoringWorkflow();
    }

    this.logger.info("All monitoring workflows started");
  }

  /**
   * Start UI monitoring workflow
   */
  private async startUIMonitoringWorkflow(): Promise<void> {
    const task: AgentTask = {
      id: `ui-monitor-${Date.now()}`,
      type: "continuous-monitoring",
      description: "Continuous UI monitoring and inspection",
      startTime: new Date(),
      status: "in-progress",
    };

    await this.assignTaskToAgent("ui-inspector", task);
  }

  /**
   * Start backend monitoring workflow
   */
  private async startBackendMonitoringWorkflow(): Promise<void> {
    const task: AgentTask = {
      id: `backend-monitor-${Date.now()}`,
      type: "continuous-monitoring",
      description: "Continuous backend log and API monitoring",
      startTime: new Date(),
      status: "in-progress",
    };

    await this.assignTaskToAgent("backend-monitor", task);
  }

  /**
   * Start performance monitoring workflow
   */
  private async startPerformanceMonitoringWorkflow(): Promise<void> {
    const task: AgentTask = {
      id: `perf-monitor-${Date.now()}`,
      type: "continuous-monitoring",
      description: "Continuous performance metrics monitoring",
      startTime: new Date(),
      status: "in-progress",
    };

    // Performance monitoring can be handled by both UI and Backend agents
    await this.assignTaskToAgent("ui-inspector", task);
    await this.assignTaskToAgent("backend-monitor", task);
  }

  /**
   * Assign task to specific agent
   */
  private async assignTaskToAgent(
    agentType: AgentType,
    task: AgentTask,
  ): Promise<void> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent ${agentType} not found`);
    }

    agent.currentTask = task;
    agent.status = "active";
    agent.lastActivity = new Date();

    this.taskQueue.push(task);

    this.logger.info(`Assigned task to ${agentType}`, {
      taskId: task.id,
      taskType: task.type,
      agentType,
    });

    // Emit event for agent coordination
    this.emit("task-assigned", {
      agentType,
      task,
      sessionId: this.currentSession?.id,
    });
  }

  /**
   * Handle finding reports from agents
   */
  async reportFinding(finding: DebuggingFinding): Promise<void> {
    if (!this.currentSession) {
      this.logger.warn("Received finding report but no active session");
      return;
    }

    this.currentSession.findings.push(finding);

    this.logger.info(`New debugging finding reported`, {
      findingId: finding.id,
      severity: finding.severity,
      category: finding.category,
      source: finding.source,
      sessionId: this.currentSession.id,
    });

    // Emit finding for real-time notifications
    this.emit("finding-reported", {
      finding,
      sessionId: this.currentSession.id,
    });

    // Trigger response workflow based on severity
    if (finding.severity === "critical" || finding.severity === "high") {
      await this.triggerIncidentResponse(finding);
    }
  }

  /**
   * Trigger incident response workflow
   */
  private async triggerIncidentResponse(
    finding: DebuggingFinding,
  ): Promise<void> {
    this.logger.warn(`Triggering incident response for critical finding`, {
      findingId: finding.id,
      severity: finding.severity,
      category: finding.category,
    });

    // Switch to incident response mode
    if (this.currentSession) {
      this.currentSession.mode = "incident";
    }

    // Assign high-priority analysis tasks
    const analysisTask: AgentTask = {
      id: `incident-analysis-${Date.now()}`,
      type: "incident-analysis",
      description: `Critical incident analysis for ${finding.title}`,
      startTime: new Date(),
      estimatedDuration: 60000, // 1 minute for critical issues
      status: "pending",
    };

    // Assign to planner for immediate analysis
    await this.assignTaskToAgent("planner", analysisTask);

    // If UI issue, get immediate validator involvement
    if (finding.category === "ui") {
      const validationTask: AgentTask = {
        id: `incident-validation-${Date.now()}`,
        type: "incident-validation",
        description: `Validate and reproduce ${finding.title}`,
        startTime: new Date(),
        estimatedDuration: 30000, // 30 seconds
        status: "pending",
      };

      await this.assignTaskToAgent("validator", validationTask);
    }
  }

  /**
   * Get current debugging session status
   */
  getSessionStatus(): DebuggingSession | null {
    return this.currentSession;
  }

  /**
   * Get active agents status
   */
  getAgentsStatus(): ActiveAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Stop debugging session
   */
  async stopDebuggingSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const sessionId = this.currentSession.id;

    this.logger.info(`Stopping debugging session: ${sessionId}`);

    // Stop all agents
    for (const [agentType, agent] of this.agents) {
      agent.status = "idle";
      agent.currentTask = undefined;
    }

    // Clear task queue
    this.taskQueue = [];

    // Update session status
    this.currentSession.status = "completed";
    this.isActive = false;

    this.emit("session-stopped", {
      sessionId,
      duration: Date.now() - this.currentSession.startTime.getTime(),
      findingsCount: this.currentSession.findings.length,
    });

    this.currentSession = null;
  }

  /**
   * Handle agent status updates
   */
  updateAgentStatus(agentType: AgentType, status: ActiveAgent["status"]): void {
    const agent = this.agents.get(agentType);
    if (agent) {
      agent.status = status;
      agent.lastActivity = new Date();

      this.logger.debug(`Agent status updated`, {
        agentType,
        status,
        sessionId: this.currentSession?.id,
      });
    }
  }

  /**
   * Get debugging metrics
   */
  getMetrics(): any {
    return {
      sessionId: this.currentSession?.id,
      isActive: this.isActive,
      activeAgents: Array.from(this.agents.values()).filter(
        (a) => a.status === "active",
      ).length,
      totalFindings: this.currentSession?.findings.length || 0,
      criticalFindings:
        this.currentSession?.findings.filter((f) => f.severity === "critical")
          .length || 0,
      tasksInQueue: this.taskQueue.length,
      uptime: this.currentSession
        ? Date.now() - this.currentSession.startTime.getTime()
        : 0,
    };
  }
}
