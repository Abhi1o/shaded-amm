#!/bin/bash

# Pre-deployment checklist script
# Run this before deploying to production

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

echo "1. Checking environment configuration..."
if [ -f ".env.production" ]; then
    check_pass "Production environment file exists"
    
    # Check for required variables
    if grep -q "NEXT_PUBLIC_SOLANA_RPC_URL" .env.production; then
        check_pass "Solana RPC URL configured"
    else
        check_fail "Missing NEXT_PUBLIC_SOLANA_RPC_URL in .env.production"
    fi
    
    if grep -q "NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta" .env.production; then
        check_pass "Network set to mainnet-beta"
    else
        check_warn "Network not set to mainnet-beta"
    fi
else
    check_warn ".env.production file not found (will use platform environment variables)"
fi

echo ""
echo "2. Checking code quality..."

# Run linting
if npm run lint > /dev/null 2>&1; then
    check_pass "Linting passed"
else
    check_fail "Linting failed - run 'npm run lint' to see errors"
fi

echo ""
echo "3. Running tests..."

# Run tests
if npm run test > /dev/null 2>&1; then
    check_pass "All tests passed"
else
    check_fail "Tests failed - run 'npm run test' to see failures"
fi

echo ""
echo "4. Checking build..."

# Try to build
if npm run build > /dev/null 2>&1; then
    check_pass "Production build successful"
else
    check_fail "Production build failed - run 'npm run build' to see errors"
fi

echo ""
echo "5. Checking security..."

# Check for sensitive data in code
if grep -r "private.*key\|secret\|password" src/ --include="*.ts" --include="*.tsx" | grep -v "// " | grep -v "publicKey" > /dev/null 2>&1; then
    check_warn "Potential sensitive data found in source code"
else
    check_pass "No obvious sensitive data in source code"
fi

# Check .gitignore
if grep -q ".env.production" .gitignore; then
    check_pass ".env.production is in .gitignore"
else
    check_fail ".env.production should be in .gitignore"
fi

echo ""
echo "6. Checking deployment configuration..."

# Check for deployment configs
if [ -f "vercel.json" ] || [ -f "netlify.toml" ]; then
    check_pass "Deployment configuration found"
else
    check_warn "No deployment configuration found"
fi

# Check for CI/CD
if [ -f ".github/workflows/ci-cd.yml" ]; then
    check_pass "CI/CD pipeline configured"
else
    check_warn "No CI/CD pipeline found"
fi

echo ""
echo "7. Checking dependencies..."

# Check for outdated critical dependencies
if npm outdated @solana/web3.js @solana/wallet-adapter-react next react > /dev/null 2>&1; then
    check_warn "Some dependencies may be outdated"
else
    check_pass "Core dependencies are up to date"
fi

echo ""
echo "================================================"
echo "Pre-deployment Check Summary"
echo "================================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found. Review before deploying.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo "Please fix errors before deploying to production."
    exit 1
fi
