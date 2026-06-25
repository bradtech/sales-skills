import { CliCommand } from '@quatrain/cli';
import { Skills } from '@quatrain/skills';
import { GoogleCalendarClient } from './calendar';

async function main() {
  const program = new CliCommand();
  program
    .name('google_cli')
    .description('CLI to interact with Google APIs using Service Account');

  // Subcommand: list-events
  program
    .command('list-events')
    .description('List upcoming calendar events')
    .option('--calendar-id <id>', 'Calendar ID (email or primary)', 'primary')
    .requiredOption('--limit <number>', 'Maximum number of events to list', (val) => parseInt(val, 10))
    .option('--time-min <iso-date>', 'Start date ISO-8601 string')
    .option('--time-max <iso-date>', 'End date ISO-8601 string')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new GoogleCalendarClient();
      const result = await client.listEvents(
        options.calendarId,
        options.limit,
        options.timeMin,
        options.timeMax
      );
      await Skills.writeOutput(result, options.output);
    });

  // Subcommand: create-event
  program
    .command('create-event')
    .description('Create a new calendar event')
    .requiredOption('--summary <title>', 'Event title')
    .requiredOption('--start <datetime>', 'Event start date/time (YYYY-MM-DD HH:MM:SS)')
    .option('--duration <hours>', 'Duration of the event in hours', (val) => parseFloat(val), 1.0)
    .option('--description <text>', 'Event description')
    .option('--calendar-id <id>', 'Calendar ID (email or primary)', 'primary')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new GoogleCalendarClient();
      const result = await client.createEvent(
        options.summary,
        options.start,
        options.duration,
        options.description,
        options.calendarId
      );
      await Skills.writeOutput(result, options.output);
    });

  // Subcommand: delete-event
  program
    .command('delete-event')
    .description('Delete a calendar event by ID')
    .requiredOption('--event-id <id>', 'Event ID')
    .option('--calendar-id <id>', 'Calendar ID (email or primary)', 'primary')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new GoogleCalendarClient();
      const result = await client.deleteEvent(options.eventId, options.calendarId);
      await Skills.writeOutput(result, options.output);
    });

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  main().catch((err) => {
    Skills.error(`Unexpected process error: ${err.message}`);
    process.exit(1);
  });
}
