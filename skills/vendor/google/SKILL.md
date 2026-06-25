---
name: google-calendar
description: >-
  Allows interacting with your Google Calendar to read, create, or delete events.
  Trigger when the user asks to view upcoming meetings, schedule a new meeting, or cancel an event.
---

# Google Calendar Integration Skill

## Presentation
This Skill provides a CLI tool executed via Bun to interact with Google Calendar via the official API using a Google Cloud Service Account. It allows managing business meetings, leads follow-ups, and calendar events.

## Prerequisites and Authentication
The script requires a Google Cloud Service Account key file saved at the root of the sales-skills repository:
- Expected path: `/Users/crapougnax/CODE/BRAD2026/sales-skills/service_account.json`

**Critical Configuration Steps:**
1. **Enable Google Calendar API**: Ensure the API is enabled on your GCP Console. You can activate it by visiting [Google Calendar API Console](https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview).
2. **Share Your Calendar**: Share the target calendar with the service account email (ending in `@...iam.gserviceaccount.com`) in the Google Calendar web settings, granting *"Make changes to events"* permissions.
3. **External Sharing Restrictions (Google Workspace)**: If options are grayed out, your administrator must allow external calendar management in `admin.google.com` under *Apps > Google Workspace > Calendar > Sharing Settings > External sharing options*.

## Quick Start / Usage

All commands must be executed using `bun run`. Always redirect JSON output to `.log/` folders via the `--output` option.

### 1. List Calendar Events
```bash
bun run skills/vendor/google/cli.ts list-events \
  --calendar-id "your_email@gmail.com" \
  --limit 10 \
  --output ".log/events_list.json"
```

**List events for a specific date range:**
```bash
bun run skills/vendor/google/cli.ts list-events \
  --calendar-id "your_email@gmail.com" \
  --time-min "2026-06-17T00:00:00Z" \
  --time-max "2026-06-17T23:59:59Z" \
  --limit 50 \
  --output ".log/past_events.json"
```

### 2. Create a Calendar Event
```bash
bun run skills/vendor/google/cli.ts create-event \
  --calendar-id "your_email@gmail.com" \
  --summary "Technical Review Meeting" \
  --start "2026-06-25 14:00:00" \
  --duration 1.5 \
  --description "Project architecture walkthrough" \
  --output ".log/event_created.json"
```

### 3. Delete a Calendar Event
```bash
bun run skills/vendor/google/cli.ts delete-event \
  --calendar-id "your_email@gmail.com" \
  --event-id "calendar_event_id_to_delete" \
  --output ".log/event_deleted.json"
```

## Common Issues & Gotchas
1. **Unactivated API**: If you receive a "Precondition check failed" or 403 error, verify that the Google Calendar API is activated in GCP console.
2. **Missing Permissions**: If you get a 404 or authorization error, confirm the Service Account email is added to the Google Calendar sharing list.
3. **Date/Time format**: Ensure the start date uses the format `YYYY-MM-DD HH:MM:SS`.
