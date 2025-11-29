#!/bin/bash

# Deployment script for Solana DEX Frontend
# Usage: ./scripts/deploy.sh [environment]
# Environments: production, staging, preview

set -e

ENVIRONMENT=${1:-production}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_status "All dependencies are installed"
}

# Run tests before deployment
run_tests() {
    print_status "Running tests..."
    npm run test || {
        print_error "Tests failed. Aborting deployment."
        exit 1
    }
    print_status "All tests passed"
}

# Run linting
run_lint() {
    print_status "Running linter..."
    npm run lint || {
        print_error "Linting failed. Aborting deployment."
        exit 1
    }
    print_status "Linting passed"
}

# Build the application
build_app() {
    print_status "Building application for $ENVIRONMENT..."
    
    # Set environment-specific variables
    if [ "$ENVIRONMENT" = "production" ]; then
        export NODE_ENV=production
        export NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
    elif [ "$ENVIRONMENT" = "staging" ]; then
        export NODE_ENV=production
        export NEXT_PUBLIC_SOLANA_NETWORK=devnet
    else
        export NODE_ENV=development
        export NEXT_PUBLIC_SOLANA_NETWORK=devnet
    fi
    
    npm run build || {
        print_error "Build failed. Aborting deployment."
        exit 1
    }
    
    print_status "Build completed successfully"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    if [ "$ENVIRONMENT" = "production" ]; then
        vercel --prod --yes
    else
        vercel --yes
    fi
    
    print_status "Deployment to Vercel completed"
}

# Deploy to Netlify
deploy_netlify() {
    print_status "Deploying to Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        print_warning "Netlify CLI not found. Installing..."
        npm install -g netlify-cli
    fi
    
    if [ "$ENVIRONMENT" = "production" ]; then
        netlify deploy --prod --dir=.next
    else
        netlify deploy --dir=.next
    fi
    
    print_status "Deployment to Netlify completed"
}

# Main deployment flow
main() {
    echo "================================================"
    echo "  Solana DEX Frontend Deployment"
    echo "  Environment: $ENVIRONMENT"
    echo "================================================"
    echo ""
    
    check_dependencies
    run_lint
    run_tests
    build_app
    
    # Ask user which platform to deploy to
    echo ""
    echo "Select deployment platform:"
    echo "1) Vercel"
    echo "2) Netlify"
    echo "3) Skip deployment (build only)"
    read -p "Enter choice [1-3]: " choice
    
    case $choice in
        1)
            deploy_vercel
            ;;
        2)
            deploy_netlify
            ;;
        3)
            print_status "Skipping deployment. Build artifacts are ready."
            ;;
        *)
            print_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    echo ""
    echo "================================================"
    print_status "Deployment process completed successfully!"
    echo "================================================"
}

# Run main function
main
