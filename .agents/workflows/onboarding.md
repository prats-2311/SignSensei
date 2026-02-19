---
description: Read the current project state and architecture to orient the AI.
---

# Onboarding Workflow
Use this workflow at the start of every new chat session to instantly regain context about the SignSensei project.

## Step 1: Understand the Architecture
You must understand the technical specification and the core loops before making any code changes.
1. Read the `SignSensei Live_ Technical Specification.md` file in the root directory.
2. If available, review the synthesized `architecture_overview.md` artifact (likely saved in your `brain/` directory from a past session) or deduce the "Dual-Engine" animation and "Split-Brain" state concepts from the documentation.

## Step 2: Read Current Progress
Your context window is blank, but `docs/CURRENT_PROGRESS.md` contains the exact state of the project.
1. Use `view_file` to read `docs/CURRENT_PROGRESS.md`.
2. Pay special attention to the "Immediate Next Steps" section. Do not regress to completed tasks unless specifically asked.

## Step 3: Acknowledge and Advise
Output a brief, friendly summary confirming that you have read the architecture and current progress. Present the user with the 1-2 most logical "Immediate Next Steps" from the progress document and ask them which they would like to tackle first. Do not run any compilation scripts or modify files yet.
