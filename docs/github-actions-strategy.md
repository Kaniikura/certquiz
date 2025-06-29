# GitHub Actions Strategy for CertQuiz

## Overview

This document defines the CI/CD strategy for CertQuiz, integrating best practices for solo development with on-premises Kubernetes clusters. The approach emphasizes cost-effectiveness, security, and maintainability while maintaining enterprise-grade quality.

## Core Principles

### CI/CD Philosophy

1. **Speed & Reliability**: < 5 minutes PR CI execution with 95%+ success rate
2. **Test-Driven Quality**: Mandatory TDD with 80% minimum coverage
3. **Zero-Cost Operations**: Leverage free tiers and existing infrastructure
4. **Security-First**: Supply chain protection and encrypted secrets
5. **Simple Operations**: Trunk-based development with automated quality gates

> **Performance Target**: PR checks achieve 5-minute target by moving E2E tests and container builds to post-merge jobs. Full validation takes 7-8 minutes.

### Quality Standards

- **Coverage Thresholds**: 80% global (Services 90%, Repositories 70%, Utils 80%)
- **TDD Enforcement**: Pre-commit hooks prevent code without tests
- **E2E Protection**: Playwright smoke tests for critical user flows
- **Security Scanning**: CodeQL and dependency vulnerability checks

## Branching Strategy

### Trunk-Based Development with GitOps

**Flow**: `Feature Branch` → `Main` → `Container Registry` → `Argo CD` → `Staging/Production`

**Core Components**:
- **Main Branch**: Always deployable, protected with status checks
- **Feature Branches**: Short-lived (`feat/*`, `fix/*`, `chore/*`)
- **No Environment Branches**: GitOps handles environment promotion
- **Direct Merge**: Simple squash merge with status check requirements

**Deployment Process**:
1. Create feature branch from main
2. Fast PR CI (lint + unit tests, < 5 minutes)
3. Squash merge to main with required status checks
4. Post-merge batch job (container build + E2E tests)
5. Automatic staging deployment via Argo CD
6. Manual promotion to production

**Hotfix**: Branch from main → Apply fix with tests → Fast-track merge → Auto-deploy

## Infrastructure Architecture

### Component Overview

| Component | Location | Purpose | Cost |
|-----------|----------|---------|------|
| CI Runners | GitHub-hosted | Tests, builds, security scans | Free |
| Deployment Runner | Self-hosted K8s | Kubernetes deployments only | ¥0 |
| Container Registry | GHCR | Image storage (500MB limit) | Free |
| GitOps | Argo CD | Environment synchronization | ¥0 |
| Secrets | SealedSecrets + 1Password | Encrypted credential management | ¥0 |
| Monitoring | Prometheus + Grafana Cloud | Metrics and alerting | ¥0 |

### Security Model

- **Zero Trust**: No inbound ports, outbound-only connections
- **Time-limited Access**: 1-hour ServiceAccount tokens for deployments
- **Encrypted Secrets**: SealedSecrets for Git storage, 1Password for sensitive data
- **Supply Chain Protection**: SHA-pinned actions, SBOM generation, container signing

## Workflow Architecture

### File Organization

```
.github/
├── workflows/
│   ├── ci.yml              # Fast PR checks (lint + unit tests)
│   ├── post-merge.yml      # Container build + E2E tests after merge
│   ├── security-nightly.yml # Combined security scanning + performance tests
│   └── deploy.yml          # Manual deployment workflow
├── actions/
│   ├── quality-check/      # Reusable quality gate
│   └── setup-env/          # Environment setup
└── dependabot.yml          # Dependency management
```

## Core Workflows

### Common Patterns

**Bun Setup with Enhanced Caching** (used across all workflows):
```yaml
# Optimized Bun environment with aggressive caching for <5min targets
- uses: actions/checkout@v4
- uses: oven-sh/setup-bun@v1
- id: bun-version
  run: echo "BUN_VERSION=$(bun --version)" >> $GITHUB_ENV
- uses: actions/cache@v4
  with:
    path: |
      ~/.bun/install/cache
      **/node_modules
    key: ${{ runner.os }}-bun-${{ env.BUN_VERSION }}-${{ hashFiles('**/bun.lock') }}
    restore-keys: |
      ${{ runner.os }}-bun-${{ env.BUN_VERSION }}-
      ${{ runner.os }}-bun-
- run: bun install --frozen-lockfile
```

**Docker Build with Registry Caching** (shared pattern):
```yaml
# Optimized Docker build with registry-based caching
- uses: docker/setup-buildx-action@v3
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@v5
  with:
    context: .
    file: apps/api/Dockerfile
    push: true
    cache-from: type=registry,ref=ghcr.io/${{ github.repository }}/api:cache
    cache-to: type=registry,ref=ghcr.io/${{ github.repository }}/api:cache,mode=max
    platforms: linux/amd64  # Single platform for speed
```

### Fast PR CI Pipeline (`ci.yml`)

**Target**: < 5 minutes execution with unit tests only (E2E tests moved to post-merge)

**Key Features**:
- Parallel lint check (2 minutes) for immediate feedback
- Matrix strategy for workspace testing with optimized performance
- Smart test selection using `--changed` flag for faster execution
- **Coverage disabled on PRs** for speed (moved to post-merge)
- Aggressive caching with 90%+ hit rate targeting

```yaml
name: Fast CI
on: [pull_request]
permissions:
  contents: read
  actions: write  # Required for cache uploads
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      # [Enhanced Bun Setup Pattern]
      - run: bun run lint && bun run typecheck

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 8  # Reduced by removing coverage
    strategy:
      matrix: 
        include:
          - workspace: api
          - workspace: web  
          - workspace: shared
      fail-fast: false
    steps:
      # [Enhanced Bun Setup with workspace-specific caching]
      - name: Run fast unit tests
        run: |
          # Workspace path determination and fast testing
          WORKSPACE_PATH=$([[ "${{ matrix.workspace }}" == "shared" ]] && echo "packages/${{ matrix.workspace }}" || echo "apps/${{ matrix.workspace }}")
          cd "$WORKSPACE_PATH"
          bun run lint && bun run typecheck
          # Fast unit tests without coverage for speed
          bun test --exclude="**/*.e2e.test.ts" --reporter=dot
        env:
          VITEST_MAX_THREADS: 4  # Increased for faster execution
          BUN_JSC_forceRAMSize: 2048
```


### Deployment Workflow (`deploy.yml`)

**Trigger**: Manual dispatch with environment selection
**GitOps**: Updates image tags in Git for Argo CD synchronization

**Key Features**:
- GitHub Environments with required approvals for production
- Container signing with cosign and SBOM generation
- GitOps-based deployment (no direct kubectl commands)
- Registry caching for faster builds

```yaml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      environment: 
        type: choice
        options: [staging, production]
        required: true

permissions:
  contents: read
  packages: write
  id-token: write  # For OIDC/cosign

jobs:
  build-push:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}  # Require approval for production
    steps:
      # [Standard Bun Setup Pattern]
      - run: bun run build
      
      # [Docker Build with Registry Caching Pattern]
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/api
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
      
      # Security: Container signing and SBOM
      - uses: sigstore/cosign-installer@v3
      - run: |
          cosign sign --yes ghcr.io/${{ github.repository }}/api@${{ steps.build.outputs.digest }}
          bunx @cyclonedx/bom -o sbom.json
          cosign attest --yes --predicate sbom.json --type cyclonedx ghcr.io/${{ github.repository }}/api@${{ steps.build.outputs.digest }}

  gitops-update:
    needs: build-push
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          repository: ${{ github.repository }}
          path: gitops
          token: ${{ secrets.GITOPS_TOKEN || secrets.GITHUB_TOKEN }}
          
      - name: Update GitOps repository
        run: |
          cd gitops/k8s/overlays/${{ inputs.environment }}
          kustomize edit set image api=ghcr.io/${{ github.repository }}/api:${{ github.sha }}
          
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add . && git commit -m "feat(deploy): update ${{ inputs.environment }} to ${{ github.sha }}" && git push
          
          echo "✅ Deployment initiated. Argo CD will sync within 3 minutes."
```

### Post-Merge Validation (`post-merge.yml`)

**Triggered after merge to main** - Full validation with container build and E2E tests

**Key Features**:
- Concurrency control prevents overlapping builds
- Multi-browser E2E testing with Playwright
- Full test coverage aggregation across workspaces
- Container signing and SBOM generation

```yaml
name: Post-Merge Validation
on: 
  push: {branches: [main]}
  workflow_dispatch: {}

permissions:
  contents: read
  packages: write
  id-token: write

concurrency:
  group: post-merge-main
  cancel-in-progress: false  # Let builds complete

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # [Standard Bun Setup Pattern]
      - run: bun run build
      
      # [Docker Build with Registry Caching Pattern]
      # [Container Signing and SBOM Generation]

  e2e-tests:
    needs: build-and-test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      # [Enhanced Bun Setup with Playwright browser caching]
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('**/package.json') }}
      - run: bunx playwright install --with-deps chromium  # Chromium only for speed
      - run: bunx playwright test --project=chromium --workers=2
        env:
          API_IMAGE: ${{ needs.build-and-test.outputs.image-tag }}
          
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ github.sha }}
          path: playwright-report/
          retention-days: 7

  full-coverage:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      # [Enhanced Bun Setup Pattern]
      # Run complete test suite with coverage and thresholds
      - run: |
          # API workspace - 90% threshold
          cd apps/api && bun test --coverage --coverage.thresholds.statements=90 && cd -
          # Web workspace - 80% threshold  
          cd apps/web && bun test --coverage --coverage.thresholds.statements=80 && cd -
          # Shared workspace - 80% threshold
          cd packages/shared && bun test --coverage --coverage.thresholds.statements=80 && cd -
        env:
          VITEST_MAX_THREADS: 4
          BUN_JSC_forceRAMSize: 2048
```

### Security & Nightly Monitoring (`security-nightly.yml`)

**Combined workflow** - Security scans, performance monitoring, and validation

**Key Features**:
- Dependency scanning on PRs with `audit-ci`
- CodeQL scanning for security vulnerabilities
- Container vulnerability scanning with Trivy
- Nightly performance tests and smoke E2E tests
- Prometheus rule validation
- Automated issue creation on failures

```yaml
name: Security & Nightly Monitoring
on: 
  pull_request: {branches: [main]}  # Dependency scan only
  push: {branches: [main]}          # Full security scans
  schedule: [{cron: '0 2 * * *'}]   # Daily monitoring
  workflow_dispatch: {}

permissions:
  contents: read
  security-events: write
  actions: read
  issues: write

jobs:
  dependency-scan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      # [Standard Bun Setup Pattern]
      - run: bunx audit-ci --moderate  # Fail on moderate+ vulnerabilities

  security-scans:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      matrix:
        scan-type: [codeql, container]
    steps:
      - uses: actions/checkout@v4
      # CodeQL scanning with custom configuration
      - if: matrix.scan-type == 'codeql'
        uses: github/codeql-action/init@v3
        with:
          languages: typescript,javascript
          config-file: ./.github/codeql/codeql-config.yml
      
      # Container vulnerability scanning
      - if: matrix.scan-type == 'container'
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/api:main
          format: sarif
          output: trivy-results.sarif

  nightly-monitoring:
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # [Standard Bun Setup Pattern]
      # Performance testing with k6 and smoke E2E tests
      - run: |
          docker compose -f docker/docker-compose.yml up -d --wait && sleep 30
          curl -L https://github.com/grafana/k6/releases/latest/download/k6-v0.47.0-linux-amd64.tar.gz | tar -xz
          ./k6-*/k6 run tests/k6/quiz-api.js
          
      - run: |
          bunx playwright install --with-deps chromium
          bunx playwright test --grep @smoke --project=chromium --workers=1
        env:
          BASE_URL: https://staging.certquiz.app
          
      # Automated failure notifications
      - if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Nightly monitoring failed',
              body: 'Check logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}',
              labels: ['monitoring-failure']
            })
```


## Infrastructure Setup

### Quick Setup Commands

**Self-hosted Runner** (ARC with security constraints):
```bash
# Install Actions Runner Controller with security-first configuration
helm install arc actions-runner-controller/actions-runner-controller --namespace arc-system --create-namespace

# Deploy ephemeral runners with resource limits and non-root security
kubectl apply -f - <<EOF
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata: {name: certquiz-runner, namespace: arc-runners}
spec:
  template:
    spec:
      ephemeral: true  # Security: Fresh runner per job
      repository: Kaniikura/certquiz
      labels: [self-hosted, k8s]
      securityContext: {runAsNonRoot: true, runAsUser: 1000}
      resources: {limits: {cpu: "2", memory: "4Gi"}}
EOF
```

**GitOps with Argo CD**:
```bash
# Install Argo CD and configure automated sync for CertQuiz
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Configure application with automated pruning and self-healing
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: {name: certquiz, namespace: argocd}
spec:
  source: {repoURL: 'https://github.com/Kaniikura/certquiz', path: k8s/overlays/staging}
  destination: {namespace: certquiz-staging}
  syncPolicy: {automated: {prune: true, selfHeal: true}}
EOF
```

**Sealed Secrets & Monitoring**:
```bash
# Encrypted secret management
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml
brew install kubeseal

# Essential monitoring stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set prometheus.prometheusSpec.retention=15d
```

## Security & Compliance

### Core Security Practices

**Implementation Strategy**: Enterprise-grade security with solo developer simplicity

| Practice | Implementation | Automation Level |
|----------|----------------|------------------|
| **SHA Pinning** | All actions pinned with version comments | Dependabot auto-updates |
| **Least Privilege** | Minimal permissions per workflow | YAML-defined |
| **Secret Protection** | SealedSecrets + GitHub Secrets | Git-encrypted storage |
| **Supply Chain** | SBOM + container signing | Auto on builds |
| **Vulnerability Scanning** | CodeQL + dependency checks | Daily + PR-triggered |

### Secure Workflow Patterns

**Key Security Implementations**:
- Action SHA pinning with version comments for maintenance
- Safe environment variable handling with proper escaping
- Minimal permissions scope (read/write only as needed)
- Supply chain protection with SBOM generation and container signing
- Regular security scanning with automated vulnerability detection

```yaml
# Example secure patterns
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
permissions:
  contents: read
  security-events: write
- run: bunx @cyclonedx/bom -o sbom.json && cosign sign $IMAGE
```

**Solo Developer Security Model**: 
- 1-hour tokens for deployments, encrypted Git secrets
- SealedSecrets over Vault complexity, quarterly key rotation
- GitHub security features + simple tooling over complex enterprise solutions


## Performance & Quality

### Optimization Strategies

**Multi-layer Performance Approach** for < 5 minute PR feedback:

| Technique | Implementation | Target | Critical Success Factor |
|-----------|----------------|--------|------------------------|
| **Parallel Testing** | Matrix strategy | 5-7 min | Aggressive caching required |
| **Smart Test Selection** | `--changed` flag on PRs | 3-5 min | Skip unchanged code |
| **Registry Caching** | BuildKit + GHCR layers | 50% faster builds | Multi-stage optimization |
| **Quick Feedback** | Separate lint job | 30s fail-fast | Immediate syntax feedback |

### Enhanced Caching Strategy

**Critical Implementation Pattern**:
```yaml
# Multi-layer caching: Bun + node_modules + Playwright + Docker registry
- uses: actions/cache@v4
  with:
    path: |
      ~/.bun/install/cache
      **/node_modules
      ~/.cache/ms-playwright
    key: ${{ runner.os }}-deps-${{ hashFiles('**/bun.lock') }}
    restore-keys: |
      ${{ runner.os }}-deps-

# Optimized test execution - coverage only on post-merge
- run: |
    if [ "${{ github.event_name }}" = "pull_request" ]; then
      # Fast PR tests without coverage
      bun test --exclude="**/*.e2e.test.ts" --reporter=dot
    else
      # Full post-merge tests with coverage and thresholds
      bun test --coverage --coverage.thresholds.statements=80
    fi
  env:
    VITEST_MAX_THREADS: 4
    BUN_JSC_forceRAMSize: 2048
```

**Performance Reality**: 90%+ cache hit rate + coverage separation essential for < 5 minute targets

### Performance Monitoring

**Nightly Performance Validation**: Integrated into security-nightly.yml workflow to keep CI/CD streamlined

## Dependency Management

### Automated Dependency Updates

**Strategy**: Auto-merge safe patches, manual review for major updates

**Dependabot Configuration**:
- Weekly dependency updates (Monday 4 AM JST)
- Grouped dev dependencies and @types packages
- Auto-merge dev patches only, flag production/major updates
- GitHub Actions SHA pinning with weekly updates

**Enhanced Alternative - Renovate**:
- Automatic SHA pinning for GitHub Actions with version comments
- OpenSSF Scorecard security scoring integration
- Better monorepo support with granular auto-merge rules
- Vulnerability alert prioritization with immediate scheduling

**Auto-merge Rules**:
```yaml
# Auto-merge pattern: dev dependencies + patch updates only
if [[ "$dependency_type" == "direct:development" && 
      "$update_type" == "version-update:semver-patch" ]]; then
  gh pr merge --auto --squash
else
  gh pr edit --add-label "needs-manual-review"
fi
```

## Branch Protection & Quality Gates

### Essential Protection Rules

**Core Protections**: Status checks required (CI + CodeQL), CODEOWNERS approval, no direct push/force push, require up-to-date branches.

**CODEOWNERS** (`.github/CODEOWNERS`):
```
* Kaniikura
/.github/ Kaniikura
/k8s/ Kaniikura
/apps/api/src/db/ Kaniikura
```

**Commit Convention**: `type(scope): description` with conventional commits + gitmoji support.

**Required Status Checks**: All workspace tests, CodeQL scanning, E2E smoke tests (main branch).

## Essential Configuration Templates

### Security Setup
**GitHub Security Features**: Enable secret scanning, push protection, dependency graph, and vulnerability alerts via GitHub CLI.

**CodeQL Configuration**: Enhanced scanning with security-and-quality + security-extended queries, excluding node_modules and test files.

### Production Dockerfile
```dockerfile
# Multi-stage build with security hardening
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS production
RUN apk update && apk upgrade && apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S bun -u 1001 -G nodejs
WORKDIR /app
COPY --from=builder --chown=bun:nodejs /app/apps/api/dist ./
USER bun  # Non-root execution
EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "start"]
```

### TDD Enforcement & Coverage
**Lefthook Git Hooks**: Pre-commit TDD enforcement (fail if code changes without tests) + lint-staged with Biome.

**Coverage Thresholds**: Layer-specific requirements (Services 90%, Repositories 70%, Utils 80%) with file-specific overrides for critical components.

## Success Metrics & Implementation

### Performance Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| **PR CI Duration** | < 5 minutes | Fast feedback with unit tests only |
| **Post-merge Duration** | < 15 minutes | Full validation with E2E + build |
| **Build Success Rate** | > 95% | GitHub Actions dashboard |
| **Test Coverage** | > 80% global | Vitest thresholds in CI |
| **MTTR** | < 15 minutes | Automated rollback |
| **Cache Hit Rate** | > 90% | Registry + Bun cache |

### Additional Features

**Database Migration Validation** (when needed):
```yaml
# Validate schema changes with PostgreSQL service
migration-check:
  services:
    postgres: {image: postgres:16-alpine}
  steps:
    - run: bun run db:migrate --dry-run
```

**Container Cleanup** (weekly):
```yaml
# Keep latest + 3 versions, delete older images
name: GHCR Cleanup
on:
  schedule: [{cron: '0 2 * * 1'}]  # Weekly on Monday
  workflow_dispatch: {}

permissions:
  packages: write
  contents: read

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const package_type = 'container';
            const package_name = 'api';
            const keep_count = 5;  # Keep latest 5 versions
            
            try {
              const versions = await github.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
                package_type,
                package_name,
                org: context.repo.owner,
                per_page: 100
              });
              
              // Sort by created date, keep recent ones
              const sortedVersions = versions.data.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
              );
              
              const versionsToDelete = sortedVersions.slice(keep_count);
              
              for (const version of versionsToDelete) {
                console.log(`Deleting version ${version.id} (${version.name})`);
                await github.rest.packages.deletePackageVersionForOrg({
                  package_type,
                  package_name,
                  org: context.repo.owner,
                  package_version_id: version.id
                });
              }
              
              console.log(`Cleaned up ${versionsToDelete.length} old versions`);
            } catch (error) {
              console.error('Cleanup failed:', error);
              throw error;
            }
```

**Failure Notifications** (main branch only):
```yaml
- if: failure() && github.ref == 'refs/heads/main'
  uses: 8398a7/action-slack@v3
```

## Implementation Phases

### Phase A: Essential CI/CD (Week 1) - Solo Developer Focus
- [ ] **Enhanced CI workflow** with aggressive caching for <5min targets
- [ ] **Optimized test execution** (coverage only on post-merge)
- [ ] **Minimal permissions** and streamlined workflows
- [ ] **Branch protection** with required status checks (no merge queue)
- [ ] **SHA-pinned actions** with Dependabot auto-updates
- [ ] **Basic deployment** with kubectl or simple Argo CD app

### Phase A+: Production Foundation (Week 2) - Stable Operations
- [ ] **GitOps deployment** (Git-based image tag updates)
- [ ] **GitHub Environments** with required approvals for production
- [ ] **CodeQL scanning** with standard configuration
- [ ] **Dependency scanning** on PRs with audit-ci
- [ ] **GHCR auto-cleanup** with retention policy (stay under 500MB)
- [ ] **Coverage reporting** in post-merge workflow

### Phase B: Deferred Enhancements (Future) - Advanced Features
- [ ] **Merge queue** (requires paid GitHub plan)
- [ ] **Playwright E2E in CI** (run locally until flows stabilize)
- [ ] **Full SBOM+cosign** (script it once images stabilize)
- [ ] **Multi-browser E2E** testing
- [ ] **Self-hosted runner** on K8s with security constraints
- [ ] **Preview environments** for PR-based testing
- [ ] **Advanced monitoring** with OpenTelemetry tracing
- [ ] **Extensive metrics** with Grafana Cloud integration

## Performance Optimization Rationale

### Key Changes Based on Expert Review

**Coverage Strategy Optimization**:
- **PRs**: Coverage disabled for <5min feedback (lint + fast unit tests only)
- **Post-merge**: Full coverage with thresholds enforced for quality assurance
- **Result**: 40-50% faster PR feedback while maintaining quality gates

**E2E Testing Simplification**:
- **Chromium only** instead of multi-browser matrix (halves execution time)
- **Local E2E development** until workflows stabilize (reduces CI maintenance)
- **Smoke tests** in nightly monitoring for essential coverage

**Caching Enhancements**:
- **Multi-path caching**: Bun cache + node_modules + Playwright binaries
- **Restore keys** for fallback cache hits when lockfile changes
- **Target**: 90%+ cache hit rate for consistent <5min performance

## Critical Success Factors

### Must-Have for Solo Developer Success
1. **Aggressive Caching**: Multi-layer strategy is non-negotiable for speed
2. **GitOps Consistency**: No manual kubectl, everything through Git
3. **Security Without Complexity**: Use GitHub features + simple tools
4. **Smart Test Execution**: PR tests vs full validation to save time
5. **Automated Cleanup**: Container registry limits require automation

### Performance Reality Check
| Scenario | Expected Time | Optimization Required |
|----------|---------------|----------------------|
| **PR checks (no coverage)** | 3-5 minutes | Aggressive caching + coverage separation |
| **Post-merge (with coverage)** | 8-12 minutes | Registry cache + Chromium-only E2E |
| **First run (cold)** | 15-20 minutes | Accept this reality |
| **Cached builds** | 2-3 minutes | 90%+ cache hit rate essential |

### Warning Signs to Watch
- **CI taking >10 minutes**: Review caching strategy
- **GHCR approaching 500MB**: Auto-cleanup not working
- **Failed deployments**: GitOps sync issues or health checks
- **Security scan failures**: Dependency updates needed

---

## Strategy Summary

This optimized CI/CD strategy delivers enterprise-grade capabilities for CertQuiz while maintaining zero additional costs and solo developer efficiency through intelligent use of free tiers and existing infrastructure. 

**Key Achievements**:
- **Performance**: < 5 minute PR feedback through coverage separation and aggressive caching
- **Simplicity**: Deferred complex features (merge queue, multi-browser E2E) for maintainability
- **Quality**: TDD enforcement with smart coverage thresholds (90% services, 80% global)
- **Cost Control**: GHCR cleanup and monitoring to stay within free tier limits

**Implementation Philosophy**:
- **Phase A Priority**: Fast feedback and essential quality gates
- **Phase B Deferral**: Advanced features implemented after core stability
- **Solo Developer Focus**: Minimize maintenance overhead while preserving quality

The implementation balances immediate developer productivity with long-term scalability, ensuring sustainable operations for a single maintainer.
