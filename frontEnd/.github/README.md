# GitHub Actions CI/CD Pipeline

This directory contains the GitHub Actions workflows for continuous integration and deployment.

## Workflows

### CI/CD Pipeline (`ci-cd.yml`)

Automated pipeline that runs on every push and pull request:

#### Jobs

1. **Lint** - Runs ESLint to check code quality
2. **Test** - Executes all unit and integration tests
3. **Build** - Builds the Next.js application
4. **Deploy Preview** - Deploys preview for pull requests
5. **Deploy Production** - Deploys to production on main branch

#### Required Secrets

Configure these in your GitHub repository settings (Settings → Secrets and variables → Actions):

```
VERCEL_TOKEN          - Your Vercel authentication token
VERCEL_ORG_ID         - Your Vercel organization ID
VERCEL_PROJECT_ID     - Your Vercel project ID
NEXT_PUBLIC_SOLANA_RPC_URL      - Solana RPC endpoint URL
NEXT_PUBLIC_SOLANA_NETWORK      - Solana network (mainnet-beta/devnet)
NEXT_PUBLIC_JUPITER_API_URL     - Jupiter API URL
NEXT_PUBLIC_SENTRY_DSN          - (Optional) Sentry DSN for error tracking
NEXT_PUBLIC_ANALYTICS_ID        - (Optional) Analytics tracking ID
```

#### Getting Vercel Credentials

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Link project: `vercel link`
4. Get tokens from: https://vercel.com/account/tokens
5. Get Org ID and Project ID from project settings

#### Workflow Triggers

- **Push to main**: Runs full pipeline + production deployment
- **Push to develop**: Runs full pipeline + staging deployment
- **Pull Request**: Runs full pipeline + preview deployment

#### Branch Protection

Recommended branch protection rules for `main`:

- Require pull request reviews before merging
- Require status checks to pass (lint, test, build)
- Require branches to be up to date before merging
- Include administrators in restrictions

## Local Testing

Test the workflow locally before pushing:

```bash
# Run linting
npm run lint

# Run tests
npm run test

# Build application
npm run build
```

## Troubleshooting

### Build Failures

**Issue**: Dependencies not installing
**Solution**: Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

**Issue**: TypeScript errors
**Solution**: Check types locally
```bash
npm run lint
npx tsc --noEmit
```

### Deployment Failures

**Issue**: Vercel authentication fails
**Solution**: Regenerate Vercel token and update GitHub secret

**Issue**: Environment variables not set
**Solution**: Verify all required secrets are configured in GitHub

## Monitoring

Monitor workflow runs:
- Go to repository → Actions tab
- View logs for each job
- Check deployment status in Vercel dashboard

## Support

For issues with:
- GitHub Actions: https://docs.github.com/en/actions
- Vercel Deployment: https://vercel.com/docs
- Next.js Build: https://nextjs.org/docs
