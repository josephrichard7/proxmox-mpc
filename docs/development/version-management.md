# Version Management System

Professional version management system for Proxmox-MPC that ensures consistent version display across all interfaces and provides comprehensive build information tracking.

## Overview

The version management system addresses the challenge of maintaining consistent version information across multiple interfaces (CLI, console, web UI, MCP server) while providing build traceability and environment awareness.

## Architecture

### Core Components

```typescript
// src/utils/version.ts
interface VersionInfo {
  version: string;           // Semantic version from package.json
  buildDate: string;         // ISO 8601 build timestamp
  gitCommit?: string;        // Git commit hash (when available)
  gitBranch?: string;        // Git branch name (when available)
  environment: 'development' | 'production';
  buildNumber?: number;      // CI/CD build number (when available)
}

class VersionManager {
  private static instance: VersionManager;
  private versionInfo: VersionInfo;
  private packageRoot: string;
  
  public static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }
  
  public getVersion(): string {
    return this.versionInfo.version;
  }
  
  public getFullVersionInfo(): VersionInfo {
    return { ...this.versionInfo };
  }
}
```

### Key Features

1. **Dynamic Version Loading**: Version information is loaded from package.json at runtime
2. **Singleton Pattern**: Single source of truth for version information across the application
3. **Build Traceability**: Includes git commit, branch, and build information when available
4. **Environment Awareness**: Distinguishes between development and production builds
5. **Consistent Display**: All interfaces show identical version information

## Implementation Details

### Version Loading Process

1. **Package Discovery**: Locate package.json using `findPackageRoot()` utility
2. **Version Extraction**: Parse semantic version from package.json
3. **Build Information**: Collect git and build metadata when available
4. **Caching**: Cache version information for performance
5. **Error Handling**: Graceful fallback for missing information

```typescript
private async loadVersionInfo(): Promise<VersionInfo> {
  try {
    const packagePath = findPackageRoot(__dirname);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(packagePath, 'package.json'), 'utf-8')
    );
    
    return {
      version: packageJson.version,
      buildDate: new Date().toISOString(),
      gitCommit: await this.getGitCommit(),
      gitBranch: await this.getGitBranch(),
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      buildNumber: process.env.BUILD_NUMBER ? parseInt(process.env.BUILD_NUMBER) : undefined
    };
  } catch (error) {
    // Fallback version information
    return {
      version: '0.0.0-unknown',
      buildDate: new Date().toISOString(),
      environment: 'development'
    };
  }
}
```

### Git Information Extraction

```typescript
private async getGitCommit(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('git rev-parse --short HEAD');
    return stdout.trim();
  } catch {
    return undefined;
  }
}

private async getGitBranch(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
    return stdout.trim();
  } catch {
    return undefined;
  }
}
```

## Interface Integration

### CLI Integration

```typescript
// src/cli/index.ts
import { VersionManager } from '../utils/version';

const program = new Command();
program
  .name('proxmox-mpc')
  .description('Interactive Infrastructure-as-Code Console for Proxmox VE')
  .version(VersionManager.getInstance().getVersion());

// Verbose version command
program
  .command('version')
  .option('-v, --verbose', 'Show detailed version information')
  .action((options) => {
    const versionManager = VersionManager.getInstance();
    
    if (options.verbose) {
      const info = versionManager.getFullVersionInfo();
      console.log(`🚀 Proxmox-MPC CLI v${info.version}`);
      console.log(`📦 Build: ${info.buildDate}`);
      if (info.gitCommit) console.log(`🔧 Commit: ${info.gitCommit}`);
      if (info.gitBranch) console.log(`🌿 Branch: ${info.gitBranch}`);
      console.log(`🏗️ Environment: ${info.environment}`);
    } else {
      console.log(versionManager.getVersion());
    }
  });
```

### Interactive Console Integration

```typescript
// src/console/repl.ts
import { VersionManager } from '../utils/version';

export class InteractiveConsole {
  private startMessage(): void {
    const version = VersionManager.getInstance().getVersion();
    console.log(chalk.blue(`Proxmox-MPC Interactive Console v${version}`));
    console.log('Type /help for available commands or /exit to quit.\n');
  }
  
  // Version command in console
  private registerVersionCommand(): void {
    this.commandRegistry.register({
      name: '/version',
      description: 'Display version information',
      execute: async (args: string[]) => {
        const versionManager = VersionManager.getInstance();
        const info = versionManager.getFullVersionInfo();
        
        console.log(`📦 Version: ${info.version}`);
        console.log(`🕐 Built: ${new Date(info.buildDate).toLocaleString()}`);
        if (info.gitCommit) console.log(`🔧 Commit: ${info.gitCommit}`);
        console.log(`🏗️ Environment: ${info.environment}`);
      }
    });
  }
}
```

### Web UI Integration (Planned)

```typescript
// Future: src/web/api/version.ts
import { VersionManager } from '../../utils/version';

export const versionHandler = (req: Request, res: Response) => {
  const versionInfo = VersionManager.getInstance().getFullVersionInfo();
  res.json({
    version: versionInfo.version,
    buildInfo: {
      date: versionInfo.buildDate,
      commit: versionInfo.gitCommit,
      branch: versionInfo.gitBranch,
      environment: versionInfo.environment
    }
  });
};
```

## Build Integration

### Package.json Version Management

```json
{
  "scripts": {
    "version:patch": "npm version patch --no-git-tag-version",
    "version:minor": "npm version minor --no-git-tag-version",
    "version:major": "npm version major --no-git-tag-version",
    "version:prerelease": "npm version prerelease --preid=alpha --no-git-tag-version",
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major"
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/build.yml
name: Build and Release
on:
  push:
    branches: [main]
    
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Needed for git history
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build with version info
        env:
          BUILD_NUMBER: ${{ github.run_number }}
          GIT_COMMIT: ${{ github.sha }}
          GIT_BRANCH: ${{ github.ref_name }}
        run: |
          echo "Building with commit: $GIT_COMMIT"
          echo "Building with branch: $GIT_BRANCH"
          npm run build
          
      - name: Test version consistency
        run: |
          npm run test -- --testNamePattern="version"
          npm run cli version --verbose
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY bin/ ./bin/

# Build arguments for version info
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG BUILD_NUMBER

ENV BUILD_DATE=${BUILD_DATE}
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV NODE_ENV=production

LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

CMD ["node", "dist/console.js"]
```

## Testing

### Unit Tests

```typescript
// src/utils/__tests__/version.test.ts
import { VersionManager } from '../version';

describe('VersionManager', () => {
  let versionManager: VersionManager;
  
  beforeEach(() => {
    versionManager = VersionManager.getInstance();
  });
  
  test('should return valid semantic version', () => {
    const version = versionManager.getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
  
  test('should return complete version info', () => {
    const info = versionManager.getFullVersionInfo();
    expect(info).toHaveProperty('version');
    expect(info).toHaveProperty('buildDate');
    expect(info).toHaveProperty('environment');
    expect(info.environment).toBeOneOf(['development', 'production']);
  });
  
  test('should be singleton', () => {
    const instance1 = VersionManager.getInstance();
    const instance2 = VersionManager.getInstance();
    expect(instance1).toBe(instance2);
  });
});
```

### Integration Tests

```typescript
// Integration test for version consistency
describe('Version Consistency', () => {
  test('CLI and console show same version', async () => {
    const cliVersion = await getCLIVersion();
    const consoleVersion = await getConsoleVersion();
    expect(cliVersion).toBe(consoleVersion);
  });
  
  test('version matches package.json', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf-8')
    );
    const runtimeVersion = VersionManager.getInstance().getVersion();
    expect(runtimeVersion).toBe(packageJson.version);
  });
});
```

## Best Practices

### Development Workflow

1. **Version Updates**: Use npm version commands for semantic versioning
2. **Testing**: Always test version display after updates
3. **Documentation**: Update documentation when version format changes
4. **Git Tags**: Use standard-version for automated changelogs and tags

### Production Deployment

1. **Build Information**: Always include build metadata in production builds
2. **Version Verification**: Verify version consistency before deployment
3. **Monitoring**: Monitor version information in production logs
4. **Rollback Support**: Maintain version history for rollback scenarios

### Error Handling

1. **Graceful Fallbacks**: Provide fallback version info when package.json is unavailable
2. **Logging**: Log version loading errors for debugging
3. **Validation**: Validate version format before using
4. **Recovery**: Recover gracefully from git command failures

## Troubleshooting

### Common Issues

**Issue: Version shows as "0.0.0-unknown"**
- **Cause**: package.json not found or unreadable
- **Solution**: Verify package.json exists and is readable, check file permissions

**Issue: Git information missing**
- **Cause**: Not in git repository or git commands fail
- **Solution**: Ensure running in git repository, verify git is installed and accessible

**Issue: Inconsistent versions across interfaces**
- **Cause**: Multiple version sources or caching issues
- **Solution**: Verify all interfaces use VersionManager singleton, clear any caches

### Debug Commands

```bash
# Debug version loading
DEBUG=proxmox-mpc:version npm run console

# Test version consistency
npm run test:version

# Manual version verification
node -e "console.log(require('./package.json').version)"
npm run cli version --verbose
```

## Future Enhancements

1. **Version Analytics**: Track version usage and adoption
2. **Update Notifications**: Notify users of available updates
3. **Migration Support**: Handle version-specific migrations
4. **Feature Flags**: Version-based feature enablement
5. **Telemetry**: Optional version and usage telemetry

---

**See Also:**
- [Architecture Overview](../overview/architecture.md) - System architecture
- [Development Guide](contributing.md) - Contributing to the project
- [Testing Guide](testing.md) - Testing practices
- [Deployment Guide](deployment.md) - Production deployment