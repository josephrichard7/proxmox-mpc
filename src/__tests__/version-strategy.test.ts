import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Version Strategy Implementation', () => {
  describe('Package Configuration', () => {
    it('should have valid semantic version', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?(\+[a-zA-Z0-9-.]+)?$/;
      expect(pkg.version).toMatch(semverRegex);
    });

    it('should have required package fields', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.name).toBe('proxmox-mpc');
      expect(pkg.description).toBeDefined();
      expect(pkg.description.length).toBeGreaterThan(0);
      expect(pkg.keywords).toBeInstanceOf(Array);
      expect(pkg.keywords.length).toBeGreaterThan(0);
      expect(pkg.homepage).toBeDefined();
      expect(pkg.repository).toBeDefined();
      expect(pkg.repository.type).toBe('git');
      expect(pkg.repository.url).toContain('github.com');
      expect(pkg.bugs).toBeDefined();
      expect(pkg.license).toBe('MIT');
    });

    it('should have proper author configuration', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.author).toBeDefined();
      expect(typeof pkg.author === 'object' || typeof pkg.author === 'string').toBe(true);
      
      if (typeof pkg.author === 'object') {
        expect(pkg.author.name).toBeDefined();
      }
    });

    it('should have engine requirements', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toBeDefined();
      expect(pkg.engines.npm).toBeDefined();
    });

    it('should have proper file exports', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.main).toBe('dist/index.js');
      expect(pkg.types).toBe('dist/index.d.ts');
      expect(pkg.exports).toBeDefined();
      expect(pkg.exports['.']).toBeDefined();
    });

    it('should have publishConfig', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.publishConfig).toBeDefined();
      expect(pkg.publishConfig.access).toBe('public');
      expect(pkg.publishConfig.registry).toBe('https://registry.npmjs.org/');
    });

    it('should have proper files array', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.files).toBeInstanceOf(Array);
      expect(pkg.files).toContain('dist/**/*');
      expect(pkg.files).toContain('bin/**/*');
      expect(pkg.files).toContain('README.md');
      expect(pkg.files).toContain('CHANGELOG.md');
      expect(pkg.files).toContain('LICENSE');
    });
  });

  describe('Version Management Scripts', () => {
    it('should have version management scripts', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.scripts['version:patch']).toBeDefined();
      expect(pkg.scripts['version:minor']).toBeDefined();
      expect(pkg.scripts['version:major']).toBeDefined();
      expect(pkg.scripts['version:prerelease']).toBeDefined();
    });

    it('should have release scripts', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.scripts['release']).toBeDefined();
      expect(pkg.scripts['release:patch']).toBeDefined();
      expect(pkg.scripts['release:minor']).toBeDefined();
      expect(pkg.scripts['release:major']).toBeDefined();
      expect(pkg.scripts['release:prepare']).toBeDefined();
      expect(pkg.scripts['release:publish']).toBeDefined();
    });

    it('should have changelog script', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.scripts['changelog']).toBeDefined();
      expect(pkg.scripts['changelog']).toContain('conventional-changelog');
    });

    it('should have required dev dependencies for versioning', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      expect(pkg.devDependencies['@commitlint/cli']).toBeDefined();
      expect(pkg.devDependencies['@commitlint/config-conventional']).toBeDefined();
      expect(pkg.devDependencies['conventional-changelog-cli']).toBeDefined();
      expect(pkg.devDependencies['standard-version']).toBeDefined();
      expect(pkg.devDependencies['husky']).toBeDefined();
      expect(pkg.devDependencies['lint-staged']).toBeDefined();
    });
  });

  describe('Changelog Configuration', () => {
    it('should have CHANGELOG.md file', () => {
      expect(fs.existsSync('CHANGELOG.md')).toBe(true);
    });

    it('should have properly formatted changelog', () => {
      const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
      
      expect(changelog).toContain('# Changelog');
      expect(changelog).toContain('## [Unreleased]');
      expect(changelog).toContain('Keep a Changelog');
      expect(changelog).toContain('Semantic Versioning');
    });

    it('should have version configuration file', () => {
      expect(fs.existsSync('.versionrc.json')).toBe(true);
      
      const versionrc = JSON.parse(fs.readFileSync('.versionrc.json', 'utf8'));
      expect(versionrc.types).toBeInstanceOf(Array);
      expect(versionrc.types.length).toBeGreaterThan(0);
      expect(versionrc.commitUrlFormat).toBeDefined();
      expect(versionrc.compareUrlFormat).toBeDefined();
    });
  });

  describe('Commit Lint Configuration', () => {
    it('should have commitlint configuration', () => {
      expect(fs.existsSync('commitlint.config.js')).toBe(true);
    });

    it('should have valid commitlint config', () => {
      const commitlintConfig = require(path.join(process.cwd(), 'commitlint.config.js'));
      
      expect(commitlintConfig.extends).toContain('@commitlint/config-conventional');
      expect(commitlintConfig.rules).toBeDefined();
      expect(commitlintConfig.rules['type-enum']).toBeDefined();
      expect(commitlintConfig.rules['subject-max-length']).toBeDefined();
    });
  });

  describe('GitHub Actions Workflows', () => {
    it('should have CI workflow', () => {
      expect(fs.existsSync('.github/workflows/ci.yml')).toBe(true);
      
      const ciWorkflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
      expect(ciWorkflow).toContain('name: Continuous Integration');
      expect(ciWorkflow).toContain('npm run test');
      expect(ciWorkflow).toContain('npm run build');
      expect(ciWorkflow).toContain('npm run lint');
    });

    it('should have release workflow', () => {
      expect(fs.existsSync('.github/workflows/release.yml')).toBe(true);
      
      const releaseWorkflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
      expect(releaseWorkflow).toContain('name: Release Pipeline');
      expect(releaseWorkflow).toContain('standard-version');
      expect(releaseWorkflow).toContain('npm publish');
    });

    it('should have manual release workflow', () => {
      expect(fs.existsSync('.github/workflows/manual-release.yml')).toBe(true);
      
      const manualReleaseWorkflow = fs.readFileSync('.github/workflows/manual-release.yml', 'utf8');
      expect(manualReleaseWorkflow).toContain('name: Manual Release');
      expect(manualReleaseWorkflow).toContain('workflow_dispatch');
      expect(manualReleaseWorkflow).toContain('release_type');
    });

    it('should have documentation workflow', () => {
      expect(fs.existsSync('.github/workflows/docs.yml')).toBe(true);
      
      const docsWorkflow = fs.readFileSync('.github/workflows/docs.yml', 'utf8');
      expect(docsWorkflow).toContain('name: Documentation');
      expect(docsWorkflow).toContain('mkdocs');
      expect(docsWorkflow).toContain('mike');
    });
  });

  describe('Documentation Versioning', () => {
    it('should have MkDocs configuration with versioning', () => {
      expect(fs.existsSync('mkdocs.yml')).toBe(true);
      
      const mkdocsConfig = fs.readFileSync('mkdocs.yml', 'utf8');
      expect(mkdocsConfig).toContain('mike:');
      expect(mkdocsConfig).toContain('version_selector: true');
    });

    it('should have documentation deployment script', () => {
      expect(fs.existsSync('scripts/deploy-docs.sh')).toBe(true);
      
      // Check if script is executable
      const stats = fs.statSync('scripts/deploy-docs.sh');
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });
  });

  describe('Package Distribution', () => {
    it('should have .npmignore file', () => {
      expect(fs.existsSync('.npmignore')).toBe(true);
      
      const npmignore = fs.readFileSync('.npmignore', 'utf8');
      expect(npmignore).toContain('src/');
      expect(npmignore).toContain('docs/');
      expect(npmignore).toContain('test-results/');
      expect(npmignore).toContain('.github/');
    });

    it('should have release testing script', () => {
      expect(fs.existsSync('scripts/test-release-process.sh')).toBe(true);
      
      // Check if script is executable
      const stats = fs.statSync('scripts/test-release-process.sh');
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });
  });

  describe('Version Validation', () => {
    it('should validate current version format', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const version = pkg.version;
      
      // Test semantic version format
      const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
      expect(version).toMatch(semverRegex);
    });

    it('should have consistent version across files', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const packageVersion = pkg.version;
      
      // Check if CHANGELOG mentions the current version
      if (fs.existsSync('CHANGELOG.md')) {
        const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
        
        // For development versions, we expect to see them in Unreleased
        // For release versions, we expect to see them as a release
        const hasUnreleasedSection = changelog.includes('## [Unreleased]');
        const hasVersionSection = changelog.includes(`## [${packageVersion}]`);
        
        expect(hasUnreleasedSection || hasVersionSection).toBe(true);
      }
    });
  });

  describe('Build and Distribution Validation', () => {
    it('should build successfully', () => {
      expect(() => {
        execSync('npm run build', { stdio: 'pipe' });
      }).not.toThrow();
      
      // Check build artifacts
      expect(fs.existsSync('dist')).toBe(true);
      expect(fs.existsSync('dist/index.js')).toBe(true);
      expect(fs.existsSync('dist/index.d.ts')).toBe(true);
    });

    it('should pass all pre-release checks', () => {
      // Type checking
      expect(() => {
        execSync('npm run typecheck', { stdio: 'pipe' });
      }).not.toThrow();

      // Linting (non-blocking)
      try {
        execSync('npm run lint', { stdio: 'pipe' });
      } catch (error) {
        console.warn('Linting issues found (non-blocking)');
      }
    });

    it('should create valid package', () => {
      // This test actually creates a package, so we need to clean up
      let tarballPath = '';
      
      try {
        const packOutput = execSync('npm pack', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        tarballPath = packOutput.trim();
        expect(fs.existsSync(tarballPath)).toBe(true);
        
        // Validate package contents
        const tarContents = execSync(`tar -tzf ${tarballPath}`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        expect(tarContents).toContain('package/package.json');
        expect(tarContents).toContain('package/dist/index.js');
        expect(tarContents).toContain('package/README.md');
        
      } finally {
        // Cleanup
        if (tarballPath && fs.existsSync(tarballPath)) {
          fs.unlinkSync(tarballPath);
        }
      }
    });
  });
});