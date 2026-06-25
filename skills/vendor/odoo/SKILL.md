---
name: odoo-integration
description: >-
  Allows interacting with your Odoo ERP to create or view entities such as
  companies, individual contacts, business opportunities (leads/CRM), calendar appointments, and planned activities.
  Trigger when the user wants to add/update clients, record sales opportunities, schedule Odoo meetings, or search active records.
---

# Odoo Integration Skill

## Presentation
This Skill provides a CLI tool executed via Bun to interact with Odoo ERP via its official XML-RPC API. It enables structuring client accounts by creating companies, linking contacts to those companies, logging CRM opportunities, calendar appointments, and scheduled follow-up activities.

## Prerequisites and Credentials
The CLI automatically loads parameters from your `.env` file at the root of the sales-skills repository:
- Expected path: `/Users/crapougnax/CODE/BRAD2026/sales-skills/.env`

Please configure the following environment variables:
- `ODOO_URL`: URL of your Odoo instance (e.g. `https://your-erp.odoo.com`)
- `ODOO_DB`: Database name
- `ODOO_USER`: Connection email or login username
- `ODOO_PASSWORD`: Generated API Key from your Odoo user profile (recommended) or connection password

## Quick Start / Usage

All commands must be executed using `bun run`. Always redirect JSON output to `.log/` folders via the `--output` option.

### 1. Create a Company
```bash
bun run skills/vendor/odoo/cli.ts create-company \
  --name "Acme Corporation" \
  --email "billing@acme.com" \
  --phone "+33102030405" \
  --city "Paris" \
  --country "France" \
  --street "123 Main Street" \
  --output ".log/company_result.json"
```

### 2. Create a Contact (linked to a company)
```bash
bun run skills/vendor/odoo/cli.ts create-contact \
  --name "Alice Smith" \
  --company-id 1234 \
  --email "alice@acme.com" \
  --phone "+33600000000" \
  --function "Purchasing Manager" \
  --street "123 Main Street" \
  --output ".log/contact_result.json"
```

### 3. Update a Partner (Company or Contact)
```bash
bun run skills/vendor/odoo/cli.ts update-partner \
  --id 1234 \
  --phone "+33611223344" \
  --company-id 5678 \
  --output ".log/update_result.json"
```

### 4. Create a CRM Opportunity
```bash
bun run skills/vendor/odoo/cli.ts create-opportunity \
  --name "Enterprise ERP License Proposal" \
  --partner-id 1234 \
  --revenue 45000 \
  --description "12-month software subscription" \
  --output ".log/opp_result.json"
```

### 5. Create a Meeting (Calendar Event)
```bash
bun run skills/vendor/odoo/cli.ts create-meeting \
  --name "Project Review" \
  --start "2026-06-25 10:00:00" \
  --duration 1.0 \
  --partner-ids "1234,5678" \
  --output ".log/meeting_result.json"
```
*Note: Start date must be provided in UTC format: `YYYY-MM-DD HH:MM:SS`.*

### 6. Create a Planned Activity
```bash
bun run skills/vendor/odoo/cli.ts create-activity \
  --model "res.partner" \
  --res-id 1234 \
  --summary "Send technical quote" \
  --note "Quote detailing the scope of work" \
  --type "todo" \
  --output ".log/activity_result.json"
```

### 7. Search Partners
```bash
bun run skills/vendor/odoo/cli.ts search-partners \
  --query "Acme" \
  --is-company true \
  --limit 10 \
  --output ".log/search_partners_result.json"
```

### 8. Search CRM Opportunities
```bash
bun run skills/vendor/odoo/cli.ts search-opportunities \
  --query "ERP" \
  --limit 10 \
  --output ".log/search_opportunities_result.json"
```

## Common Issues & Guidelines
1. **API Credentials**: Ensure your `.env` file variables match your Odoo user profile API credentials.
2. **Entity Ordering**: When doing a complete ingestion:
   - Step A: Create/find the Company (to get its `id`).
   - Step B: Create/find the Contact, linking it to the Company ID.
   - Step C: Create the CRM Opportunity, linking it to the Contact or Company.
3. **Automatic Stop Time**: The `create-meeting` command automatically computes the `stop` datetime to prevent validation mismatch errors.
