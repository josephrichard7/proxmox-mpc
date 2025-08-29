#!/bin/bash

# Proxmox-MPC Production Deployment Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${1:-production}"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check .env file
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log_warning ".env file not found. Copying from .env.example"
        if [[ -f "$PROJECT_ROOT/.env.example" ]]; then
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            log_warning "Please edit .env file with your configuration before continuing"
            exit 1
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi
    
    # Check SSL certificates
    if [[ ! -d "$PROJECT_ROOT/docker/ssl" ]]; then
        log_warning "SSL certificates not found. Creating self-signed certificates..."
        mkdir -p "$PROJECT_ROOT/docker/ssl"
        generate_ssl_certificates
    fi
    
    log_success "Prerequisites check completed"
}

# Generate self-signed SSL certificates
generate_ssl_certificates() {
    local ssl_dir="$PROJECT_ROOT/docker/ssl"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$ssl_dir/key.pem" \
        -out "$ssl_dir/cert.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    log_info "Self-signed SSL certificates generated"
    log_warning "For production, replace with valid SSL certificates"
}

# Build and deploy
deploy() {
    log_info "Starting deployment for environment: $DEPLOY_ENV"
    
    cd "$PROJECT_ROOT"
    
    # Pull latest images
    log_info "Pulling latest base images..."
    docker compose -f "$COMPOSE_FILE" pull
    
    # Build application
    log_info "Building application images..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Start services
    log_info "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 30
    
    # Check service health
    check_health
    
    log_success "Deployment completed successfully"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log_success "Application is healthy"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for application..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Application health check failed"
    show_logs
    exit 1
}

# Show container logs
show_logs() {
    log_info "Container logs:"
    docker compose -f "$COMPOSE_FILE" logs --tail=50
}

# Backup data
backup_data() {
    local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    
    log_info "Creating backup in: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Backup database
    if docker compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "Backing up PostgreSQL database..."
        docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
            -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_dir/database.sql"
    else
        log_info "Backing up SQLite database..."
        docker cp proxmox-mpc:/app/data/proxmox-mpc.db "$backup_dir/" 2>/dev/null || true
    fi
    
    # Backup volumes
    log_info "Backing up application data..."
    docker run --rm -v proxmox_proxmox-data:/data -v "$backup_dir":/backup \
        alpine tar czf /backup/data.tar.gz -C /data .
    
    log_success "Backup completed: $backup_dir"
}

# Restore from backup
restore_data() {
    local backup_dir="${1:-}"
    
    if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
        log_error "Please provide a valid backup directory"
        exit 1
    fi
    
    log_warning "This will overwrite existing data. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from backup: $backup_dir"
    
    # Stop services
    docker compose -f "$COMPOSE_FILE" down
    
    # Restore database
    if [[ -f "$backup_dir/database.sql" ]]; then
        log_info "Restoring PostgreSQL database..."
        docker compose -f "$COMPOSE_FILE" up -d postgres
        sleep 10
        docker compose -f "$COMPOSE_FILE" exec -T postgres psql \
            -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$backup_dir/database.sql"
        docker compose -f "$COMPOSE_FILE" down
    fi
    
    # Restore data volume
    if [[ -f "$backup_dir/data.tar.gz" ]]; then
        log_info "Restoring application data..."
        docker run --rm -v proxmox_proxmox-data:/data -v "$backup_dir":/backup \
            alpine tar xzf /backup/data.tar.gz -C /data
    fi
    
    # Start services
    docker compose -f "$COMPOSE_FILE" up -d
    
    log_success "Restore completed"
}

# Update application
update() {
    log_info "Updating application..."
    
    # Create backup before update
    backup_data
    
    # Pull latest code (if using git)
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        log_info "Pulling latest code..."
        git pull origin main
    fi
    
    # Rebuild and redeploy
    deploy
    
    log_success "Update completed"
}

# Clean up old images and containers
cleanup() {
    log_info "Cleaning up old Docker resources..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Cleanup completed"
}

# Show usage information
usage() {
    echo "Proxmox-MPC Deployment Script"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  deploy [ENV]     Deploy application (default: production)"
    echo "  backup           Create backup of application data"
    echo "  restore DIR      Restore from backup directory"
    echo "  update           Update and redeploy application"
    echo "  logs             Show container logs"
    echo "  health           Check application health"
    echo "  cleanup          Clean up old Docker resources"
    echo "  help             Show this help message"
    echo
    echo "Examples:"
    echo "  $0 deploy production"
    echo "  $0 backup"
    echo "  $0 restore backups/20231201_120000"
    echo "  $0 logs"
}

# Main script logic
main() {
    case "${1:-help}" in
        deploy)
            check_prerequisites
            deploy
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "${2:-}"
            ;;
        update)
            check_prerequisites
            update
            ;;
        logs)
            show_logs
            ;;
        health)
            check_health
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: ${1:-}"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"