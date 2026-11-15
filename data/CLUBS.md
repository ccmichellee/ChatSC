# Editing the USC club catalog

Edit `clubs.json` to add or update clubs. Each entry has a unique negative numeric
ID, name, one of the six broad categories, a short factual description, and an
official club page or USC directory URL. Positive IDs are reserved for SQLite
records from the original crawler.

The catalog is read whenever clubs are requested; it is combined with existing
SQLite records without deleting them. Avoid unverified schedules or membership
requirements.

Sources checked November 14, 2026:
- https://tac.usc.edu/current-students/organizations/
- https://viterbiundergrad.usc.edu/student-organizations/
- https://annenberg.usc.edu/current-students/student-organizations
- https://recsports.usc.edu/programs-and-classes/club-sports/
