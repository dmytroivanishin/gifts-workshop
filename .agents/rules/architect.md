# Global Architectural & Coding Standards

## Core Principles
- **Layered Thinking**: Regardless of the platform (Front/Back), maintain clear boundaries between UI/Controller, Logic/Service, and Data/Storage.
- **Strict Interfaces**: Every boundary between modules must be defined by a clear interface or DTO.

## Code Quality & Functional Style
- **Prefer Functional**: Use `.map()`, `.filter()`, `.reduce()` instead of `for/while` loops.
- **Immutability**: State mutation is forbidden. Use object/array spreading `[...arr]` or `const`.
- **Function Responsibility**: One function = one action. If a function has "and" in its description, split it.
- **Error Handling**: Use Result/Either patterns or consistent Try-Catch blocks at the entry level.
- **Comments**: Code must be self-documenting. Comments should explain "Why", not "What".

## TypeScript Excellence
- **Strict Typing**: Forbidden to use `any`. Use `unknown` if the type is truly dynamic.
- **Explicit Returns**: All functions and methods must have explicit return types.
- **DTOs & Interfaces**: 
  - Use `interface` for object shapes, `type` for unions/aliases.
  - Data coming from outside (API or User Input) must be validated via Zod or similar before casting to a TS type.
- **Enums vs Const Objects**: Prefer `as const` objects or String Unions over `enum` (to avoid runtime overhead).
- **Utility Types**: Use `Pick`, `Omit`, `Partial`, and `Readonly` to keep types DRY.