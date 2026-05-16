---
description: Deep Code Review
---

# Deep Code Review Workflow

## Step 1: Architectural Alignment
Analyze code structure using **@backend.md** or **@frontend.md**:
- **Backend**: Ensure logic resides in Services, not Controllers. Check Repository interfaces.
- **Frontend**: Verify component organization (`ui`, `shared`, `features`).
- **Shared**: Ensure no architectural leaks (e.g., DB types in the Frontend).

## Step 2: Premium Design & UX
Evaluate visual quality using **@design.md** and **theme_colors.md**:
- **Consistency**: Are tokens from `theme_colors.md` used correctly?
- **Aesthetics**: Check for Glassmorphism (`backdrop-blur`), soft shadows, and gradients.
- **Micro-interactions**: Verify hover states (`scale`, transitions) and Framer Motion usage.
- **Typography**: Check hierarchy and readability (line-height, tracking).

## Step 3: TypeScript & Type Safety
Analyze types using **@architect.md**:
- **Strictness**: Zero `any`. Proper use of `unknown` and Type Guards.
- **Validation**: Ensure Zod/validation is used for ALL external data.
- **Excellence**: Check for explicit return types and proper use of Utility Types (`Pick`, `Omit`).

## Step 4: Clean Code & Functional Style
Analyze readability using **@architect.md**:
- **Paradigm**: Check for functional methods (`.map`, `.reduce`) and **Immutability**.
- **Responsibility**: One function = one action. Split "and" functions.
- **Naming**: Ensure names are descriptive and follow project conventions.

## Step 5: Security & Performance
- **Security (@backend.md)**: Check for `HttpOnly/Secure` cookies, OAuth flow integrity, and Admin-only access checks.
- **Performance (@frontend.md)**: Verify `next/image` usage, memoization (`useMemo/useCallback`), and layout shifts.

---
For each issue found, provide a concise code snippet with the suggested fix.