---
description: Environment & Workspace Rules
---

# Workspace & Runtime Rules

## Dependency Management & Installation
- **Instructional Installation**: The AI MUST NOT run `npm install`, `npm init`, or any commands that require internet access directly. Instead, the AI must provide the exact command for the USER to execute in their terminal.
- **Node.js Environment**: Assume Node.js (Latest LTS) is globally available. Do not perform system checks for Node/npm presence.
- **Local Modules**: Only proceed with coding after the USER confirms that the requested dependencies have been installed.
- **No CDN Hacks**: Categorically forbidden to use CDN links. All libraries must be installed locally via npm.
- **Git Hygiene**: Always include a `.gitignore` file that excludes `node_modules`, `.env`, and build artifacts.

## AI Execution Boundaries
- **Code Editing**: AI is responsible for all file creation and modifications.
- **Local Execution**: AI can run local commands (e.g., `npm run dev`, `ls`, `grep`) to verify the project state or start the dev server.
- **Browser Testing**: AI can use the browser tool to validate the UI and functionality.

## Security
- **Env Variables**: Sensitive data (DB URLs, API Keys) must be stored in `.env` files, never hardcoded in the codebase.
- **Validation**: Every dependency added must be checked for relevance to avoid bloat.
