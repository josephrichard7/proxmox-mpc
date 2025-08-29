import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';

/**
 * MCP Server for GitHub Projects Integration
 * Provides token-efficient queries for project management
 */
export class GitHubProjectsMCP {
  private server: Server;
  private octokit: Octokit;
  private graphqlClient: typeof graphql;
  private projectId: string;
  private repoOwner: string;
  private repoName: string;

  constructor(config: {
    githubToken: string;
    projectNumber: number;
    repoOwner: string;
    repoName: string;
  }) {
    this.repoOwner = config.repoOwner;
    this.repoName = config.repoName;
    
    // Initialize GitHub clients
    this.octokit = new Octokit({ auth: config.githubToken });
    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${config.githubToken}`,
      },
    });

    // Initialize MCP server
    this.server = new Server({
      name: 'github-projects-pm',
      version: '1.0.0',
      description: 'GitHub Projects integration for efficient project management queries'
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    // Get current sprint/iteration items
    this.server.setRequestHandler('get_in_progress', async () => {
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            projectV2(number: $number) {
              items(first: 20) {
                nodes {
                  id
                  fieldValues(first: 10) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field { ... on ProjectV2SingleSelectField { name } }
                      }
                    }
                  }
                  content {
                    ... on Issue {
                      title
                      number
                      state
                      labels(first: 5) {
                        nodes { name }
                      }
                      assignees(first: 3) {
                        nodes { login }
                      }
                    }
                    ... on PullRequest {
                      title
                      number
                      state
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.graphqlClient(query, {
        owner: this.repoOwner,
        repo: this.repoName,
        number: parseInt(process.env.GITHUB_PROJECT_NUMBER || '1')
      });

      // Filter for in-progress items (token-efficient response)
      const inProgress = result.repository.projectV2.items.nodes.filter(item => {
        const status = item.fieldValues.nodes.find(field => 
          field.field?.name === 'Status' && field.name === 'In Progress'
        );
        return status !== undefined;
      });

      return {
        count: inProgress.length,
        items: inProgress.map(item => ({
          title: item.content.title,
          number: item.content.number,
          assignees: item.content.assignees?.nodes.map(a => a.login) || []
        }))
      };
    });

    // Get blockers
    this.server.setRequestHandler('get_blockers', async () => {
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            issues(first: 10, labels: ["blocked"], states: OPEN) {
              nodes {
                title
                number
                body
                createdAt
                comments(last: 1) {
                  nodes {
                    body
                    createdAt
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.graphqlClient(query, {
        owner: this.repoOwner,
        repo: this.repoName
      });

      return {
        blockers: result.repository.issues.nodes.map(issue => ({
          number: issue.number,
          title: issue.title,
          reason: issue.body?.split('\n')[0] || 'No reason specified',
          duration: this.calculateDuration(issue.createdAt)
        }))
      };
    });

    // Get release/milestone status
    this.server.setRequestHandler('get_release_status', async (params) => {
      const { milestone } = params;
      
      const query = `
        query($owner: String!, $repo: String!, $milestone: String!) {
          repository(owner: $owner, name: $repo) {
            milestone(number: $milestone) {
              title
              dueOn
              progressPercentage
              state
              issues(first: 100) {
                totalCount
                nodes {
                  state
                  labels(first: 5) {
                    nodes { name }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.graphqlClient(query, {
        owner: this.repoOwner,
        repo: this.repoName,
        milestone
      });

      const milestone = result.repository.milestone;
      const openCount = milestone.issues.nodes.filter(i => i.state === 'OPEN').length;
      const closedCount = milestone.issues.nodes.filter(i => i.state === 'CLOSED').length;

      return {
        title: milestone.title,
        dueDate: milestone.dueOn,
        progress: milestone.progressPercentage,
        stats: {
          total: milestone.issues.totalCount,
          open: openCount,
          closed: closedCount,
          completion: `${Math.round((closedCount / milestone.issues.totalCount) * 100)}%`
        }
      };
    });

    // Update task status
    this.server.setRequestHandler('update_task_status', async (params) => {
      const { issueNumber, status } = params;
      
      // First get the project item ID
      const itemQuery = `
        query($owner: String!, $repo: String!, $issue: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issue) {
              projectItems(first: 10) {
                nodes {
                  id
                  project {
                    id
                    field(name: "Status") {
                      ... on ProjectV2SingleSelectField {
                        id
                        options {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const itemResult = await this.graphqlClient(itemQuery, {
        owner: this.repoOwner,
        repo: this.repoName,
        issue: issueNumber
      });

      const projectItem = itemResult.repository.issue.projectItems.nodes[0];
      const statusField = projectItem.project.field;
      const statusOption = statusField.options.find(opt => opt.name === status);

      // Update the status
      const updateMutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $value }
          }) {
            projectV2Item {
              id
            }
          }
        }
      `;

      await this.graphqlClient(updateMutation, {
        projectId: projectItem.project.id,
        itemId: projectItem.id,
        fieldId: statusField.id,
        value: statusOption.id
      });

      return { success: true, issueNumber, newStatus: status };
    });

    // Get sprint velocity
    this.server.setRequestHandler('get_velocity', async () => {
      // Token-efficient velocity calculation
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            issues(first: 50, states: CLOSED, orderBy: {field: CLOSED_AT, direction: DESC}) {
              nodes {
                closedAt
                labels(first: 10) {
                  nodes { name }
                }
              }
            }
          }
        }
      `;

      const result = await this.graphqlClient(query, {
        owner: this.repoOwner,
        repo: this.repoName
      });

      // Calculate story points completed in last 2 weeks
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const recentIssues = result.repository.issues.nodes.filter(issue => 
        new Date(issue.closedAt) > twoWeeksAgo
      );

      const points = recentIssues.reduce((sum, issue) => {
        const pointLabel = issue.labels.nodes.find(l => l.name.includes('points'));
        if (pointLabel) {
          const points = parseInt(pointLabel.name.replace(/\D/g, ''));
          return sum + (isNaN(points) ? 0 : points);
        }
        return sum;
      }, 0);

      return {
        velocity: points / 2, // Per week
        issuesCompleted: recentIssues.length,
        period: '2 weeks'
      };
    });

    // Search functionality
    this.server.setRequestHandler('search_tasks', async (params) => {
      const { query: searchQuery } = params;
      
      const query = `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: ISSUE, first: 10) {
            nodes {
              ... on Issue {
                title
                number
                state
                url
              }
            }
          }
        }
      `;

      const result = await this.graphqlClient(query, {
        searchQuery: `repo:${this.repoOwner}/${this.repoName} ${searchQuery}`
      });

      return {
        results: result.search.nodes
      };
    });
  }

  private calculateDuration(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }

  async start() {
    await this.server.start();
    console.log('GitHub Projects MCP Server started');
  }
}

// Configuration
const config = {
  githubToken: process.env.GITHUB_TOKEN || '',
  projectNumber: parseInt(process.env.GITHUB_PROJECT_NUMBER || '1'),
  repoOwner: 'your-username',
  repoName: 'proxmox-mpc'
};

// Start server
const mcp = new GitHubProjectsMCP(config);
mcp.start();