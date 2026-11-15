---
name: Python publishing paths
description: Different working directories for artifact development and production commands.
---

Artifact publishing commands run from the repository root, unlike the API's development command, which starts in its artifact directory. Do not copy the development command's parent-directory traversal into publishing commands.

**Why:** Publishing failed to locate the root Python project when the production build moved two directories upward.

**How to apply:** Check production paths from the repository root. Keep Python dependencies in the Replit-managed Python environment, not a separate virtual environment that the production interpreter will not use.
