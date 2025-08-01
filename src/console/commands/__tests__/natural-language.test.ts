/**
 * Natural Language Interface TDD Test Suite
 * Tests for seamless Claude Code integration in proxmox-mpc console
 * 
 * TDD Approach:
 * 1. Write failing tests first
 * 2. Implement minimal code to pass
 * 3. Refactor and improve
 * 4. Repeat for each feature
 */

import { NaturalLanguageProcessor } from '../natural-language';
import { ClaudeCodeIntegration } from '../claude-code-integration';
import { WorkspaceContext } from '../../types';
import { ProxmoxClient } from '../../../api/proxmox-client';
import { Logger } from '../../../observability/logger';

// Mock dependencies
jest.mock('../claude-code-integration');
jest.mock('../../../api/proxmox-client');
jest.mock('../../../observability/logger');

describe('Natural Language Interface TDD Tests', () => {
  let nlProcessor: NaturalLanguageProcessor;
  let mockClaudeCode: jest.Mocked<ClaudeCodeIntegration>;
  let mockProxmoxClient: jest.Mocked<ProxmoxClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockWorkspaceContext: WorkspaceContext;

  beforeEach(() => {
    mockClaudeCode = {
      executeWithContext: jest.fn(),
      detectNaturalLanguage: jest.fn(),
      parseClaudeResponse: jest.fn(),
      executeClaudeHeadless: jest.fn(),
      buildContextualPrompt: jest.fn()
    } as any;

    mockProxmoxClient = {
      getNodes: jest.fn(),
      getVMs: jest.fn(),
      getContainers: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    } as any;

    mockWorkspaceContext = {
      workspacePath: '/test/workspace',
      configExists: true,
      mcpServerEndpoint: 'http://localhost:3000/mcp',
      currentState: {
        nodes: [{ node: 'pve-01', status: 'online' }],
        vms: [{ vmid: 100, name: 'web-01', status: 'running' }],
        containers: []
      },
      availableCommands: [
        'create vm', 'create container', '/sync', '/apply', '/test'
      ]
    };

    nlProcessor = new NaturalLanguageProcessor({
      claudeCodeIntegration: mockClaudeCode,
      proxmoxClient: mockProxmoxClient,
      logger: mockLogger,
      workspacePath: '/test/workspace'
    });
  });

  describe('Natural Language Detection', () => {
    it('should detect natural language vs slash commands', async () => {
      // Test cases for detection
      const testCases = [
        { input: '/sync', expected: false, description: 'slash command' },
        { input: '/apply --dry-run', expected: false, description: 'slash command with flags' },
        { input: 'Create 3 VMs with Talos/k8s', expected: true, description: 'natural language' },
        { input: 'Show me the status of all VMs', expected: true, description: 'natural language query' },
        { input: 'help', expected: false, description: 'simple command' },
        { input: 'create vm web-01 --cores 4', expected: false, description: 'structured command' },
        { input: 'Set up a complete development environment with GitLab', expected: true, description: 'complex natural language' }
      ];

      for (const testCase of testCases) {
        mockClaudeCode.detectNaturalLanguage.mockReturnValue(testCase.expected);

        const result = await nlProcessor.processInput(testCase.input, mockWorkspaceContext);
        
        expect(result.isNaturalLanguage).toBe(testCase.expected);
        expect(mockClaudeCode.detectNaturalLanguage).toHaveBeenCalledWith(testCase.input);
      }
    });

    it('should handle ambiguous inputs with confidence scoring', async () => {
      const ambiguousInput = 'start web server';
      
      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'deploy',
            description: 'Start VM web-01',
            commands: ['start vm 100'],
            dependencies: [],
            confidence: 0.85
          }
        ],
        requiresConfirmation: true,
        confidence: 0.85
      });

      const result = await nlProcessor.processInput(ambiguousInput, mockWorkspaceContext);

      expect(result.isNaturalLanguage).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.executionPlan).toHaveLength(1);
      expect(result.executionPlan[0].confidence).toBe(0.85);
    });
  });

  describe('Claude Code Integration', () => {
    it('should pass full workspace context to Claude Code', async () => {
      const naturalLanguageInput = 'Create 3 VMs for a Kubernetes cluster';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate Terraform for 3 VMs',
            commands: ['create vm k8s-master-01 --cores 2 --memory 4096'],
            dependencies: []
          }
        ],
        requiresConfirmation: false,
        confidence: 0.95
      });

      await nlProcessor.processInput(naturalLanguageInput, mockWorkspaceContext);

      expect(mockClaudeCode.executeWithContext).toHaveBeenCalledWith(
        naturalLanguageInput,
        mockWorkspaceContext,
        'http://localhost:3000/mcp'
      );
    });

    it('should handle Claude Code execution errors gracefully', async () => {
      const naturalLanguageInput = 'Create a VM with invalid configuration';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockRejectedValue(
        new Error('Claude Code execution failed: Invalid parameters')
      );

      const result = await nlProcessor.processInput(naturalLanguageInput, mockWorkspaceContext);

      expect(result.isNaturalLanguage).toBe(true);
      expect(result.executionPlan).toEqual([]);
      expect(result.error).toContain('Claude Code execution failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Natural language processing failed'),
        expect.any(Error),
        expect.objectContaining({
          input: naturalLanguageInput,
          resourcesAffected: ['natural-language-processor']
        })
      );
    });

    it('should generate comprehensive execution plans', async () => {
      const complexInput = 'Set up a complete development environment with GitLab, registry, and CI runners';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate Terraform configurations',
            commands: [
              'create vm gitlab-server --cores 4 --memory 8192',
              'create vm postgresql-db --cores 2 --memory 4096',
              'create vm redis-cache --cores 1 --memory 2048'
            ],
            dependencies: []
          },
          {
            type: 'test',
            description: 'Generate and run infrastructure tests',
            commands: ['/test --comprehensive'],
            dependencies: ['generate']
          },
          {
            type: 'deploy',
            description: 'Deploy infrastructure',
            commands: ['/apply --confirm'],
            dependencies: ['test']
          },
          {
            type: 'validate',
            description: 'Validate deployment',
            commands: ['/health --detailed'],
            dependencies: ['deploy']
          }
        ],
        requiresConfirmation: true,
        confidence: 0.92,
        estimatedTime: '12-15 minutes'
      });

      const result = await nlProcessor.processInput(complexInput, mockWorkspaceContext);

      expect(result.executionPlan).toHaveLength(4);
      expect(result.executionPlan[0].type).toBe('generate');
      expect(result.executionPlan[1].dependencies).toContain('generate');
      expect(result.executionPlan[2].dependencies).toContain('test');
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Multi-Step Workflow Execution', () => {
    it('should execute steps in dependency order', async () => {
      const input = 'Create and deploy a load balancer for web servers';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate HAProxy configuration',
            commands: ['create vm lb-web-01 --cores 2 --memory 2048'],
            dependencies: [],
            stepId: 'generate-lb'
          },
          {
            type: 'test',
            description: 'Test load balancer configuration',
            commands: ['/test --component lb-web-01'],
            dependencies: ['generate-lb'],
            stepId: 'test-lb'
          },
          {
            type: 'deploy',
            description: 'Deploy load balancer',
            commands: ['/apply --target lb-web-01'],
            dependencies: ['test-lb'],
            stepId: 'deploy-lb'
          }
        ],
        requiresConfirmation: false,
        confidence: 0.90
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      // Verify execution plan has correct dependency chain
      expect(result.executionPlan).toHaveLength(3);
      expect(result.executionPlan[0].dependencies).toEqual([]);
      expect(result.executionPlan[1].dependencies).toContain('generate-lb');
      expect(result.executionPlan[2].dependencies).toContain('test-lb');
    });

    it('should handle step failures and provide recovery options', async () => {
      const input = 'Deploy a complex application stack';

      // Mock Claude Code detection and direct execution
      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate application configurations',
            commands: ['create vm app-01 --cores 4 --memory 8192'],
            dependencies: [],
            stepId: 'generate-app',
            recoveryActions: []
          },
          {
            type: 'test',
            description: 'Test application setup',
            commands: ['/test --app app-01'],
            dependencies: ['generate-app'],
            stepId: 'test-app',
            expectedFailure: true,
            recoveryActions: [
              'Verify resource availability on target node',
              'Check network configuration',
              'Retry with different resource allocation'
            ]
          }
        ],
        requiresConfirmation: true,
        confidence: 0.75,
        warnings: ['Step may fail due to resource constraints']
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      expect(result.executionPlan).toBeDefined();
      expect(result.executionPlan).toHaveLength(2);
      expect(result.executionPlan[1].recoveryActions).toBeDefined();
      expect(result.executionPlan[1].recoveryActions).toHaveLength(3);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Progress Streaming and Feedback', () => {
    it('should provide real-time progress updates during execution', async () => {
      const input = 'Create 3 VMs with monitoring';
      const progressCallback = jest.fn();

      // Mock Claude Code detection and execution
      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate VM configurations',
            commands: [
              'create vm monitoring-01 --cores 2 --memory 4096',
              'create vm monitoring-02 --cores 2 --memory 4096',
              'create vm monitoring-03 --cores 2 --memory 4096'
            ],
            dependencies: []
          }
        ],
        requiresConfirmation: false,
        confidence: 0.95
      });

      await nlProcessor.processInputWithProgress(input, mockWorkspaceContext, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith('🤖 Understanding request...');
      expect(progressCallback).toHaveBeenCalledWith('📋 Planning infrastructure...');
      expect(progressCallback).toHaveBeenCalledWith('🏗️ Generating configurations...');
    });

    it('should provide estimated completion times', async () => {
      const input = 'Deploy a complete monitoring stack';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Generate monitoring configurations',
            commands: ['create vm prometheus-01 --cores 4 --memory 8192'],
            dependencies: [],
            estimatedDuration: '2-3 minutes'
          },
          {
            type: 'deploy',
            description: 'Deploy monitoring stack',
            commands: ['/apply --monitoring'],
            dependencies: ['generate'],
            estimatedDuration: '5-7 minutes'
          }
        ],
        requiresConfirmation: true,
        confidence: 0.88,
        totalEstimatedTime: '7-10 minutes'
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      expect(result.executionPlan[0].estimatedDuration).toBe('2-3 minutes');
      expect(result.executionPlan[1].estimatedDuration).toBe('5-7 minutes');
      expect(result.totalEstimatedTime).toBe('7-10 minutes');
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should validate infrastructure requirements before execution', async () => {
      const input = 'Create 10 VMs with 32GB RAM each';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'validate',
            description: 'Check resource availability',
            commands: ['/health --resources'],
            dependencies: [],
            validationErrors: [
              'Insufficient memory: Required 320GB, Available 128GB',
              'Node pve-01 at 95% capacity'
            ]
          }
        ],
        requiresConfirmation: true,
        confidence: 0.60,
        blocked: true,
        blockingReasons: ['Resource constraints prevent execution']
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      expect(result.executionPlan[0].validationErrors).toHaveLength(2);
      expect(result.blocked).toBe(true);
      expect(result.blockingReasons).toContain('Resource constraints prevent execution');
    });

    it('should provide intelligent error recovery suggestions', async () => {
      const input = 'Deploy application that requires specific ports';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'deploy',
            description: 'Deploy application with port requirements',
            commands: ['create vm app-server --ports 80,443,8080'],
            dependencies: [],
            potentialIssues: [
              {
                issue: 'Port 80 already in use by existing service',
                severity: 'warning',
                suggestions: [
                  'Use alternative port 8080',
                  'Stop conflicting service first',
                  'Configure reverse proxy'
                ]
              }
            ]
          }
        ],
        requiresConfirmation: true,
        confidence: 0.82
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      expect(result.executionPlan[0].potentialIssues).toHaveLength(1);
      expect(result.executionPlan[0].potentialIssues?.[0].suggestions).toHaveLength(3);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Context Awareness and Learning', () => {
    it('should use current infrastructure state for intelligent decisions', async () => {
      const input = 'Scale up the web tier';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);

      // Mock current state with existing web servers
      const contextWithWebServers: WorkspaceContext = {
        ...mockWorkspaceContext,
        currentState: {
          nodes: [{ node: 'pve-01', status: 'online' }],
          vms: [
            { vmid: 100, name: 'web-01', status: 'running', cpu: 0.85 },
            { vmid: 101, name: 'web-02', status: 'running', cpu: 0.90 }
          ],
          containers: []
        }
      };

      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Scale web tier based on current utilization',
            commands: [
              'create vm web-03 --cores 4 --memory 8192',
              'create vm lb-web-01 --cores 2 --memory 4096'
            ],
            dependencies: [],
            reasoning: 'Detected high CPU utilization (85-90%) on existing web servers web-01 and web-02'
          }
        ],
        requiresConfirmation: false,
        confidence: 0.95
      });

      const result = await nlProcessor.processInput(input, contextWithWebServers);

      expect(result.executionPlan[0].reasoning).toContain('high CPU utilization');
      expect(result.executionPlan[0].commands).toHaveLength(2);
      expect(result.executionPlan[0].commands[1]).toContain('lb-web-01'); // Load balancer added
    });

    it('should learn from previous operations and suggest improvements', async () => {
      const input = 'Create another database server';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);

      // Mock context with existing database and known configuration patterns
      const contextWithHistory: WorkspaceContext = {
        ...mockWorkspaceContext,
        previousOperations: [
          {
            operation: 'create vm db-01',
            timestamp: '2024-08-01T10:00:00Z',
            success: true,
            configuration: { cores: 4, memory: 8192, storage: 'local-lvm' }
          }
        ]
      };

      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'generate',
            description: 'Create database server with optimized configuration',
            commands: ['create vm db-02 --cores 4 --memory 8192 --storage local-lvm'],
            dependencies: [],
            optimizations: [
              'Using proven configuration from db-01',
              'Added backup storage configuration',
              'Configured for database clustering'
            ]
          }
        ],
        requiresConfirmation: false,
        confidence: 0.93
      });

      const result = await nlProcessor.processInput(input, contextWithHistory);

      expect(result.executionPlan[0].optimizations).toHaveLength(3);
      expect(result.executionPlan[0].commands[0]).toContain('--cores 4 --memory 8192');
    });
  });

  describe('Safety and Confirmation Logic', () => {
    it('should require confirmation for destructive operations', async () => {
      const destructiveInputs = [
        'Delete all test VMs',
        'Destroy the development environment',
        'Remove all containers',
        'Reset the cluster configuration'
      ];

      for (const input of destructiveInputs) {
        mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
        mockClaudeCode.executeWithContext.mockResolvedValue({
          executionPlan: [
            {
              type: 'destroy',
              description: 'Destructive operation detected',
              commands: ['delete vm --pattern test-*'],
              dependencies: [],
              safetyLevel: 'dangerous'
            }
          ],
          requiresConfirmation: true,
          confidence: 0.95,
          safetyWarnings: ['This operation will permanently delete resources']
        });

        const result = await nlProcessor.processInput(input, mockWorkspaceContext);

        expect(result.requiresConfirmation).toBe(true);
        expect(result.safetyWarnings).toBeDefined();
        expect(result.executionPlan[0].safetyLevel).toBe('dangerous');
      }
    });

    it('should provide dry-run options for complex operations', async () => {
      const input = 'Migrate all VMs to new storage';

      mockClaudeCode.detectNaturalLanguage.mockReturnValue(true);
      mockClaudeCode.executeWithContext.mockResolvedValue({
        executionPlan: [
          {
            type: 'migrate',
            description: 'Migrate VMs to new storage',
            commands: ['migrate vm --all --to new-storage --dry-run'],
            dependencies: [],
            dryRunAvailable: true,
            safetyLevel: 'requires_confirmation'
          }
        ],
        requiresConfirmation: true,
        confidence: 0.88,
        recommendDryRun: true
      });

      const result = await nlProcessor.processInput(input, mockWorkspaceContext);

      expect(result.executionPlan[0].dryRunAvailable).toBe(true);
      expect(result.recommendDryRun).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });
  });
});

/**
 * Integration Tests for Natural Language Interface
 * Test end-to-end functionality with real Claude Code integration
 */
describe('Natural Language Interface Integration Tests', () => {
  // These tests would be run against actual Claude Code integration
  // when the implementation is complete

  it.skip('should integrate with actual Claude Code headless mode', async () => {
    // This test will be implemented when the actual Claude Code integration is built
    // It will test the full pipeline: NL input → Claude Code → MCP context → execution
  });

  it.skip('should handle real-world complex infrastructure requests', async () => {
    // This test will validate the system with actual complex requests
    // like "Set up a production-ready Kubernetes cluster with monitoring"
  });

  it.skip('should maintain context across multiple natural language interactions', async () => {
    // This test will verify that the system can handle follow-up questions
    // and maintain context across a conversation
  });
});