# Brad Sales Skills

A suite of TypeScript/Bun integration tools designed to connect Odoo ERP, Brevo, and Google Calendar into a cohesive automated sales assistant. 

This repository leverages the `@quatrain` ecosystem for unified logging, API clients (both REST and XML-RPC), and interactive prompt helper utilities.

---

## Features

### 1. Atomic Vendor Clients (`skills/vendor/`)
- **Odoo CRM (`odoo-integration`)**: Search partners, update contacts, create new contacts, and manage calendar events in Odoo using a fast XML-RPC connector (`@quatrain/api-xmlrpc`).
- **Brevo Email Marketing (`brevo-integration`)**: Query, insert, and update newsletter and CRM contacts via the Brevo REST API client.
- **Google Calendar (`google-calendar`)**: Access Google Calendars using service account credentials. Supports listing, creating, and deleting events.

### 2. Composite Sync Actions (`skills/actions/`)
- **Google Calendar to Odoo Meetings Sync (`sync-meetings-to-odoo`)**: An interactive command-line orchestrator that:
  1. Pulls events from Google Calendar for a target date.
  2. Resolves attendees' emails against Odoo partners.
  3. Prompts the user interactively (using inquirer-based helpers) to create missing contacts, update incomplete names, and create Odoo calendar meetings linked to those partners.

---

## Directory Structure

```
├── .env.dist                   # Template for environment configuration
├── package.json                # Project dependencies (linked local @quatrain workspaces)
├── tsconfig.json               # Path mappings for direct Bun execution
├── service_account.json        # (Optional) Google Service Account key file
├── skills/                     # Skill Definitions & Implementations
│   ├── actions/                # Composite orchestrators
│   │   └── sync-meetings-to-odoo/
│   │       ├── SKILL.md        # LLM integration triggers for composite sync
│   │       └── scripts/
│   │           └── sync_meetings_cli.ts
│   └── vendor/                 # CLI entry points and definitions for atomic vendors
│       ├── google/
│       │   ├── SKILL.md        # LLM integration triggers for Google Calendar
│       │   ├── calendar.ts     # Google calendar client
│       │   └── cli.ts          # CLI runner
│       ├── odoo/
│       │   ├── SKILL.md        # LLM integration triggers for Odoo
│       │   └── cli.ts          # Odoo client & CLI runner
│       └── brevo/
│           ├── SKILL.md        # LLM integration triggers for Brevo
│           └── cli.ts          # Brevo client & CLI runner

```

---

## Configuration

Duplicate `.env.dist` as `.env` and fill in the credentials:

```ini
# Odoo ERP Configuration
ODOO_URL="https://your-instance.odoo.com"
ODOO_DB="your_database_name"
ODOO_USER="your_email@company.com"
ODOO_PASSWORD="your_password_or_api_key"

# Brevo API Configuration
BREVO_API_KEY="your_brevo_v3_api_key"

# Path to the Google Service Account key file (optional if placed at root as 'service_account.json')
GOOGLE_APPLICATION_CREDENTIALS="service_account.json"
```

### Google Service Account
Download your Google Cloud Service Account key file and:
1. Place it at the root of the repository as `service_account.json`, OR
2. Place it anywhere and set its absolute path in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable inside `.env`.

---

## LLM Activation

This repository is structured as a **Gemini/Custom Agent Skill Set**. To activate these skills and allow your LLM coding assistant to automatically discover, read, and run these commands, configure customization roots:

### 1. Workspace-Specific Activation (Recommended)
Create a directory named `.agents` at the root of your workspace, and create/link the skill definitions:
```bash
mkdir -p .agents/skills
ln -s ../../skills/vendor/google .agents/skills/google-calendar
ln -s ../../skills/vendor/odoo .agents/skills/odoo-integration
ln -s ../../skills/vendor/brevo .agents/skills/brevo-integration
ln -s ../../skills/actions/sync-meetings-to-odoo .agents/skills/sync-meetings-to-odoo
```

### 2. Global Activation
Alternatively, copy or link these directories into your global configuration directory (usually located at `~/.gemini/config/skills/`):
```bash
cp -r skills/vendor/* ~/.gemini/config/skills/
cp -r skills/actions/* ~/.gemini/config/skills/
```

Once linked/copied, the LLM agent will detect the frontmatter name and description in each `SKILL.md` (e.g. `google-calendar`, `odoo-integration`), matching user requests to the respective CLI tools and executing actions autonomously.

