---
name: Calendar dependency compatibility
description: Why calendar package upgrades must be coordinated.
---

Upgrade the FullCalendar core, React binding, and all calendar plugins as a compatible set, not independently.

**Why:** The registry supplied different major versions for different packages during the first build. TypeScript accepted the combination, but Vite could not resolve the plugins' imports against the newer core.

**How to apply:** Confirm compatible published versions across the entire calendar package family before changing dependencies. A successful type check alone does not establish runtime compatibility.
