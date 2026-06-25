import { CliCommand } from '@quatrain/cli';
import { ApiClient } from '@quatrain/api-client';
import { Skills } from '@quatrain/skills';

class BrevoClient {
  private client: ApiClient;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    if (!this.apiKey) {
      Skills.error(
        'Error: The BREVO_API_KEY environment variable must be defined.\n' +
        'Please declare it in your local `.env` file.'
      );
      process.exit(1);
    }
    
    // Instantiate ApiClient with Brevo base URL
    this.client = new ApiClient('https://api.brevo.com/v3');
  }

  private getHeaders() {
    return {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': this.apiKey
    };
  }

  async listContacts(limit = 50, offset = 0) {
    try {
      const response = await this.client.get('contacts', {
        limit,
        offset,
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err: any) {
      Skills.error(`Brevo API error (listContacts): ${err.message}`);
      process.exit(1);
    }
  }

  async getContact(email: string) {
    try {
      const encodedEmail = encodeURIComponent(email);
      const response = await this.client.get(`contacts/${encodedEmail}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err: any) {
      if (err.message.includes('404')) {
        return null;
      }
      Skills.error(`Brevo API error (getContact): ${err.message}`);
      process.exit(1);
    }
  }

  async createOrUpdateContact(
    email: string,
    firstname?: string,
    lastname?: string,
    phone?: string,
    customAttributes?: any
  ) {
    const attributes: any = {};
    if (firstname) attributes.FIRSTNAME = firstname;
    if (lastname) attributes.LASTNAME = lastname;
    if (phone) attributes.SMS = phone;
    if (customAttributes) {
      Object.assign(attributes, customAttributes);
    }

    const payload: any = {
      email,
      updateEnabled: true
    };
    if (Object.keys(attributes).length > 0) {
      payload.attributes = attributes;
    }

    try {
      await this.client.post('contacts', payload);
      return { status: 'success', email, action: 'created_or_updated' };
    } catch (err: any) {
      Skills.error(`Brevo API error (createOrUpdateContact): ${err.message}`);
      process.exit(1);
    }
  }
}

async function main() {
  const program = new CliCommand();
  program
    .name('brevo_cli')
    .description('CLI to interact with Brevo API v3');

  // Command: list-contacts
  program
    .command('list-contacts')
    .description('List Brevo contacts')
    .option('--limit <number>', 'Number of records to retrieve', (val) => parseInt(val, 10), 50)
    .option('--offset <number>', 'Pagination offset', (val) => parseInt(val, 10), 0)
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new BrevoClient();
      const result = await client.listContacts(options.limit, options.offset);
      await Skills.writeOutput(result, options.output);
    });

  // Command: get-contact
  program
    .command('get-contact')
    .description('Get contact details by email')
    .requiredOption('--email <email>', 'Contact email address')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new BrevoClient();
      let result = await client.getContact(options.email);
      if (result === null) {
        result = { error: 'contact_not_found', email: options.email };
      }
      await Skills.writeOutput(result, options.output);
    });

  // Command: create-or-update-contact
  program
    .command('create-or-update-contact')
    .description('Create or update a Brevo contact')
    .requiredOption('--email <email>', 'Contact email address')
    .option('--firstname <name>', 'Contact first name')
    .option('--lastname <name>', 'Contact last name')
    .option('--phone <sms>', 'SMS phone number attribute')
    .option('--attributes <json-string>', 'JSON string representing additional custom attributes')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new BrevoClient();
      let customAttrs = null;
      if (options.attributes) {
        try {
          customAttrs = JSON.parse(options.attributes);
        } catch (err: any) {
          Skills.error(`Error parsing attributes JSON: ${err.message}`);
          process.exit(1);
        }
      }
      const result = await client.createOrUpdateContact(
        options.email,
        options.firstname,
        options.lastname,
        options.phone,
        customAttrs
      );
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
