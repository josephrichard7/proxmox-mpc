# Documentation Standards

This document establishes consistent formatting, structure, and content standards for all markdown documentation in the Proxmox-MPC project.

## Formatting Standards

### Headers
- Use ATX-style headers (`#` prefix) consistently
- Follow hierarchy: `#` → `##` → `###` → `####` (max 4 levels)
- Include single space after `#` markers
- Use title case for main headers, sentence case for subsections

### Lists
- Use `-` for unordered lists (consistent bullet character)
- Use `1.` format for ordered lists
- Indent nested lists with 2 spaces
- Use checkbox format `- [ ]` for task lists

### Code Blocks
- Use fenced code blocks with language specification
- Prefer `bash` for shell commands, `typescript` for code
- Use `yaml` for configuration examples
- Include `# Comment` for command explanations

### Emphasis
- Use `**bold**` for important terms and status indicators
- Use `*italic*` for file names and technical terms
- Use `code` for command names, file paths, and inline code

## Content Standards

### Project Status
- Always use current Phase 5.9 status (100% cleanup completion)
- Update progress percentages based on actual completion
- Use consistent status indicators: ✅ COMPLETED, 🚧 IN PROGRESS, ⏳ FUTURE

### Cross-References
- Use relative links for internal documentation
- Include descriptive link text, not bare URLs
- Verify all internal links are valid

### Technical Accuracy
- All version numbers must reflect current state
- Test success rates should be current (163/175 tests = 93%)
- Feature descriptions must match actual implementation

## File-Specific Standards

### README.md
- Must be professional and welcoming to new users
- Include clear installation and setup instructions
- Showcase key features with practical examples
- Maintain current project status and achievements

### PLAN.md
- Track actual completion status with checkboxes
- Use detailed phase breakdowns with time estimates
- Include success metrics and quality standards
- Maintain chronological development history

### CLAUDE.md
- Focus on current implementation status
- Provide accurate architectural overview
- Include practical examples for Claude Code
- Update with each significant milestone

### Phase Documentation
- Use consistent template structure
- Include implementation details and code examples
- Maintain completion status and lessons learned
- Archive completed phases appropriately

## Quality Checklist

Before committing documentation updates, verify:

- [ ] Consistent markdown formatting throughout
- [ ] Accurate project status and progress percentages
- [ ] Working internal and external links
- [ ] Current version numbers and statistics
- [ ] Professional tone and clear language
- [ ] Proper file structure and organization
- [ ] No outdated or misleading information

## Archive Policy

### Completed Files
- Move completed phase implementations to `archive/` directory
- Maintain reference links from active documentation
- Include completion date and final status

### Legacy Content
- Archive outdated planning documents
- Remove duplicate or conflicting information
- Preserve historical context in archive README

## Style Guide

### Tone
- Professional yet approachable
- Clear and direct language
- Avoid marketing speak or hyperbole
- Focus on concrete achievements and capabilities

### Structure
- Lead with most important information
- Use consistent section ordering across similar files
- Include table of contents for longer documents
- Group related information logically

### Visual Elements
- Use consistent emoji for status indicators
- Include code examples for complex concepts
- Add diagrams or flowcharts where helpful
- Maintain visual hierarchy with proper headers