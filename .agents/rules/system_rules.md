# AI Interaction & Code Standards (.agents/rules)

## 📁 Project Knowledge Base
- `.agents/rules/`: Global project rules and standards (this file).
- `.agents/plans/`: Active implementation plans for current tasks.
- `.agents/summaries/`: Session summaries and architectural handovers.

## 🤖 AI Collaboration Model
- **Architect (Pro)**: Designs, creates interfaces, writes complex services, and updates `plans/`.
- **Builder (Flash)**: Implements CRUD, writes tests, and routine code based on established plans.

## 📜 Architectural Baseline
- **Backend**: Node.js / Express.js / TypeScript (Layered: Controller -> Service -> Repository).
- **Frontend**: Next.js (App Router) / React / Redux Toolkit.
- **Common Quality**: Functional style, Immutability, Strict TS, Zod validation.

## 🔄 Procedural Rules
1. Any task begins with the creation of a file in `.agents/plans/`.
2. Every session ends with the creation of a summary in `.agents/summaries/`.
3. When switching models (Pro -> Flash), the Builder is obliged to read the latest files in `rules/` and `plans/`.
