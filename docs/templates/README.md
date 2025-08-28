# Documentation Templates

This directory contains templates for creating consistent, high-quality documentation across the Proxmox-MPC project.

## Available Templates

### Content Templates

#### 📋 [Feature Template](./feature-template.md)

**Use for**: New feature documentation, feature specifications, feature design documents
**Target audience**: Developers, product managers, end users
**When to use**: When documenting a new feature from conception through implementation

#### 📚 [API Reference Template](./api-reference-template.md)

**Use for**: API documentation, method references, interface documentation
**Target audience**: Developers, integration partners
**When to use**: Documenting APIs, methods, interfaces, or any programmatic interface

#### 🎓 [Tutorial Template](./tutorial-template.md)

**Use for**: Step-by-step learning content, how-to guides, walkthrough documentation
**Target audience**: New users, developers learning specific workflows
**When to use**: Creating educational content that guides users through a complete process

#### 🔧 [Troubleshooting Template](./troubleshooting-template.md)

**Use for**: Problem-solving guides, diagnostic procedures, error resolution
**Target audience**: End users, support staff, system administrators
**When to use**: Documenting common issues, diagnostic procedures, and solutions

#### 🏗️ [ADR Template](./adr-template.md)

**Use for**: Architecture Decision Records, technical decision documentation
**Target audience**: Developers, architects, technical stakeholders
**When to use**: Recording significant technical decisions and their rationale

#### 📦 [Release Notes Template](./release-notes-template.md)

**Use for**: Version release documentation, change logs, upgrade guides
**Target audience**: All users, system administrators, developers
**When to use**: Documenting software releases, updates, and changes

## How to Use Templates

### 1. Choose the Right Template

Select the template that best matches your content type and audience:

| Content Type          | Primary Template         | Secondary Options            |
| --------------------- | ------------------------ | ---------------------------- |
| New Feature           | Feature Template         | API Reference (for APIs)     |
| Bug Fix Guide         | Troubleshooting Template | Tutorial (for complex fixes) |
| How-to Guide          | Tutorial Template        | -                            |
| Technical Decision    | ADR Template             | -                            |
| Code Documentation    | API Reference Template   | -                            |
| Release Documentation | Release Notes Template   | -                            |

### 2. Copy and Customize

```bash
# Copy template to your content location
cp docs/templates/feature-template.md docs/features/my-new-feature.md

# Edit the template
# - Replace placeholder text
# - Remove unused sections
# - Customize for your specific content
```

### 3. Follow the Standards

- Review [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) for style guidelines
- Use consistent formatting and structure
- Test all code examples and procedures
- Include complete metadata at the bottom of documents

### 4. Submit for Review

Follow the standard review process:

1. Self-review for completeness and accuracy
2. Technical review by subject matter expert
3. Editorial review for style and clarity
4. User testing if applicable

## Template Customization Guidelines

### Required Sections

Each template includes required sections that should be included in all documents of that type. These are marked with clear headings and provide essential structure.

### Optional Sections

Optional sections are clearly marked and can be removed if not applicable to your content.

### Placeholder Guidelines

- `[Text in brackets]`: Replace with actual content
- `[Optional: text]`: Include only if relevant
- `[Choose one: option1 | option2]`: Select appropriate option

### Metadata Requirements

All documents must include metadata at the bottom:

```markdown
---

**Document Metadata**

- **Created**: [YYYY-MM-DD]
- **Last Updated**: [YYYY-MM-DD]
- **Author**: [Name]
- **Reviewers**: [Names]
- **Status**: [Draft/Review/Approved/Published]
```

## Quality Checklist

Before publishing any documentation:

### Content Quality

- [ ] All placeholder text has been replaced
- [ ] Content addresses the target audience's needs
- [ ] Information is accurate and up-to-date
- [ ] Examples are complete and tested
- [ ] Links work and point to correct resources

### Structure and Format

- [ ] Document follows template structure
- [ ] Headers are descriptive and hierarchical
- [ ] Code blocks include language specification
- [ ] Tables include headers and proper formatting
- [ ] Lists are properly structured

### Style and Clarity

- [ ] Language is clear and concise
- [ ] Tone is professional and approachable
- [ ] Active voice is used consistently
- [ ] Jargon is explained or avoided
- [ ] Content flows logically

### Technical Requirements

- [ ] All commands and code examples work
- [ ] Version-specific information is current
- [ ] Error scenarios are documented
- [ ] Prerequisites are clearly stated

## Template Maintenance

### Update Process

Templates are reviewed and updated quarterly to ensure they remain effective and current.

### Feedback and Improvements

If you have suggestions for template improvements:

1. Create a GitHub issue with the `documentation` label
2. Describe the specific improvement or problem
3. Provide examples if possible
4. Suggest specific changes

### Version History

Track major changes to templates in their individual files and update the main documentation standards when templates are significantly modified.

## Examples and References

### Good Documentation Examples

Review these examples of well-executed documentation:

- [Getting Started Guide](../getting-started/quick-start.md)
- [CLI Reference](../reference/cli-reference.md)
- [Architecture Overview](../overview/architecture.md)

### External References

- [Write the Docs Documentation Guide](https://www.writethedocs.org/guide/)
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [Microsoft Writing Style Guide](https://docs.microsoft.com/en-us/style-guide/welcome/)

---

**Template Directory Metadata**

- **Created**: 2025-08-28
- **Last Updated**: 2025-08-28
- **Maintainer**: Documentation Manager
- **Review Schedule**: Quarterly
