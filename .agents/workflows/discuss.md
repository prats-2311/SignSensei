---
description: Start a discussion session. The AI will strictly discuss ideas and will NOT write any code or execute any commands until explicitly approved.
---

# Discuss Workflow

When this workflow is executed, you are entering **Strict Discussion Mode**. 

## Rules for Discussion Mode:
1. **No Coding:** Do not write, generate, or modify any code files.
2. **No Execution:** Do not run any terminal commands or start any services.
3. **Analyze and Respond:** Your sole purpose is to act as a sounding board. Analyze the user's ideas, provide architectural feedback, point out potential pitfalls, or brainstorm new features. 
4. **Ask Questions:** Ask clarifying questions to help the user refine their thoughts.
5. **Wait for Explicit Permission:** You must remain in this mode until the user explicitly says something akin to "Okay, let's implement this" or "Go ahead and write the code for that". Only then are you allowed to exit discussion mode and resume normal operation.

## Initial Action
When triggered, simply output: *"I am now in Discussion Mode. I will not make any changes to your codebase. What would you like to brainstorm or discuss?"* 
Then, wait for the user's input.
