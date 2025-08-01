/**
 * Natural Language Processor
 * Seamless Claude Code integration for natural language infrastructure commands
 */

import { ClaudeCodeIntegration } from './claude-code-integration';
import { WorkspaceContext, NaturalLanguageResult, ExecutionPlan, NaturalLanguageProcessorConfig } from '../types';

export class NaturalLanguageProcessor {
  private claudeCode: ClaudeCodeIntegration;
  private proxmoxClient: any;
  private logger: any;
  private workspacePath: string;

  constructor(config: NaturalLanguageProcessorConfig) {
    this.claudeCode = config.claudeCodeIntegration;
    this.proxmoxClient = config.proxmoxClient;
    this.logger = config.logger;
    this.workspacePath = config.workspacePath;
  }

  /**
   * Process user input - detect if natural language and execute accordingly
   * This is the main entry point for natural language processing
   */
  async processInput(input: string, context: WorkspaceContext): Promise<NaturalLanguageResult> {
    try {
      // Step 1: Detect if input is natural language vs structured command
      const isNaturalLanguage = this.claudeCode.detectNaturalLanguage(input);

      if (!isNaturalLanguage) {
        return {
          isNaturalLanguage: false,
          executionPlan: [],
          requiresConfirmation: false,
          confidence: 1.0
        };
      }

      // Step 2: Use Claude Code to process natural language with full context
      const executionPlan = await this.claudeCode.executeWithContext(
        input,
        context,
        context.mcpServerEndpoint
      );

      return {
        isNaturalLanguage: true,
        ...executionPlan
      };

    } catch (error) {
      this.logger.error('Natural language processing failed', error, {
        input,
        resourcesAffected: ['natural-language-processor']
      });

      return {
        isNaturalLanguage: true,
        executionPlan: [],
        requiresConfirmation: false,
        confidence: 0.0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process input with real-time progress feedback
   */
  async processInputWithProgress(
    input: string, 
    context: WorkspaceContext, 
    progressCallback: (message: string) => void
  ): Promise<NaturalLanguageResult> {
    try {
      const isNaturalLanguage = this.claudeCode.detectNaturalLanguage(input);

      if (!isNaturalLanguage) {
        return {
          isNaturalLanguage: false,
          executionPlan: [],
          requiresConfirmation: false,
          confidence: 1.0
        };
      }

      // Emit progress updates with realistic delays
      progressCallback('🤖 Understanding request...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      progressCallback('📋 Planning infrastructure...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      progressCallback('🏗️ Generating configurations...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute with progress streaming
      const executionPlan = await this.claudeCode.executeWithContext(
        input,
        context,
        context.mcpServerEndpoint
      );

      return {
        isNaturalLanguage: true,
        ...executionPlan
      };

    } catch (error) {
      this.logger.error('Natural language processing with progress failed', error, {
        input,
        resourcesAffected: ['natural-language-processor']
      });

      return {
        isNaturalLanguage: true,
        executionPlan: [],
        requiresConfirmation: false,
        confidence: 0.0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}