---
name: sync-meetings-to-odoo
description: >-
  Allows reading your appointments for a day (today by default),
  extracting names and emails of participants, checking if they exist in Odoo,
  and proposing to add them (if missing) or update them if their name is incomplete (e.g. just email address),
  while also creating the corresponding meeting/event in Odoo.
---

# Sync Meetings to Odoo Skill

## Overview
This orchestration skill guides the agent through an interactive process combining `google-calendar` and `odoo-integration` to keep your Odoo CRM up-to-date with your Google Workspace calendar.

## Dependencies
- **[google-calendar](file:///Users/crapougnax/CODE/BRAD2026/sales-skills/skills/google-calendar/SKILL.md)**: Used to retrieve calendar events.
- **[odoo-integration](file:///Users/crapougnax/CODE/BRAD2026/sales-skills/skills/odoo-integration/SKILL.md)**: Used to search partners, create or update partners, and schedule meetings in Odoo.

## Agent Workflow

When this skill is triggered, the agent performs the following steps:

### Step 1: Determine Date Range
The agent identifies the targeted day. By default, it is **today** (based on the current local time provided in the metadata).
- Start Date: `YYYY-MM-DDT00:00:00Z`
- End Date: `YYYY-MM-DDT23:59:59Z`

### Step 2: Retrieve Calendar Events
The agent runs the `google_calendar_cli.ts` script for the user's email address (retrieved from the `ODOO_USER` configuration or metadata):
```bash
bun run skills/vendor/google/cli.ts list-events \
  --calendar-id "<USER_EMAIL>" \
  --time-min "<DATE_START>" \
  --time-max "<DATE_END>" \
  --limit 50 \
  --output ".log/events_sync.json"
```

### Step 3: Extract and Filter Participants
The agent parses `.log/events_sync.json` for each event and extracts:
- Email addresses and display names of participants/invitees (excluding the user's own email and any internal contact with an email ending in `@brad.ag`).

### Step 4: Verify in Odoo
For each identified participant, the agent performs a search in Odoo:
```bash
bun run skills/vendor/odoo/cli.ts search-partners \
  --query "<PARTNER_EMAIL_OR_NAME>" \
  --limit 5 \
  --output ".log/search_check.json"
```
*(The agent checks if the contact exists. If the contact exists but their `name` in Odoo is identical to their email address, and a cleaner display name was available in the calendar invitation, the agent marks this contact for an update).*

**Parent Company Search (if contact is missing):**
If the contact does not exist in Odoo, the agent extracts the domain name from their email address (e.g., `infotel.com` from `collaborateur@infotel.com`).
Unless the domain is generic (e.g., `gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com`), the agent searches if a corresponding company is already registered in Odoo (by name or domain):
```bash
bun run skills/vendor/odoo/cli.ts search-partners \
  --query "<DOMAIN_OR_COMPANY_NAME>" \
  --is-company true \
  --limit 5 \
  --output ".log/company_check.json"
```
If a matching company is found in `.log/company_check.json`, the agent records its `id` to associate it with the new contact.

### Step 5: Interactive Summary and Proposal
The agent displays a clear summary:
- Meetings found for the day.
- Participants already fully registered in Odoo.
- Existing participants to update (those whose Odoo name is just their email, but a real name is available in the invite).
- Missing participants in Odoo (indicating parent company links if found).
- **The agent must ask for your validation before creating missing contacts, updating existing ones, or creating the Odoo meetings.**

### Step 6: Create and Synchronize (after validation)
For approved items, the agent performs:
1. Create missing contacts (associating `--company-id` if found):
   ```bash
   bun run skills/vendor/odoo/cli.ts create-contact \
     --name "<NAME>" \
     --email "<EMAIL>" \
     --company-id <PARENT_COMPANY_ID_IF_FOUND> \
     --output ".log/new_contact.json"
   ```
2. Update names for approved existing partners:
   ```bash
   bun run skills/vendor/odoo/cli.ts update-partner \
     --id <PARTNER_ID> \
     --name "<NAME>" \
     --output ".log/update_name_result.json"
   ```
3. Create the Odoo meeting linked to the relevant partner IDs:
   ```bash
   bun run skills/vendor/odoo/cli.ts create-meeting \
     --name "<EVENT_SUMMARY>" \
     --start "<EVENT_START_DATETIME_UTC>" \
     --partner-ids "<PARTNER_ID>" \
     --output ".log/meeting_created.json"
   ```
