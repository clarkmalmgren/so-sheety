# so-sheety Development Guidelines

## Commands
- Build: `yarn build` or `npm run build`
- No explicit test framework found (add Jest/Mocha if needed)
- Use `ts-node src/path/to/file.ts` for running individual files

## TypeScript Style Guide
- Target: ES2018, Module: CommonJS
- Strict type checking enabled with noImplicitAny
- Class/Interface naming: PascalCase
- Variables/Methods: camelCase
- Private methods: use TypeScript private/protected keywords
- Always define return types and parameter types

## Code Patterns
- Use named imports (no default exports)
- JSDoc style documentation for methods with @param and @return
- Thorough error handling with try/catch and descriptive messages
- Defensive programming with null/undefined checks
- Semantic, descriptive naming (avoid abbreviations)
- Class inheritance with abstract classes where appropriate

## Project Structure
- /src: Source code files
  - /docs: Document and Table functionality
  - /drive: Drive, File and Folder abstractions
  - /grid: Cell, Grid and Row management
  - /sheets: Sheet and Spreadsheet operations