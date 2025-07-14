# Backend Pull Request

## 📋 Description

<!-- Provide a brief description of the backend changes in this PR -->

### 🎯 Related Issue

<!-- Link to the issue this PR addresses -->
Closes #

### 🔍 Type of Backend Change

<!-- Check all that apply -->
- [ ] 🐛 Bug fix in API/services
- [ ] ✨ New API endpoint
- [ ] 🗄️ Database schema change
- [ ] 🔒 Authentication/authorization update
- [ ] ⚡ Performance optimization
- [ ] ♻️ Code refactoring
- [ ] 🧪 Test improvements
- [ ] 🔧 Configuration change

## 🧪 Backend Testing

### Test Coverage
- [ ] **TDD followed**: Tests were written BEFORE implementation
- [ ] Unit tests added/updated and passing
- [ ] Integration tests added/updated and passing
- [ ] Test coverage ≥ 80% for changed files
- [ ] All existing tests still pass

### Test Evidence
```bash
# Test output from apps/api
cd apps/api && bun run test --coverage

# Coverage report:
# File             | % Stmts | % Branch | % Funcs | % Lines |
# -----------------|---------|----------|---------|---------|
# 
```

## ✅ Backend Checklist

### 🚨 Mandatory Requirements
- [ ] **Schema-first**: TypeSpec schemas updated BEFORE implementation (if API changes)
- [ ] **Database schema**: Drizzle schema updated BEFORE queries (if DB changes)
- [ ] **Type safety**: No `any` types, explicit return types on all functions
- [ ] **Error handling**: Uses Result types for operations that can fail
- [ ] **Validation**: All inputs validated with Zod schemas

### 📊 API Requirements
- [ ] Endpoints follow RESTful conventions
- [ ] Response format consistent with API specification
- [ ] Proper HTTP status codes used
- [ ] Error responses include appropriate error codes
- [ ] API documentation updated in TypeSpec

### 🗄️ Database Requirements (if applicable)
- [ ] Migration generated with `bun run db:generate`
- [ ] Migration includes rollback strategy
- [ ] Indexes added for queried fields
- [ ] Transactions used for multi-table operations
- [ ] No N+1 queries introduced

### ⚡ Performance
- [ ] Response time < 200ms for quiz endpoints
- [ ] Database queries optimized
- [ ] Pagination implemented for list endpoints
- [ ] Caching considered for static data

### 🔒 Security
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Drizzle parameterized queries)
- [ ] Authentication required on protected routes
- [ ] Rate limiting considered for public endpoints
- [ ] No sensitive data in logs or responses

## 🔍 Code Review Focus Areas

<!-- Highlight specific areas that need careful review -->
- [ ] Database query performance
- [ ] Transaction handling
- [ ] Error handling completeness
- [ ] Security implications
- [ ] Breaking changes to API contracts

## 🚀 Testing Instructions

### Local Testing
```bash
# 1. Start services
bun run docker:up

# 2. Run migrations
cd apps/api && bun run db:migrate

# 3. Start API server
bun run dev

# 4. Test endpoints
# Example: curl http://localhost:4000/api/questions
```

### Specific Test Cases
<!-- List specific scenarios to test -->
1. 
2. 
3. 

## 📝 API Changes

### New/Modified Endpoints
<!-- Document any API changes -->
```typescript
// Example:
// POST /api/quiz/start
// Body: { questionCount: 5, examType: "CCNP" }
// Response: { sessionId: "uuid", firstQuestion: {...} }
```

### Breaking Changes
<!-- List any breaking changes to existing APIs -->
- [ ] No breaking changes
- [ ] Breaking changes documented below:

## 🔄 Migration Notes

<!-- For database changes -->
- [ ] Migration tested on fresh database
- [ ] Migration tested on database with existing data
- [ ] Rollback procedure documented
- [ ] Data migration script provided (if needed)

## 📊 Performance Impact

<!-- Include performance metrics if relevant -->
- Query execution time:
- Memory usage impact:
- API response time:

## 💬 Additional Notes

<!-- Any additional context for reviewers -->

---

### Pre-merge Checklist for Reviewers
- [ ] TDD principles followed (tests exist and were written first)
- [ ] Schema changes reviewed (TypeSpec and database)
- [ ] Security implications considered
- [ ] Performance impact acceptable
- [ ] No Phase 2 features included (community, payments, advanced gamification)