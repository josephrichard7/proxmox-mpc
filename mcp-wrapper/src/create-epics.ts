#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create GitHub Project Epics and organize issues
 */
class EpicOrganizer {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
    this.repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
  }

  // Define epic structure based on PLAN.md phases
  private getEpics() {
    return [
      {
        title: "🏗️ EPIC: Phase 1-6 Foundation (COMPLETED)",
        body: `# 🎉 EPIC: Phase 1-6 Foundation - PRODUCTION READY v1.0.0

## Epic Overview
Complete foundation infrastructure including core API, database, CLI, console, and IaC generation.

## Epic Status: ✅ COMPLETED
**Achievement**: Full production-ready v1.0.0 release

## Epic Scope
- **Phase 1**: Foundation & Core Infrastructure  
- **Phase 2**: Database & State Management
- **Phase 3**: CLI Enhancement
- **Phase 4**: Interactive Console Foundation  
- **Phase 5**: Infrastructure-as-Code & Self-Contained Operations
- **Phase 6**: Version 1.0.0 Release Preparation

## Key Deliverables
- ✅ Proxmox API Client (31k lines)
- ✅ Professional CLI (20+ commands)
- ✅ Interactive Console (21 slash commands)
- ✅ Database Layer (Prisma ORM)
- ✅ IaC Generation (Terraform/Ansible)
- ✅ Testing Infrastructure (95.6% success rate)

## Epic Metrics
- **Codebase**: 122 TypeScript files
- **Test Success**: 95.6% (503/526 tests)
- **Quality**: Zero TypeScript errors
- **Documentation**: Complete

This epic represents the core production-ready foundation of Proxmox-MPC.`,
        labels: ['epic', 'phase-1-6', 'completed', 'priority-critical'],
        state: 'closed'
      },
      {
        title: "📊 EPIC: Phase 7 - Advanced Observability",
        body: `# 📊 EPIC: Phase 7 - Advanced Observability

## Epic Overview
Comprehensive observability, monitoring, and diagnostic capabilities for production infrastructure management.

## Epic Status: 🔄 IN PROGRESS
**Progress**: Core logging implemented, dashboard and monitoring in development

## Epic Scope
Advanced monitoring, logging, health checks, and diagnostic systems to ensure robust production operations.

## Key Features
### 🔄 In Progress
- **Structured Logging**: Professional logging architecture
- **Performance Metrics**: Real-time performance tracking
- **Health Checks**: Automated system health monitoring
- **System Status**: Comprehensive status reporting
- **Error Handling**: Advanced error classification and recovery

### 📋 Planned
- **Log Aggregation**: Centralized log management
- **Status Dashboard**: Visual monitoring interface
- **Issue Reporting**: Automated issue detection and reporting
- **Diagnostic Tools**: Advanced troubleshooting capabilities
- **Anonymization**: Secure data handling for AI integration

## Success Criteria
- [ ] Real-time health monitoring active
- [ ] Structured logging implemented across all components  
- [ ] Performance metrics collection and visualization
- [ ] Automated diagnostic and recovery systems
- [ ] Production-ready monitoring dashboard

This epic enables enterprise-grade observability for infrastructure operations.`,
        labels: ['epic', 'phase-7', 'in-progress', 'priority-high'],
        state: 'open'
      },
      {
        title: "🤖 EPIC: Phase 8 - MCP & AI Integration",
        body: `# 🤖 EPIC: Phase 8 - MCP & AI Integration

## Epic Overview
Full Model Context Protocol (MCP) server implementation with AI-driven infrastructure operations and natural language interfaces.

## Epic Status: 📋 PLANNED
**Dependencies**: Phase 7 observability foundation

## Epic Scope
Transform infrastructure management through AI integration, enabling natural language operations and intelligent automation.

## Key Features
### Core MCP Integration
- **MCP Protocol Server**: Full MCP server implementation
- **Resource Context**: AI-accessible infrastructure state
- **Tool Integration**: MCP tools for infrastructure operations
- **Session Management**: Persistent AI interaction sessions

### AI-Driven Operations  
- **Natural Language Interface**: Human-friendly infrastructure commands
- **Smart Suggestions**: AI-powered configuration recommendations
- **Automated Troubleshooting**: AI-driven problem diagnosis and resolution
- **Workflow Automation**: Intelligent infrastructure workflows

### Advanced AI Features
- **Context Awareness**: Deep infrastructure understanding
- **Documentation Generation**: AI-created infrastructure documentation
- **Multi-Step Execution**: Complex workflow orchestration
- **Error Recovery**: Intelligent error handling and retry logic

## Success Criteria
- [ ] Full MCP server operational with infrastructure context
- [ ] Natural language to infrastructure command translation
- [ ] AI-assisted troubleshooting and optimization
- [ ] Automated workflow generation and execution
- [ ] Claude Code headless integration

This epic represents the next-generation AI-driven infrastructure management paradigm.`,
        labels: ['epic', 'phase-8', 'planned', 'priority-high'],
        state: 'open'
      },
      {
        title: "🏢 EPIC: Phase 9 - Enterprise Features",
        body: `# 🏢 EPIC: Phase 9 - Enterprise Features  

## Epic Overview
Enterprise-grade features including CI/CD integration, RBAC, audit logging, and compliance capabilities.

## Epic Status: 📋 PLANNED
**Dependencies**: Core MCP integration from Phase 8

## Epic Scope
Production-ready enterprise features for large-scale infrastructure management with governance and compliance.

## Key Features
### Integration & Automation
- **GitHub Actions**: Automated infrastructure workflows
- **GitLab CI/CD**: Pipeline integration for infrastructure changes
- **Webhook Support**: Event-driven infrastructure operations
- **API Gateway**: Advanced API management and routing

### Security & Governance
- **RBAC Integration**: Role-based access control
- **Audit Logging**: Comprehensive audit trails
- **Secrets Management**: Enterprise secrets handling
- **Compliance Reporting**: Regulatory compliance features

## Success Criteria
- [ ] Full CI/CD pipeline integration
- [ ] Enterprise authentication and authorization
- [ ] Comprehensive audit and compliance reporting
- [ ] Advanced API management capabilities
- [ ] Production-grade security controls

This epic enables large-scale enterprise adoption with governance and compliance.`,
        labels: ['epic', 'phase-9', 'planned', 'priority-medium'],
        state: 'open'
      },
      {
        title: "🌐 EPIC: Phase 10 - Advanced Dashboard & Success Metrics",
        body: `# 🌐 EPIC: Phase 10 - Advanced Dashboard & Success Metrics

## Epic Overview
Comprehensive web dashboard, configuration management, and success metrics tracking for complete infrastructure visibility.

## Epic Status: 🔄 IN PROGRESS  
**Progress**: Core API foundation complete, dashboard development active

## Epic Scope
Full web-based management interface with visual configuration, real-time monitoring, and comprehensive success metrics.

## Key Features
### Dashboard & Interface
- ✅ **REST API**: Core web server implemented (7.4k lines)
- ✅ **WebSocket Support**: Real-time communication infrastructure
- ✅ **Authentication**: Web authentication system
- 🔄 **Interactive Dashboard**: Visual management interface
- 📋 **Configuration Editor**: Visual configuration management
- 📋 **Template Management**: Infrastructure template system

### Monitoring & Metrics
- 🔄 **Real-time Monitoring**: Live infrastructure status
- 🔄 **Success Metrics**: KPI tracking and reporting
- 🔄 **Performance Analytics**: Infrastructure performance insights
- 📋 **Drift Detection**: Configuration drift monitoring

### User Experience Metrics
- 🔄 **Time to Initialize Project**: Onboarding efficiency
- 🔄 **Import Existing Infrastructure**: Migration success rates  
- 🔄 **Generate IaC from Scratch**: Creation workflow metrics
- 🔄 **Learning Curve**: User adoption analytics
- 🔄 **Error Rate**: System reliability metrics

## Success Criteria
- [ ] Complete web dashboard operational
- [ ] Visual configuration management
- [ ] Real-time infrastructure monitoring
- [ ] Comprehensive success metrics collection
- [ ] Template-based infrastructure deployment

This epic completes the full-featured infrastructure management platform.`,
        labels: ['epic', 'phase-10', 'in-progress', 'priority-high'],
        state: 'open'
      }
    ];
  }

  async createEpics() {
    console.log('🎯 Creating GitHub Project Epics based on PLAN.md structure...');
    
    const epics = this.getEpics();
    const createdEpics = [];

    for (const epic of epics) {
      try {
        console.log(`\n📋 Creating Epic: ${epic.title}`);
        
        const { data: issue } = await this.octokit.issues.create({
          owner: this.owner,
          repo: this.repo,
          title: epic.title,
          body: epic.body,
          labels: epic.labels,
          state: epic.state as 'open' | 'closed'
        });

        // Add to project
        await this.delay(500);
        
        try {
          await this.addToProject(issue.number);
          console.log(`  ✅ Created Epic #${issue.number}: ${epic.title}`);
          createdEpics.push({
            number: issue.number,
            title: epic.title,
            phase: epic.labels.find(l => l.startsWith('phase-')) || 'general'
          });
        } catch (projectError) {
          console.log(`  ⚠️  Epic #${issue.number} created but not added to project: ${projectError.message}`);
        }

        await this.delay(1000);
      } catch (error: any) {
        console.error(`❌ Failed to create epic "${epic.title}":`, error.message);
      }
    }

    console.log(`\n📊 Epic Creation Summary:`);
    console.log(`  ✅ Created: ${createdEpics.length}/${epics.length} epics`);
    console.log(`  🔗 Project: https://github.com/users/${this.owner}/projects/4`);
    
    return createdEpics;
  }

  private async addToProject(issueNumber: number) {
    await this.execCommand(`gh project item-add 4 --owner ${this.owner} --url https://github.com/${this.owner}/${this.repo}/issues/${issueNumber}`);
  }

  private async execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      require('child_process').exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the epic creator
const organizer = new EpicOrganizer();
organizer.createEpics()
  .then((epics) => {
    console.log('\n🎉 Epic structure creation complete!');
    console.log('📋 Next: Issues will be logically grouped under these epics');
    console.log('🔗 View project: https://github.com/users/josephrichard7/projects/4');
  })
  .catch((error) => {
    console.error('❌ Epic creation failed:', error);
    process.exit(1);
  });