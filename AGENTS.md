# AGENTS.md

## Build/Lint/Test Commands

- `npm run build` - Build the project (if configured)
- `npm run lint` - Run linting (ESLint/Prettier)
- `npm test` - Run all tests
- `npm run test:single` - Run a single test (e.g., `npm run test -- --testNamePattern="test name"`)
- `npm run typecheck` - TypeScript type checking (if using TypeScript)
- `npm run dev` - Start development server

## Code Style Guidelines

### Imports
- Use ES6 `import/export` syntax
- Group imports: built-in modules, external dependencies, internal modules
- Use named imports over default imports when possible
- Avoid relative paths deeper than `../../`; use alias imports if configured

### Formatting
- Use 2-space indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in multiline objects/arrays
- Max line length 100 characters

### Types (TypeScript)
- Enable strict mode
- Use explicit return types for functions
- Prefer `interface` for object shapes, `type` for unions
- Avoid `any`; use `unknown` or specific types

### Naming Conventions
- `camelCase` for variables, functions, methods
- `PascalCase` for classes, interfaces, types, React components
- `UPPER_SNAKE_CASE` for constants
- `kebab-case` for file names (except `.tsx`/`.jsx` use PascalCase)

### Error Handling
- Use `try/catch` for async operations
- Throw meaningful error objects with messages
- Avoid swallowing errors; log or rethrow appropriately

### Testing
- Follow red-green-refactor TDD cycle
- Write failing test first, then implementation
- Run full test suite after each task
- Ensure 100% test pass before marking tasks complete

### Documentation
- Follow CommonMark specification for all `.md` files
- No time estimates in documentation
- Use Mermaid diagrams for visual documentation

## BMM-Specific
- Execute workflows via `*workflow-init` and other BMM commands
- Load story file as single source of truth
- Update Dev Agent Record with implementation details

## Notes
- No existing Cursor or Copilot rules found
- Project uses BMM for AI-driven development; follow agent personas