import { GoogleCalendarClient } from '../../../vendor/google/calendar';
import { OdooClient } from '../../../vendor/odoo/cli';
import { askConfirm, CliCommand } from '@quatrain/cli';
import { Skills } from '@quatrain/skills';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'orange.fr', 'free.fr', 'sfr.fr', 'live.com', 'wanadoo.fr'
]);

interface SyncAction {
  type: 'create_contact' | 'update_contact' | 'create_meeting';
  description: string;
  payload: any;
}

async function runSync(options: { calendarId?: string; date?: string; output: string }) {
  const odoo = new OdooClient();
  await odoo.authenticate();

  const calendarId = options.calendarId || process.env.ODOO_USER;
  if (!calendarId) {
    Skills.error("Error: --calendar-id or ODOO_USER environment variable must be specified.");
    process.exit(1);
  }

  // Parse target date
  let dateStr = options.date;
  if (!dateStr) {
    const today = new Date();
    dateStr = today.toISOString().split('T')[0];
  }

  Skills.info(`Starting sync for date: ${dateStr} using calendar: ${calendarId}`);

  const startIso = `${dateStr}T00:00:00Z`;
  const endIso = `${dateStr}T23:59:59Z`;

  const calendar = new GoogleCalendarClient();
  const events = await calendar.listEvents(calendarId, 50, startIso, endIso);

  if (events.length === 0) {
    Skills.info("No events found for this day.");
    await Skills.writeOutput({ date: dateStr, synced: 0, actions: [] }, options.output);
    return;
  }

  Skills.info(`Found ${events.length} event(s) in Google Calendar.`);

  const actions: SyncAction[] = [];
  const processedEmails = new Set<string>();

  // Map to store resolved Odoo Partner IDs (either existing or new) for the current run
  const partnerEmailToIdMap = new Map<string, number>();

  for (const event of events) {
    const eventSummary = event.summary || 'Meeting without title';
    const eventStart = event.start?.dateTime || event.start?.date;
    if (!eventStart) continue;

    // Convert event start to Odoo format (YYYY-MM-DD HH:MM:SS)
    const eventStartDate = new Date(eventStart);
    const pad = (num: number) => String(num).padStart(2, '0');
    const odooStartStr = `${eventStartDate.getUTCFullYear()}-${pad(eventStartDate.getUTCMonth() + 1)}-${pad(eventStartDate.getUTCDate())} ${pad(eventStartDate.getUTCHours())}:${pad(eventStartDate.getUTCMinutes())}:${pad(eventStartDate.getUTCSeconds())}`;

    Skills.info(`Processing event: "${eventSummary}" at ${odooStartStr}`);

    const attendees = event.attendees || [];
    const eventPartnerIds: number[] = [];

    for (const attendee of attendees) {
      const email = attendee.email;
      if (!email) continue;

      // Exclude self and internal domain
      if (email === calendarId || email.endsWith('@brad.ag')) {
        continue;
      }

      const displayName = attendee.displayName || email;

      // Check if we already processed this contact in this session
      if (processedEmails.has(email)) {
        const id = partnerEmailToIdMap.get(email);
        if (id) eventPartnerIds.push(id);
        continue;
      }
      processedEmails.add(email);

      // Search in Odoo
      const searchResults = await odoo.searchPartners(email, undefined, 5);
      const existing = searchResults.find((p: any) => p.email === email);

      if (existing) {
        partnerEmailToIdMap.set(email, existing.id);
        eventPartnerIds.push(existing.id);

        // Check if name is incomplete (e.g. name is same as email, but displayName has a real name)
        if (existing.name === email && displayName !== email) {
          actions.push({
            type: 'update_contact',
            description: `Update contact name from "${existing.name}" to "${displayName}" (ID: ${existing.id})`,
            payload: { partnerId: existing.id, name: displayName, email }
          });
        }
      } else {
        // Find company id
        let companyId: number | undefined = undefined;
        const parts = email.split('@');
        const domain = parts[1]?.toLowerCase();

        if (domain && !GENERIC_DOMAINS.has(domain)) {
          const companyResults = await odoo.searchPartners(domain, true, 5);
          if (companyResults.length > 0) {
            companyId = companyResults[0].id;
            Skills.info(`Suggested parent company for ${email}: "${companyResults[0].name}" (ID: ${companyId})`);
          }
        }

        actions.push({
          type: 'create_contact',
          description: `Create contact "${displayName}" (${email})${companyId ? ` linked to Company ID ${companyId}` : ''}`,
          payload: { name: displayName, email, companyId }
        });
      }
    }

    actions.push({
      type: 'create_meeting',
      description: `Create Odoo meeting "${eventSummary}" at ${odooStartStr}`,
      payload: { name: eventSummary, start: odooStartStr, emails: attendees.map((a: any) => a.email).filter(Boolean) }
    });
  }

  Skills.info("\n--- INTERACTIVE SYNC PROPOSALS ---");
  const confirmedActions: SyncAction[] = [];

  for (const action of actions) {
    if (action.type === 'create_contact') {
      const confirm = await askConfirm(`[Contact] ${action.description}?`, true);
      if (confirm) {
        confirmedActions.push(action);
      }
    } else if (action.type === 'update_contact') {
      const confirm = await askConfirm(`[Update] ${action.description}?`, true);
      if (confirm) {
        confirmedActions.push(action);
      }
    } else if (action.type === 'create_meeting') {
      const confirm = await askConfirm(`[Meeting] ${action.description}?`, true);
      if (confirm) {
        confirmedActions.push(action);
      }
    }
  }

  Skills.info("\n--- EXECUTING SYNC ACTIONS ---");
  const results: any[] = [];

  // Execute contact creations/updates first so we have the IDs
  for (const action of confirmedActions) {
    if (action.type === 'create_contact') {
      try {
        const res = await odoo.createContact(
          action.payload.name,
          action.payload.companyId,
          action.payload.email
        );
        Skills.info(`Created contact: "${res.name}" with ID: ${res.id}`);
        partnerEmailToIdMap.set(action.payload.email, res.id);
        results.push({ action: 'create_contact', status: 'success', data: res });
      } catch (err: any) {
        Skills.error(`Failed to create contact "${action.payload.name}": ${err.message}`);
      }
    } else if (action.type === 'update_contact') {
      try {
        const res = await odoo.updatePartner(action.payload.partnerId, { name: action.payload.name });
        Skills.info(`Updated contact ID: ${action.payload.partnerId} name to: "${action.payload.name}"`);
        results.push({ action: 'update_contact', status: 'success', data: res });
      } catch (err: any) {
        Skills.error(`Failed to update contact ID ${action.payload.partnerId}: ${err.message}`);
      }
    }
  }

  // Now execute meeting creations
  for (const action of confirmedActions) {
    if (action.type === 'create_meeting') {
      try {
        // Resolve attendee IDs from emails
        const attendeeIds: number[] = [];
        for (const email of action.payload.emails) {
          const id = partnerEmailToIdMap.get(email);
          if (id) attendeeIds.push(id);
        }

        const res = await odoo.createMeeting(
          action.payload.name,
          action.payload.start,
          1.0,
          attendeeIds
        );
        Skills.info(`Created Odoo meeting: "${res.name}" (ID: ${res.id})`);
        results.push({ action: 'create_meeting', status: 'success', data: res });
      } catch (err: any) {
        Skills.error(`Failed to create meeting "${action.payload.name}": ${err.message}`);
      }
    }
  }

  await Skills.writeOutput({ date: dateStr, synced: results.length, results }, options.output);
  Skills.info(`Sync complete. Details saved to: ${options.output}`);
}

async function main() {
  const program = new CliCommand();
  program
    .name('sync_meetings_cli')
    .description('Sync meetings from Google Calendar to Odoo CRM interactively');

  program
    .option('--calendar-id <id>', 'Google Calendar ID (defaults to ODOO_USER)')
    .option('--date <yyyy-mm-dd>', 'Date to sync (defaults to today)')
    .requiredOption('--output <path>', 'JSON file output path')
    .action(async (options) => {
      await runSync(options);
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  Skills.error(`Sync tool failed: ${err.message}`);
  process.exit(1);
});
