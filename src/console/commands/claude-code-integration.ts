/**
 * Claude Code Integration
 * Handles headless Claude Code execution with MCP context
 */

import { spawn } from 'child_process';

import { WorkspaceContext, ExecutionPlan, ClaudeCodeConfig, ClaudeCodeResponse } from '../types';

export class ClaudeCodeIntegration {
  private config: ClaudeCodeConfig;

  constructor(config: ClaudeCodeConfig) {
    this.config = {
      executablePath: 'claude',
      timeout: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Detect if input is natural language vs structured command
   */
  detectNaturalLanguage(input: string): boolean {
    // Simple heuristics for now - TDD will drive more sophisticated implementation
    
    // Slash commands are not natural language
    if (input.startsWith('/')) {
      return false;
    }

    // Simple commands with flags are not natural language
    if (input.match(/^[a-z-]+(\s+--?\w+)*$/)) {
      return false;
    }

    // Commands with specific patterns are structured
    if (input.match(/^(create|start|stop|delete|list|show)\s+\w+/)) {
      return false;
    }

    // Everything else is considered natural language
    return true;
  }

  /**
   * Execute Claude Code with full workspace context
   */
  async executeWithContext(
    naturalLanguageInput: string,
    workspaceContext: WorkspaceContext,
    mcpServerEndpoint: string
  ): Promise<ExecutionPlan> {
    // Construct Claude Code prompt with full context
    const prompt = this.buildContextualPrompt(naturalLanguageInput, workspaceContext);

    // Execute Claude Code in headless mode
    const response = await this.executeClaudeHeadless(prompt);

    // Parse Claude Code response into execution plan
    return this.parseClaudeResponse(response);
  }

  /**
   * Execute Claude Code in headless mode using -p flag
   */
  async executeClaudeHeadless(prompt: string): Promise<ClaudeCodeResponse> {
    return new Promise((resolve, reject) => {
      const claude = spawn(this.config.executablePath!, [
        '-p', prompt,
        '--output-format', 'stream-json'
      ], {
        cwd: this.config.workspacePath,
        timeout: this.config.timeout
      });

      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          try {
            const response = JSON.parse(stdout);
            resolve({
              success: true,
              ...response
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to parse Claude Code response: ${error}`
            });
          }
        } else {
          resolve({
            success: false,
            error: `Claude Code exited with code ${code}: ${stderr}`
          });
        }
      });

      claude.on('error', (error) => {
        reject(new Error(`Failed to execute Claude Code: ${error.message}`));
      });
    });
  }

  /**
   * Build contextual prompt for Claude Code
   */
  private buildContextualPrompt(input: string, context: WorkspaceContext): string {
    return `
Context: Proxmox infrastructure management workspace
Current State: ${JSON.stringify(context.currentState, null, 2)}
Available Commands: ${context.availableCommands.join(', ')}
MCP Server: ${context.mcpServerEndpoint}
Workspace: ${context.workspacePath}

User Request: "${input}"

Generate a complete execution plan using proxmox-mpc commands to fulfill this request.
Include: terraform generation, ansible configuration, testing, and deployment steps.
Provide step dependencies, estimated time, and safety considerations.

Response format:
{
  "executionPlan": [
    {
      "type": "generate|test|deploy|validate",
      "description": "Step description",
      "commands": ["command1", "command2"],
      "dependencies": ["step-id"],
      "estimatedDuration": "X minutes",
      "safetyLevel": "safe|requires_confirmation|dangerous"
    }
  ],
  "requiresConfirmation": boolean,
  "confidence": 0.0-1.0,
  "totalEstimatedTime": "X minutes"
}
`.trim();
  }

  /**
   * Parse Claude Code response into execution plan
   */
  parseClaudeResponse(response: ClaudeCodeResponse): ExecutionPlan {
    if (!response.success) {
      throw new Error(response.error || 'Claude Code execution failed');
    }

    // Enhanced parsing to extract all advanced properties
    const executionPlan = (response.executionPlan || []).map(step => ({
      ...step,
      // Extract recovery actions if present
      recoveryActions: step.recoveryActions || []
    }));

    return {
      executionPlan,
      requiresConfirmation: response.metadata?.requiresConfirmation || false,
      confidence: response.confidence || 0.5,
      // Extract additional execution plan properties
      blocked: response.metadata?.blocked,
      blockingReasons: response.metadata?.blockingReasons,
      warnings: response.metadata?.warnings,
      recommendDryRun: response.metadata?.recommendDryRun,
      totalEstimatedTime: response.metadata?.totalEstimatedTime
    };
  }
}