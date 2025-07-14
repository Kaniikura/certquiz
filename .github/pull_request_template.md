# Pull Request

> 🎯 **Please use the appropriate PR template for your changes:**

## 🔄 Select Your PR Type

### Backend Changes (API, Database, Services)
→ [Create Backend PR](https://github.com/[OWNER]/[REPO]/compare?template=backend.md)

**Use this for:**
- API endpoint changes
- Database schema updates  
- Business logic modifications
- Authentication/authorization updates
- Backend performance optimizations

### Frontend Changes (UI, Components, Styling)
→ [Create Frontend PR](https://github.com/[OWNER]/[REPO]/compare?template=frontend.md)

**Use this for:**
- UI/UX improvements
- New components or pages
- Styling updates
- Accessibility enhancements
- Frontend performance optimizations

### Other Changes (Docs, Config, CI/CD)
→ [Create Other PR](https://github.com/[OWNER]/[REPO]/compare?template=other.md)

**Use this for:**
- Documentation updates
- Configuration changes
- CI/CD pipeline modifications
- Dependency updates
- Project structure changes

---

## 📝 Quick PR (if templates not loading)

If the template links aren't working, please copy the relevant sections below:

### Description
<!-- Brief description of your changes -->

### Related Issue
Closes #

### Type of Change
- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 📝 Documentation
- [ ] ♻️ Refactoring
- [ ] 🧪 Tests
- [ ] 🔧 Configuration

### Checklist
- [ ] **TDD followed**: Tests written BEFORE implementation
- [ ] **Type safety**: No `any` types used
- [ ] Tests pass: `bun run test`
- [ ] Type check passes: `bun run typecheck`
- [ ] Code follows project standards

### Testing Evidence
```bash
bun run test --coverage
```

---

> 💡 **Tip**: You can also append `?template=backend.md`, `?template=frontend.md`, or `?template=other.md` to your PR URL to load a specific template.