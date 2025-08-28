#!/bin/bash

# Release Testing Environment Setup
# Implements production-like testing conditions for Phase 6: QA-002
# Version: 1.0.0
# Usage: ./setup-test-environment.sh [--environment=<env>] [--reset] [--verbose]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/test-environment-setup-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
RESET_ENVIRONMENT=false
VERBOSE=false

# Test environment configurations
STAGING_NODE_VERSION="18.19.0"
PRODUCTION_NODE_VERSION="18.19.0"
TEST_DATABASE_PATH="${PROJECT_ROOT}/test-environments"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/test-environments/docker-compose.test.yml"

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging functions
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S')" "$@" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $*"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    log "${RED}[ERROR]${NC} $*"
}

log_section() {
    log "${PURPLE}[SECTION]${NC} $*"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --reset)
                RESET_ENVIRONMENT=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Release Testing Environment Setup

Usage: $0 [OPTIONS]

OPTIONS:
    --environment=ENV    Target environment (staging, production) [default: staging]
    --reset             Reset existing test environment
    --verbose           Enable verbose output
    -h, --help          Show this help message

EXAMPLES:
    $0 --environment=staging --verbose
    $0 --environment=production --reset
EOF
}

# Create test environment directory structure
setup_directory_structure() {
    log_info "📁 Setting up test environment directory structure..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    
    if [[ "$RESET_ENVIRONMENT" == "true" && -d "$test_env_dir" ]]; then
        log_info "🗑️  Removing existing test environment..."
        rm -rf "$test_env_dir"
    fi
    
    # Create directory structure
    mkdir -p "$test_env_dir"/{database,logs,config,temp,backups,artifacts}
    mkdir -p "$test_env_dir"/node_modules/.cache
    
    log_success "✅ Directory structure created at $test_env_dir"
}

# Setup Node.js version management
setup_nodejs_environment() {
    log_info "🔧 Setting up Node.js environment for $ENVIRONMENT..."
    
    local target_version
    case "$ENVIRONMENT" in
        "staging")
            target_version="$STAGING_NODE_VERSION"
            ;;
        "production")
            target_version="$PRODUCTION_NODE_VERSION"
            ;;
        *)
            target_version="$STAGING_NODE_VERSION"
            ;;
    esac
    
    local current_version
    current_version=$(node --version | sed 's/v//')
    
    if [[ "$current_version" == "$target_version" ]]; then
        log_success "✅ Node.js version $current_version matches target $target_version"
    else
        log_warning "⚠️  Node.js version mismatch: current=$current_version, target=$target_version"
        
        # Check if nvm is available
        if command -v nvm > /dev/null 2>&1; then
            log_info "📦 Installing Node.js $target_version via nvm..."
            nvm install "$target_version"
            nvm use "$target_version"
        else
            log_warning "⚠️  nvm not available. Please manually install Node.js $target_version"
        fi
    fi
}

# Create test database configuration
setup_test_database() {
    log_info "🗄️  Setting up test database configuration..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local db_config_file="${test_env_dir}/config/database.json"
    
    # Create database configuration
    cat > "$db_config_file" << EOF
{
  "test_database": {
    "type": "sqlite",
    "database": "${test_env_dir}/database/test.db",
    "synchronize": false,
    "logging": false,
    "migrations": ["dist/database/migrations/**/*.js"],
    "entities": ["dist/database/entities/**/*.js"]
  },
  "integration_database": {
    "type": "sqlite",
    "database": "${test_env_dir}/database/integration.db",
    "synchronize": true,
    "logging": true,
    "entities": ["dist/database/entities/**/*.js"]
  },
  "performance_database": {
    "type": "sqlite",
    "database": "${test_env_dir}/database/performance.db",
    "synchronize": false,
    "logging": false,
    "entities": ["dist/database/entities/**/*.js"]
  }
}
EOF
    
    # Initialize test databases
    cd "$PROJECT_ROOT"
    
    # Create test database with schema
    if [[ -f "prisma/schema.prisma" ]]; then
        log_info "🔧 Initializing Prisma test database..."
        
        # Set environment variable for test database
        export DATABASE_URL="file:${test_env_dir}/database/test.db"
        
        # Generate Prisma client
        npx prisma generate
        
        # Run migrations
        npx prisma migrate deploy
        
        log_success "✅ Test database initialized"
    else
        log_warning "⚠️  Prisma schema not found, skipping database setup"
    fi
}

# Create environment-specific configuration
create_environment_config() {
    log_info "⚙️  Creating environment-specific configuration..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local env_config_file="${test_env_dir}/config/environment.json"
    
    case "$ENVIRONMENT" in
        "staging")
            cat > "$env_config_file" << EOF
{
  "environment": "staging",
  "node_env": "test",
  "log_level": "debug",
  "performance_monitoring": true,
  "error_reporting": true,
  "test_timeouts": {
    "unit": 30000,
    "integration": 60000,
    "e2e": 120000
  },
  "resource_limits": {
    "memory_mb": 1024,
    "cpu_percent": 80,
    "disk_mb": 2048
  },
  "mock_services": {
    "proxmox_api": true,
    "external_apis": true,
    "file_system": false
  },
  "test_data_sets": {
    "small": "10_vms_5_containers",
    "medium": "50_vms_20_containers",
    "large": "100_vms_50_containers"
  }
}
EOF
            ;;
        "production")
            cat > "$env_config_file" << EOF
{
  "environment": "production",
  "node_env": "production",
  "log_level": "info",
  "performance_monitoring": true,
  "error_reporting": true,
  "test_timeouts": {
    "unit": 10000,
    "integration": 30000,
    "e2e": 60000
  },
  "resource_limits": {
    "memory_mb": 512,
    "cpu_percent": 50,
    "disk_mb": 1024
  },
  "mock_services": {
    "proxmox_api": false,
    "external_apis": false,
    "file_system": false
  },
  "test_data_sets": {
    "small": "5_vms_2_containers",
    "medium": "25_vms_10_containers",
    "large": "50_vms_25_containers"
  },
  "strict_validation": true,
  "performance_budgets": {
    "api_response_ms": 200,
    "database_query_ms": 50,
    "memory_usage_mb": 256
  }
}
EOF
            ;;
    esac
    
    log_success "✅ Environment configuration created: $env_config_file"
}

# Setup Docker test environment
setup_docker_environment() {
    log_info "🐳 Setting up Docker test environment..."
    
    if ! command -v docker > /dev/null 2>&1; then
        log_warning "⚠️  Docker not found, skipping Docker environment setup"
        return 0
    fi
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    
    # Create Docker Compose file for test environment
    cat > "$DOCKER_COMPOSE_FILE" << EOF
version: '3.8'
services:
  proxmox-mpc-test:
    build:
      context: ${PROJECT_ROOT}
      dockerfile: Dockerfile.test
    environment:
      - NODE_ENV=test
      - DATABASE_URL=file:/app/test-db/test.db
      - LOG_LEVEL=debug
      - TEST_ENVIRONMENT=${ENVIRONMENT}
    volumes:
      - ${test_env_dir}/database:/app/test-db
      - ${test_env_dir}/logs:/app/logs
      - ${test_env_dir}/config:/app/config
    ports:
      - "3001:3000"
    networks:
      - test-network
  
  test-database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=proxmox_mpc_test
      - POSTGRES_USER=test_user
      - POSTGRES_PASSWORD=test_password
    volumes:
      - ${test_env_dir}/database/postgres:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    networks:
      - test-network
  
  mock-proxmox:
    build:
      context: ${PROJECT_ROOT}/test-utils/mock-server
      dockerfile: Dockerfile
    ports:
      - "8006:8006"
    environment:
      - MOCK_MODE=${ENVIRONMENT}
    networks:
      - test-network

networks:
  test-network:
    driver: bridge
EOF
    
    log_success "✅ Docker Compose configuration created"
}

# Create test Dockerfile
create_test_dockerfile() {
    log_info "📦 Creating test Dockerfile..."
    
    cat > "${PROJECT_ROOT}/Dockerfile.test" << EOF
FROM node:${STAGING_NODE_VERSION}-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    git \
    bash \
    curl \
    jq

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Build the application
RUN npm run build

# Create test directories
RUN mkdir -p /app/test-db /app/logs /app/config

# Set up Prisma
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default command
CMD ["npm", "test"]
EOF
    
    log_success "✅ Test Dockerfile created"
}

# Setup test data and fixtures
setup_test_data() {
    log_info "📊 Setting up test data and fixtures..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local fixtures_dir="${test_env_dir}/fixtures"
    
    mkdir -p "$fixtures_dir"
    
    # Create test data configuration
    cat > "${fixtures_dir}/test-data-config.json" << EOF
{
  "test_data_sets": {
    "minimal": {
      "description": "Minimal test data for unit tests",
      "nodes": 1,
      "vms": 2,
      "containers": 1,
      "storage": 1
    },
    "standard": {
      "description": "Standard test data for integration tests",
      "nodes": 2,
      "vms": 10,
      "containers": 5,
      "storage": 3
    },
    "performance": {
      "description": "Large data set for performance testing",
      "nodes": 3,
      "vms": 50,
      "containers": 25,
      "storage": 5
    }
  },
  "mock_responses": {
    "proxmox_api": {
      "version": "7.4-3",
      "auth_method": "token",
      "cluster_status": "healthy"
    }
  }
}
EOF
    
    # Create sample test fixtures
    cat > "${fixtures_dir}/sample-vm.json" << EOF
{
  "vmid": 100,
  "name": "test-vm-01",
  "status": "running",
  "maxcpu": 2,
  "maxmem": 2147483648,
  "disk": 10737418240,
  "node": "test-node-01",
  "template": false,
  "tags": "test,automation",
  "uptime": 3600
}
EOF
    
    cat > "${fixtures_dir}/sample-container.json" << EOF
{
  "vmid": 200,
  "name": "test-ct-01",
  "status": "running",
  "maxcpu": 1,
  "maxmem": 536870912,
  "disk": 2147483648,
  "node": "test-node-01",
  "template": false,
  "tags": "test,container",
  "uptime": 1800
}
EOF
    
    log_success "✅ Test data and fixtures created"
}

# Create test runner configuration
create_test_runner_config() {
    log_info "🧪 Creating test runner configuration..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local test_config_file="${test_env_dir}/config/jest.config.test.js"
    
    cat > "$test_config_file" << EOF
const baseConfig = require('${PROJECT_ROOT}/jest.config.js');

module.exports = {
  ...baseConfig,
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '${PROJECT_ROOT}/jest.setup.js',
    '${test_env_dir}/config/test-setup.js'
  ],
  globalTeardown: '${test_env_dir}/config/test-teardown.js',
  testTimeout: ${ENVIRONMENT === "production" ? 10000 : 30000},
  maxWorkers: ${ENVIRONMENT === "production" ? 2 : 4},
  coverageThreshold: {
    global: {
      branches: ${ENVIRONMENT === "production" ? 95 : 90},
      functions: ${ENVIRONMENT === "production" ? 95 : 90},
      lines: ${ENVIRONMENT === "production" ? 95 : 90},
      statements: ${ENVIRONMENT === "production" ? 95 : 90}
    }
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],
  coverageReporters: ['text', 'html', 'json-summary'],
  coverageDirectory: '${test_env_dir}/coverage',
  verbose: true,
  testEnvironmentOptions: {
    url: 'http://localhost:3001'
  }
};
EOF
    
    # Create test setup file
    cat > "${test_env_dir}/config/test-setup.js" << EOF
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:${test_env_dir}/database/test.db';
process.env.LOG_LEVEL = '${ENVIRONMENT === "production" ? "error" : "debug"}';
process.env.TEST_ENVIRONMENT = '${ENVIRONMENT}';

// Global test timeout
jest.setTimeout(${ENVIRONMENT === "production" ? 10000 : 30000});

// Setup test database before each test suite
beforeAll(async () => {
  console.log('Setting up test environment: ${ENVIRONMENT}');
  
  // Initialize database if needed
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    await prisma.\$connect();
    console.log('Test database connected successfully');
  } catch (error) {
    console.error('Test database connection failed:', error);
    throw error;
  } finally {
    await prisma.\$disconnect();
  }
});

// Cleanup after tests
afterAll(async () => {
  console.log('Cleaning up test environment: ${ENVIRONMENT}');
  // Add cleanup logic here
});
EOF
    
    # Create test teardown file
    cat > "${test_env_dir}/config/test-teardown.js" << EOF
module.exports = async () => {
  console.log('Global test teardown for environment: ${ENVIRONMENT}');
  
  // Clean up any global resources
  if (global.__DATABASE__) {
    await global.__DATABASE__.close();
  }
  
  // Additional cleanup logic
  console.log('Test environment cleanup completed');
};
EOF
    
    log_success "✅ Test runner configuration created"
}

# Validate test environment setup
validate_test_environment() {
    log_info "✅ Validating test environment setup..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local validation_passed=true
    
    # Check directory structure
    local required_dirs=("database" "logs" "config" "temp" "backups" "artifacts" "fixtures")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "${test_env_dir}/${dir}" ]]; then
            log_error "❌ Missing required directory: $dir"
            validation_passed=false
        fi
    done
    
    # Check configuration files
    local required_configs=("config/environment.json" "config/database.json" "config/jest.config.test.js")
    for config in "${required_configs[@]}"; do
        if [[ ! -f "${test_env_dir}/${config}" ]]; then
            log_error "❌ Missing configuration file: $config"
            validation_passed=false
        fi
    done
    
    # Validate Node.js environment
    local current_node_version
    current_node_version=$(node --version | sed 's/v//')
    local expected_version
    expected_version=$([ "$ENVIRONMENT" = "production" ] && echo "$PRODUCTION_NODE_VERSION" || echo "$STAGING_NODE_VERSION")
    
    if [[ "$current_node_version" != "$expected_version" ]]; then
        log_warning "⚠️  Node.js version mismatch: expected $expected_version, got $current_node_version"
    fi
    
    # Test database connectivity
    cd "$PROJECT_ROOT"
    export DATABASE_URL="file:${test_env_dir}/database/test.db"
    
    if npx prisma db push > /dev/null 2>&1; then
        log_success "✅ Database connectivity validated"
    else
        log_error "❌ Database connectivity failed"
        validation_passed=false
    fi
    
    if [[ "$validation_passed" == "true" ]]; then
        log_success "🎉 Test environment validation passed!"
        return 0
    else
        log_error "❌ Test environment validation failed"
        return 1
    fi
}

# Generate environment summary report
generate_environment_report() {
    log_info "📋 Generating test environment report..."
    
    local test_env_dir="${TEST_DATABASE_PATH}/${ENVIRONMENT}"
    local report_file="${test_env_dir}/environment-report.md"
    
    cat > "$report_file" << EOF
# Test Environment Report

**Environment:** ${ENVIRONMENT}
**Generated:** $(date -Iseconds)
**Setup Script:** $0

## Environment Configuration

- **Node.js Version:** $(node --version)
- **NPM Version:** $(npm --version)
- **Operating System:** $(uname -s) $(uname -m)
- **Test Environment Path:** ${test_env_dir}

## Directory Structure

\`\`\`
${test_env_dir}/
├── database/          # Test databases
├── logs/              # Test execution logs
├── config/            # Environment-specific configuration
├── temp/              # Temporary files
├── backups/           # Database backups
├── artifacts/         # Test artifacts and reports
└── fixtures/          # Test data fixtures
\`\`\`

## Configuration Files

- **Environment Config:** \`config/environment.json\`
- **Database Config:** \`config/database.json\`
- **Test Runner Config:** \`config/jest.config.test.js\`
- **Test Setup:** \`config/test-setup.js\`
- **Test Teardown:** \`config/test-teardown.js\`

## Test Execution Commands

\`\`\`bash
# Run tests in this environment
npm test -- --config=${test_env_dir}/config/jest.config.test.js

# Run with coverage
npm run test:coverage -- --config=${test_env_dir}/config/jest.config.test.js

# Run specific test suites
npm test -- --testPathPattern=integration --config=${test_env_dir}/config/jest.config.test.js
\`\`\`

## Docker Environment

$(if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
    echo "Docker Compose file available at: \`$DOCKER_COMPOSE_FILE\`"
    echo ""
    echo "\`\`\`bash"
    echo "# Start Docker test environment"
    echo "docker-compose -f $DOCKER_COMPOSE_FILE up -d"
    echo ""
    echo "# Stop Docker test environment"
    echo "docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "\`\`\`"
else
    echo "Docker environment not configured."
fi)

## Environment Validation

✅ Test environment setup completed successfully

## Next Steps

1. Run validation tests: \`npm run validate:pre-release --environment=${ENVIRONMENT}\`
2. Execute test suites: \`npm test -- --config=${test_env_dir}/config/jest.config.test.js\`
3. Review test coverage reports in \`${test_env_dir}/coverage/\`

---
Generated by Proxmox-MPC Test Environment Setup
EOF
    
    log_success "Environment report generated: $report_file"
}

# Main setup orchestrator
run_environment_setup() {
    log_section "🎯 Setting up release testing environment: $ENVIRONMENT"
    log_info "Reset Environment: $RESET_ENVIRONMENT"
    log_info "Verbose Mode: $VERBOSE"
    
    cd "$PROJECT_ROOT"
    
    # Run setup steps
    setup_directory_structure
    setup_nodejs_environment
    setup_test_database
    create_environment_config
    setup_docker_environment
    create_test_dockerfile
    setup_test_data
    create_test_runner_config
    
    # Validate setup
    if validate_test_environment; then
        generate_environment_report
        log_success "🎉 Test environment setup completed successfully!"
        return 0
    else
        log_error "❌ Test environment setup failed validation"
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    
    if [[ "$VERBOSE" == "true" ]]; then
        set -x
    fi
    
    run_environment_setup
}

# Run main function with all arguments
main "$@"