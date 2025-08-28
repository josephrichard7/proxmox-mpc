# Documentation Standards and Style Guide

## Overview

This document defines the standards, conventions, and best practices for all documentation in the Proxmox-MPC project.

## Documentation Architecture

### Content Organization

```
docs/
├── templates/          # Documentation templates
├── getting-started/    # User onboarding content
├── user-guide/        # End-user documentation
├── reference/         # API and CLI reference
├── tutorials/         # Step-by-step guides
├── troubleshooting/   # Problem-solving guides
├── features/          # Feature-specific documentation
├── overview/          # High-level project information
├── development/       # Developer-focused content
├── adr/               # Architecture Decision Records
└── release/           # Release management documentation
```

### Content Types and Purposes

| Type                | Purpose             | Target Audience        | Update Frequency      |
| ------------------- | ------------------- | ---------------------- | --------------------- |
| **Getting Started** | User onboarding     | New users              | Minor updates         |
| **User Guide**      | Feature usage       | End users              | Regular updates       |
| **Reference**       | API/CLI specs       | Developers/Users       | With code changes     |
| **Tutorials**       | Learning paths      | New/intermediate users | Quarterly review      |
| **Troubleshooting** | Problem solving     | Support/Users          | As issues arise       |
| **Features**        | Feature docs        | All users              | With feature releases |
| **ADRs**            | Technical decisions | Developers/Architects  | As decisions made     |

## Writing Standards

### Language and Tone

- **Clear and Concise**: Use simple, direct language
- **Professional**: Maintain professional tone while being approachable
- **Inclusive**: Use inclusive language and avoid jargon
- **Active Voice**: Prefer active voice over passive voice
- **Present Tense**: Use present tense for instructions

### Structure and Format

#### Headers

- Use descriptive, hierarchical headers
- Start with H1 for document title
- Use H2 for major sections
- Limit nesting to 4 levels (H1-H4)

#### Code Examples

- Always test code examples before publishing
- Include complete, runnable examples when possible
- Use syntax highlighting with language specification
- Provide context for code snippets

```typescript
// Good: Complete example with context
import { ProxmoxClient } from "./src/api";

const client = new ProxmoxClient({
  host: "your-proxmox-host.local",
  token: "your-api-token",
});

const nodes = await client.getNodes();
console.log(nodes);
```

#### Lists and Tables

- Use bullet points for unordered information
- Use numbered lists for sequential steps
- Include table headers for all tables
- Align table content consistently

### Content Guidelines

#### User-Focused Writing

- Start with user goals and outcomes
- Explain the "why" before the "how"
- Provide context for technical decisions
- Include troubleshooting for common issues

#### Technical Accuracy

- Verify all commands and code examples
- Keep version-specific information current
- Link to authoritative sources
- Update deprecated information promptly

## Content Standards

### Code Documentation

````typescript
/**
 * Creates a new VM in the specified Proxmox node
 * @param nodeId - The Proxmox node identifier
 * @param config - VM configuration options
 * @returns Promise resolving to the created VM details
 * @throws ProxmoxError when VM creation fails
 * @example
 * ```typescript
 * const vm = await createVM('node1', {
 *   name: 'test-vm',
 *   memory: 2048,
 *   cores: 2
 * });
 * ```
 */
async function createVM(nodeId: string, config: VMConfig): Promise<VM> {
  // Implementation
}
````

### API Documentation

- Include all parameters with types
- Document return values and error conditions
- Provide realistic examples
- Explain authentication requirements

### CLI Documentation

````markdown
## Command: `proxmox-mpc create vm`

**Usage**: `proxmox-mpc create vm [options]`

**Description**: Creates a new virtual machine with specified configuration

**Options**:

- `--name <name>` (required): VM name
- `--node <node>` (optional): Target node (default: first available)
- `--memory <mb>` (optional): RAM in MB (default: 1024)
- `--cores <count>` (optional): CPU cores (default: 1)

**Examples**:

```bash
# Create basic VM
proxmox-mpc create vm --name web-server

# Create VM with specific resources
proxmox-mpc create vm --name database --memory 4096 --cores 4
```
````

````

## Quality Assurance

### Review Process
1. **Author Review**: Author reviews own content for completeness
2. **Technical Review**: Technical expert reviews for accuracy
3. **Editorial Review**: Editor reviews for style and clarity
4. **User Testing**: Test procedures with target audience when possible

### Quality Checklist
- [ ] Content serves clear user need
- [ ] Information is accurate and current
- [ ] Examples are tested and functional
- [ ] Links work and point to correct resources
- [ ] Spelling and grammar are correct
- [ ] Formatting follows style guide
- [ ] Content is accessible and inclusive

### Maintenance Process
- **Quarterly Reviews**: Review all documentation quarterly
- **Release Updates**: Update docs with each software release
- **Issue Tracking**: Track documentation issues in GitHub
- **User Feedback**: Collect and act on user feedback

## Tools and Workflows

### Documentation Tools
- **Source Format**: Markdown with MkDocs
- **Hosting**: MkDocs static site generation
- **Version Control**: Git with documentation in `/docs`
- **Generated Content**: Auto-generated in `/site` (not version controlled)

### Build Process
```bash
# Install dependencies
pip install mkdocs mkdocs-material

# Local development
mkdocs serve

# Build production site
mkdocs build
````

### Content Workflow

1. **Create**: Use appropriate template from `/docs/templates`
2. **Write**: Follow style guide and standards
3. **Review**: Submit for technical and editorial review
4. **Test**: Verify examples and procedures work
5. **Publish**: Merge to main branch and deploy

## Templates Usage

### When to Use Each Template

- **Feature Template**: For new feature documentation
- **API Reference Template**: For API endpoint documentation
- **Tutorial Template**: For step-by-step learning content
- **Troubleshooting Template**: For problem-solving guides
- **ADR Template**: For architectural decisions
- **Release Notes Template**: For version release information

### Template Customization

- Templates are starting points, customize as needed
- Maintain consistent structure across similar documents
- Include all relevant sections, remove unused sections
- Update metadata fields for proper tracking

## Metrics and Analytics

### Documentation Metrics

- **Coverage**: Percentage of features with documentation
- **Freshness**: Average age of documentation updates
- **Usage**: Most/least accessed content
- **Feedback**: User satisfaction scores

### Performance Targets

- **Update Frequency**: All docs updated within 30 days of feature release
- **Review Cycle**: Complete review every quarter
- **Response Time**: Documentation issues addressed within 1 week
- **User Satisfaction**: Maintain >4.0/5.0 rating for documentation quality

## Governance

### Roles and Responsibilities

- **Documentation Owner**: Overall documentation strategy and quality
- **Technical Writers**: Content creation and maintenance
- **Subject Matter Experts**: Technical accuracy and review
- **Community Contributors**: User feedback and improvements

### Content Ownership

| Content Area    | Primary Owner     | Technical Reviewer | Update Schedule |
| --------------- | ----------------- | ------------------ | --------------- |
| Getting Started | Technical Writer  | Product Owner      | Quarterly       |
| API Reference   | Development Team  | Tech Lead          | With releases   |
| User Guide      | Technical Writer  | Product Owner      | Monthly         |
| Troubleshooting | Support Team      | Development Team   | As needed       |
| ADRs            | Architecture Team | Tech Lead          | With decisions  |

### Change Management

- **Minor Updates**: Direct commit by content owner
- **Major Changes**: Pull request with review
- **Structural Changes**: Discussion and approval required
- **Deprecation**: Follow deprecation policy and timeline

---

**Document Metadata**

- **Created**: 2025-08-28
- **Last Updated**: 2025-08-28
- **Author**: Documentation Manager
- **Version**: 1.0.0
- **Next Review**: 2025-11-28
