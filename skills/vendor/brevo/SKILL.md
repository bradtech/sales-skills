---
name: brevo-integration
description: >-
  Allows querying and updating your Brevo account, and syncing/enriching contacts between Odoo and Brevo.
  Trigger when the user wants to list contacts in Brevo, create/update a contact on Brevo,
  or synchronize/enrich contact records between Odoo and Brevo.
---

# Brevo Integration & Odoo Sync Skill

## Presentation
This Skill provides a CLI tool executed via Bun to interact with Brevo via its official API v3, along with an orchestration workflow to bidirectionally sync and enrich contact details between Odoo CRM and Brevo.

## Prerequisites and Credentials
The CLI automatically loads parameters from your `.env` file at the root of the sales-skills repository:
- Expected path: `/Users/crapougnax/CODE/BRAD2026/sales-skills/.env`

Please configure your Brevo v3 API key:
```env
BREVO_API_KEY="your_brevo_api_key_v3"
```

## Quick Start / Usage

All commands must be executed using `bun run`. Always redirect JSON output to `.log/` folders via the `--output` option.

### 1. List Brevo Contacts
```bash
bun run skills/vendor/brevo/cli.ts list-contacts \
  --limit 50 \
  --output ".log/brevo_contacts.json"
```

### 2. Retrieve a Brevo Contact by Email
```bash
bun run skills/vendor/brevo/cli.ts get-contact \
  --email "contact@acme.com" \
  --output ".log/brevo_contact_details.json"
```

### 3. Create or Update a Brevo Contact
```bash
bun run skills/vendor/brevo/cli.ts create-or-update-contact \
  --email "contact@acme.com" \
  --firstname "Alice" \
  --lastname "Smith" \
  --phone "33600000000" \
  --output ".log/brevo_update_result.json"
```

---

## Bidirectional Sync & Enrichment Workflow (Odoo <-> Brevo)

When requested to synchronize or enrich contacts between Odoo and Brevo, the agent performs these steps:

### Step 1: Query and Extract Contacts
Identify target contacts (either by a specific email, email domain, or listing the latest modified records).
1. Query Odoo:
   ```bash
   bun run skills/vendor/odoo/cli.ts search-partners \
     --query "<QUERY>" \
     --limit 50 \
     --output ".log/odoo_search.json"
   ```
2. Query Brevo using `get-contact` for each target email found, or list contacts.

### Step 2: Data Comparison and Discrepancy Detection
Compare attributes across Odoo and Brevo:
- **Missing Contacts**: Exists in Odoo but not in Brevo, or vice-versa.
- **Incomplete Fields**:
  - Name: Exists on Brevo (`FIRSTNAME`, `LASTNAME`) but Odoo only has the raw email string.
  - Phone: Missing on Odoo but present on Brevo (or vice-versa).

### Step 3: Interactive Sync Proposal
Present a clean markdown table showing:
- Missing contacts on both platforms.
- Gaps in names or phone attributes.
- **Prompt the user for validation before applying any creation or enrichment.**

### Step 4: Apply Updates
- **Enrich Brevo**: Call `create-or-update-contact` with Odoo details.
- **Enrich Odoo**: Call `update-partner` or `create-contact` with Brevo details.
