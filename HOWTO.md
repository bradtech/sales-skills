# How-To Guide: Running Sales Skills Commands

This document contains standard recipes and commands for testing, verifying, and running the sales-skills suite. Make sure you have run `bun install` and loaded your `.env` before executing these commands.

---

## 1. Odoo ERP Integration

### Search Partners
Search Odoo contacts by query string (checks names and emails):
```bash
bun run skills/vendor/odoo/cli.ts search-partners --query "infotel" --limit 5 --output ".log/partners.json"
```

### Create Contact
Create a new partner inside Odoo:
```bash
bun run skills/vendor/odoo/cli.ts create-contact --name "John Doe" --email "john.doe@example.com" --output ".log/new_contact.json"
```

### Create Meeting
Schedule a calendar meeting inside Odoo (attendees list expects Odoo partner IDs):
```bash
bun run skills/vendor/odoo/cli.ts create-meeting --name "Introduction Call" --start "2026-06-25 14:00:00" --duration 1.5 --attendees 365940,365941 --output ".log/new_meeting.json"
```

---

## 2. Brevo Email Marketing

### List Contacts
Retrieve contacts from your Brevo mailing list:
```bash
bun run skills/vendor/brevo/cli.ts list-contacts --limit 10 --output ".log/brevo_list.json"
```

---

## 3. Google Calendar

### List Events
List upcoming calendar events for a specific user:
```bash
bun run skills/vendor/google/cli.ts list-events --calendar-id "olivier@brad.ag" --limit 5 --output ".log/google_events.json"
```

### Create Event
Schedule an event in Google Calendar:
```bash
bun run skills/vendor/google/cli.ts create-event --summary "Sync with Partner" --start "2026-06-25 15:30:00" --duration 1.0 --description "Introductory talk" --calendar-id "olivier@brad.ag" --output ".log/event_created.json"
```

### Delete Event
Delete an event by its unique Google Calendar ID:
```bash
bun run skills/vendor/google/cli.ts delete-event --event-id "_example_id" --calendar-id "olivier@brad.ag" --output ".log/event_deleted.json"
```

---

## 4. Google Calendar to Odoo CRM Sync (Composite Action)

Sync Google Calendar events for a specific date to OdooCRM, prompting for missing contact creation:
```bash
bun run skills/actions/sync-meetings-to-odoo/scripts/sync_meetings_cli.ts --calendar-id "olivier@brad.ag" --date "2026-06-25" --output ".log/sync_run.json"
```
During execution, the CLI will:
1. Load calendar events.
2. Present list of proposals.
3. Wait for `(Y/n)` keyboard confirmations to create contacts, update contacts, and insert meetings.
4. Execute confirmed operations.
5. Log a final summary of all successful creations to `.log/sync_run.json`.
