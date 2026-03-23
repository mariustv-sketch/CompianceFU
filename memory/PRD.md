# PRD – Arbeidsflyt-kontroll (Geomatikk)

## Problem Statement
Build a workflow control app inspired by Geomatikk.no branding. Users create jobs with subtasks. Subtasks have Ja/Nei checkboxes that can trigger more subtasks or complete the task. A "Ferdig" button generates a PDF report. Jobs/tasks must be configurable without programming.

## Architecture
- **Frontend:** React Native + Expo SDK 54, expo-router file-based routing
- **Backend:** FastAPI + MongoDB (Motor)
- **PDF:** expo-print (HTML to PDF) + expo-sharing
- **Config:** JSON import/export via API

## User Personas
- Field workers (Geomatikk infrastructure/utility) – execute jobs on mobile
- Project managers / admins – configure job templates

## Core Requirements (Static)
1. Dashboard: list of jobs with "Start" button
2. Session execution: Ja/Nei buttons for each task, dynamic subtask expansion
3. Both Ja AND Nei can be configured to trigger subtasks
4. "Ferdig" button: enabled when all tasks answered → generates PDF with timestamp
5. Admin panel: create/edit/delete jobs and task trees in-app
6. JSON config import/export (no programming needed)

## What's Been Implemented (Feb 2026)
- ✅ Dashboard (app/index.tsx) – jobs list, Start button, Konfigurer button
- ✅ Session execution (app/session/[id].tsx) – Ja/Nei buttons, dynamic subtask tree, Ferdig PDF button
- ✅ Admin panel (app/admin/index.tsx) – create/edit/delete jobs
- ✅ New/Edit job forms with recursive TaskTreeEditor component
- ✅ JSON config export + import (app/admin/config.tsx)
- ✅ Backend CRUD for jobs, sessions, config, seed data
- ✅ Geomatikk brand: #00407F header, Norwegian language throughout
- ✅ 2 example jobs seeded: Kabelpåvisning, Inspeksjon av rørledning
- ✅ PDF report with job name, all tasks/subtasks, Ja/Nei answers, timestamps
- ✅ **Geotagging**: GPS + reverse geocode address at job START and FERDIG (end)
- ✅ PDF lokasjonsblokk: Start/Slutt adresse + koordinater (lat/lon)
- ✅ app.json: iOS NSLocationWhenInUseUsageDescription + Android ACCESS_FINE_LOCATION

## Prioritized Backlog
### P0 (Done)
- Job execution with dynamic subtask tree
- PDF generation
- Admin panel
- JSON import/export

### P1 (Next)
- Session history: view past completed sessions per job
- Back-navigation from session without losing progress

### P2 (Future)
- User signature on PDF
- Offline mode with sync
- Photo attachment to tasks
- Multi-user support with roles

## Next Tasks
1. Add session history view on dashboard (tap job → see past runs)
2. Fix FastAPI deprecation: replace @app.on_event with lifespan context
3. Add signature/name field to PDF report
