---
description: Quota & Performance Optimization Rules
---

# Quota & Performance Optimization

## Token Economy
- **Minimalist Code Generation**: NEVER rewrite an entire file if only a part of it needs to be changed. Use `replace_file_content` or `multi_replace_file_content` for surgical edits.
- **Diff-first Approach**: Provide concise summaries of changes instead of re-pasting large blocks of code in the chat.
- **Batch Generation**: Write as much complete, production-ready code as possible in a single response to save context window and requests.
- **No Placeholders**: Write complete, production-ready types and configurations so that follow-up tasks don't require redundant context or clarifications.

## Model Strategy & Cost Control
- **Tiered Usage**: 
  - **Pro Models**: Reserved ONLY for high-level architecture, complex logic review, and initial project skeleton creation.
  - **Flash Models**: Used for bulk code implementation, styling, and repetitive tasks.
- **Cost Vigilance**: If the AI detects a simple task being performed while a "Pro" model is active, it MUST stop and remind the user that switching to "Flash" is more cost-effective.

## 📈 Current 3-Step Action Plan
1.  **Step 1 (Pro)**: Analyze `.agents/` and create a detailed Implementation Plan in `.agents/plans/`.
2.  **Step 2 (Pro)**: Implement the "Foundation" (Tailwind, Redux, Shared Types, Base Layout, Reference Route/Pattern).
3.  **Step 3 (Flash)**: Bulk implementation of all pages, features, and API routes based on Step 2.