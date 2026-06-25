import { google } from 'googleapis';
import { Skills } from '@quatrain/skills';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function findServiceAccountFile(): string | null {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      return process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    Skills.warn(`Warning: GOOGLE_APPLICATION_CREDENTIALS env var is set to '${process.env.GOOGLE_APPLICATION_CREDENTIALS}', but the file does not exist.`);
  }

  const currentDir = process.cwd();
  const scriptDir = import.meta.dir;
  
  const possiblePaths = [
    join(currentDir, 'service_account.json'),
    join(scriptDir, '..', '..', 'service_account.json'), // skills/vendor/google/../../service_account.json
    join(scriptDir, '..', '..', '..', 'service_account.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

export class GoogleCalendarClient {
  private calendar: any;

  constructor() {
    const keyFile = findServiceAccountFile();
    if (!keyFile) {
      Skills.error(
        "Error: The Google Service Account key credentials file is missing.\n" +
        "Please place 'service_account.json' at the root of your repository, or specify its path " +
        "using the 'GOOGLE_APPLICATION_CREDENTIALS' environment variable."
      );
      process.exit(1);
    }

    try {
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: SCOPES,
      });
      this.calendar = google.calendar({ version: 'v3', auth });
    } catch (err: any) {
      Skills.error(`Error initializing Google Calendar API: ${err.message}`);
      process.exit(1);
    }
  }

  async listEvents(calendarId = 'primary', limit = 10, timeMin?: string, timeMax?: string) {
    try {
      const params: any = {
        calendarId,
        maxResults: limit,
        singleEvents: true,
        orderBy: 'startTime',
      };

      if (timeMin) {
        params.timeMin = timeMin;
      } else {
        params.timeMin = new Date().toISOString();
      }

      if (timeMax) {
        params.timeMax = timeMax;
      }

      const response = await this.calendar.events.list(params);
      return response.data.items || [];
    } catch (err: any) {
      Skills.error(`Google Calendar API error (listEvents): ${err.message}`);
      process.exit(1);
    }
  }

  async createEvent(
    summary: string,
    startTimeStr: string,
    durationHours = 1.0,
    description?: string,
    calendarId = 'primary'
  ) {
    try {
      const normalizedStartStr = startTimeStr.replace(' ', 'T');
      const startDt = new Date(normalizedStartStr);
      if (isNaN(startDt.getTime())) {
        throw new Error(`Invalid start date format: ${startTimeStr}`);
      }

      const endDt = new Date(startDt.getTime() + durationHours * 60 * 60 * 1000);
      const timeZone = startTimeStr.endsWith('Z') ? 'UTC' : 'Europe/Paris';

      const eventBody: any = {
        summary,
        start: {
          dateTime: startDt.toISOString(),
          timeZone,
        },
        end: {
          dateTime: endDt.toISOString(),
          timeZone,
        },
      };

      if (description) {
        eventBody.description = description;
      }

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      });

      const event = response.data;
      return {
        id: event.id,
        summary: event.summary,
        htmlLink: event.htmlLink,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
      };
    } catch (err: any) {
      Skills.error(`Google Calendar API error (createEvent): ${err.message}`);
      process.exit(1);
    }
  }

  async deleteEvent(eventId: string, calendarId = 'primary') {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
      return { id: eventId, status: 'deleted' };
    } catch (err: any) {
      Skills.error(`Google Calendar API error (deleteEvent): ${err.message}`);
      process.exit(1);
    }
  }
}
