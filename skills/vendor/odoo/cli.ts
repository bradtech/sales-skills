import { CliCommand } from '@quatrain/cli';
import { XmlRpcClient } from '@quatrain/api-xmlrpc';
import { Skills } from '@quatrain/skills';

export class OdooClient {
  private db: string;
  private username: string;
  private password: string;
  private uid!: number;
  private commonClient: XmlRpcClient;
  private objectClient: XmlRpcClient;

  constructor() {
    const urlStr = process.env.ODOO_URL;
    this.db = process.env.ODOO_DB || '';
    this.username = process.env.ODOO_USER || '';
    this.password = process.env.ODOO_PASSWORD || '';

    if (!urlStr || !this.db || !this.username || !this.password) {
      Skills.error(
        'Error: ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_PASSWORD must be defined in your .env file.'
      );
      process.exit(1);
    }

    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const port = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);

      this.commonClient = new XmlRpcClient({
        host: url.hostname,
        port,
        path: '/xmlrpc/2/common',
        secure: isHttps
      });

      this.objectClient = new XmlRpcClient({
        host: url.hostname,
        port,
        path: '/xmlrpc/2/object',
        secure: isHttps
      });
    } catch (err: any) {
      Skills.error(`Error parsing Odoo URL: ${err.message}`);
      process.exit(1);
    }
  }

  async authenticate(): Promise<void> {
    try {
      const value = await this.commonClient.methodCall(
        'authenticate',
        [this.db, this.username, this.password, {}]
      );
      if (!value) {
        throw new Error('Authentication failed. Check your Odoo credentials.');
      }
      this.uid = value;
    } catch (err: any) {
      Skills.error(`Odoo Authentication Error: ${err.message}`);
      process.exit(1);
    }
  }

  private async executeKw(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    return this.objectClient.methodCall(
      'execute_kw',
      [this.db, this.uid, this.password, model, method, args, kwargs]
    );
  }

  async findCountryId(countryNameOrCode?: string): Promise<number | null> {
    if (!countryNameOrCode) return null;
    try {
      const domain = [
        '|',
        ['name', '=ilike', countryNameOrCode],
        ['code', '=ilike', countryNameOrCode]
      ];
      const countryIds = await this.executeKw('res.country', 'search', [domain]);
      return countryIds.length > 0 ? countryIds[0] : null;
    } catch (err: any) {
      Skills.warn(`Warning searching country '${countryNameOrCode}': ${err.message}`);
      return null;
    }
  }

  async findActivityTypeId(nameQuery = 'todo'): Promise<number | null> {
    try {
      let domain = [
        '|',
        ['name', '=ilike', nameQuery],
        ['name', '=ilike', 'to do']
      ];
      let typeIds = await this.executeKw('mail.activity.type', 'search', [domain]);
      
      if (typeIds.length === 0 && nameQuery === 'todo') {
        const domainFr = [['name', 'ilike', 'faire']];
        typeIds = await this.executeKw('mail.activity.type', 'search', [domainFr]);
      }
      
      if (typeIds.length === 0) {
        typeIds = await this.executeKw('mail.activity.type', 'search', [[]]);
      }
      
      return typeIds.length > 0 ? typeIds[0] : null;
    } catch (err: any) {
      Skills.warn(`Warning searching activity type '${nameQuery}': ${err.message}`);
      return null;
    }
  }

  async findModelId(modelName: string): Promise<number | null> {
    try {
      const modelIds = await this.executeKw('ir.model', 'search', [[['model', '=', modelName]]]);
      return modelIds.length > 0 ? modelIds[0] : null;
    } catch (err: any) {
      Skills.warn(`Warning searching model '${modelName}': ${err.message}`);
      return null;
    }
  }

  async createCompany(
    name: string,
    email?: string,
    phone?: string,
    city?: string,
    country?: string,
    street?: string
  ) {
    const values: any = {
      name,
      is_company: true,
      company_type: 'company'
    };

    if (email) values.email = email;
    if (phone) values.phone = phone;
    if (city) values.city = city;
    if (street) values.street = street;

    const countryId = await this.findCountryId(country);
    if (countryId) values.country_id = countryId;

    const companyId = await this.executeKw('res.partner', 'create', [values]);
    return {
      id: companyId,
      name,
      type: 'company',
      city: city || null,
      street: street || null,
      country_id: countryId
    };
  }

  async createContact(
    name: string,
    companyId?: number,
    email?: string,
    phone?: string,
    city?: string,
    country?: string,
    functionName?: string,
    street?: string
  ) {
    const values: any = {
      name,
      is_company: false,
      company_type: 'person'
    };

    if (companyId) values.parent_id = companyId;
    if (email) values.email = email;
    if (phone) values.phone = phone;
    if (city) values.city = city;
    if (functionName) values.function = functionName;
    if (street) values.street = street;

    const countryId = await this.findCountryId(country);
    if (countryId) values.country_id = countryId;

    const contactId = await this.executeKw('res.partner', 'create', [values]);
    return {
      id: contactId,
      name,
      company_id: companyId || null,
      type: 'contact',
      city: city || null,
      street: street || null,
      country_id: countryId,
      function: functionName || null
    };
  }

  async updatePartner(partnerId: number, rawValues: any) {
    const values = { ...rawValues };
    if ('country' in values && values.country) {
      const countryId = await this.findCountryId(values.country);
      if (countryId) {
        values.country_id = countryId;
      }
      delete values.country;
    }

    // Clean up undefined or null values
    const cleanValues: any = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null) {
        cleanValues[k] = v;
      }
    }

    if (Object.keys(cleanValues).length > 0) {
      await this.executeKw('res.partner', 'write', [[partnerId], cleanValues]);
    }
    return { id: partnerId, updated_fields: Object.keys(cleanValues) };
  }

  async createOpportunity(name: string, partnerId: number, revenue = 0.0, description?: string) {
    const values: any = {
      name,
      partner_id: partnerId,
      type: 'opportunity'
    };
    if (revenue) values.planned_revenue = revenue;
    if (description) values.description = description;

    const opportunityId = await this.executeKw('crm.lead', 'create', [values]);
    return {
      id: opportunityId,
      name,
      partner_id: partnerId,
      planned_revenue: revenue
    };
  }

  async createMeeting(name: string, startDatetime: string, durationHours = 1.0, partnerIds?: number[]) {
    // Computes stop datetime to prevent Odoo timezone/validation error
    // Start datetime expected in format YYYY-MM-DD HH:MM:SS
    const startStrNorm = startDatetime.replace(' ', 'T');
    const startDt = new Date(startStrNorm);
    if (isNaN(startDt.getTime())) {
      Skills.error(`Invalid start datetime format: ${startDatetime}`);
      process.exit(1);
    }

    const endDt = new Date(startDt.getTime() + durationHours * 60 * 60 * 1000);
    
    // Format back to YYYY-MM-DD HH:MM:SS for Odoo
    const formatOdooDate = (date: Date) => {
      const pad = (num: number) => String(num).padStart(2, '0');
      const yyyy = date.getUTCFullYear();
      const mm = pad(date.getUTCMonth() + 1);
      const dd = pad(date.getUTCDate());
      const hh = pad(date.getUTCHours());
      const min = pad(date.getUTCMinutes());
      const ss = pad(date.getUTCSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    };

    const startOdoo = formatOdooDate(startDt);
    const stopOdoo = formatOdooDate(endDt);

    const values: any = {
      name,
      start: startOdoo,
      stop: stopOdoo,
      duration: durationHours
    };

    if (partnerIds && partnerIds.length > 0) {
      values.partner_ids = [[6, 0, partnerIds]];
    }

    const eventId = await this.executeKw('calendar.event', 'create', [values]);
    return {
      id: eventId,
      name,
      start: startOdoo,
      stop: stopOdoo,
      duration: durationHours,
      partner_ids: partnerIds || null
    };
  }

  async createActivity(resModel: string, resId: number, summary: string, note?: string, activityTypeName = 'todo') {
    const activityTypeId = await this.findActivityTypeId(activityTypeName);
    const resModelId = await this.findModelId(resModel);

    const values: any = {
      res_model: resModel,
      res_id: resId,
      summary
    };

    if (resModelId) values.res_model_id = resModelId;
    if (note) values.note = note;
    if (activityTypeId) values.activity_type_id = activityTypeId;

    const activityId = await this.executeKw('mail.activity', 'create', [values]);
    return {
      id: activityId,
      res_model: resModel,
      res_id: resId,
      summary,
      activity_type_id: activityTypeId
    };
  }

  async resetCrm() {
    const leadIds = await this.executeKw('crm.lead', 'search', [[]]);
    if (leadIds.length > 0) {
      await this.executeKw('crm.lead', 'unlink', [leadIds]);
    }
    return { deleted_ids: leadIds, count: leadIds.length };
  }

  async searchOpportunities(query?: string, limit = 100) {
    const domain: any[] = [['type', '=', 'opportunity']];
    if (query) {
      domain.push(['name', 'ilike', query]);
    }

    const fields = [
      'id',
      'name',
      'partner_id',
      'stage_id',
      'planned_revenue',
      'probability',
      'create_date'
    ];

    return this.executeKw('crm.lead', 'search_read', [domain], { fields, limit });
  }

  async searchPartners(query?: string, isCompany?: boolean, limit = 100) {
    const domain: any[] = [];
    if (isCompany !== undefined) {
      domain.push(['is_company', '=', isCompany]);
    }
    if (query) {
      domain.push(['name', 'ilike', query]);
    }

    const fields = [
      'id',
      'name',
      'is_company',
      'email',
      'phone',
      'city',
      'country_id'
    ];

    return this.executeKw('res.partner', 'search_read', [domain], { fields, limit });
  }
}

async function main() {
  const program = new CliCommand();
  program
    .name('odoo_cli')
    .description('Odoo ERP Integration CLI wrapper');

  // Command: create-company
  program
    .command('create-company')
    .description('Create a new company partner')
    .requiredOption('--name <name>', 'Company name')
    .option('--email <email>', 'Company email')
    .option('--phone <phone>', 'Company phone')
    .option('--city <city>', 'Company city')
    .option('--country <country>', 'Company country name or code')
    .option('--street <street>', 'Company street address')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.createCompany(
        options.name,
        options.email,
        options.phone,
        options.city,
        options.country,
        options.street
      );
      await Skills.writeOutput(result, options.output);
    });

  // Command: create-contact
  program
    .command('create-contact')
    .description('Create a new individual contact')
    .requiredOption('--name <name>', 'Contact name')
    .option('--company-id <id>', 'Parent company ID', (val) => parseInt(val, 10))
    .option('--email <email>', 'Contact email')
    .option('--phone <phone>', 'Contact phone')
    .option('--city <city>', 'Contact city')
    .option('--country <country>', 'Contact country name or code')
    .option('--street <street>', 'Contact street address')
    .option('--function <job>', 'Contact job position/function')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.createContact(
        options.name,
        options.companyId,
        options.email,
        options.phone,
        options.city,
        options.country,
        options.function,
        options.street
      );
      await Skills.writeOutput(result, options.output);
    });

  // Command: update-partner
  program
    .command('update-partner')
    .description('Update an existing partner (contact or company)')
    .requiredOption('--id <id>', 'Partner ID to update', (val) => parseInt(val, 10))
    .option('--name <name>', 'Updated name')
    .option('--email <email>', 'Updated email')
    .option('--phone <phone>', 'Updated phone')
    .option('--city <city>', 'Updated city')
    .option('--country <country>', 'Updated country')
    .option('--street <street>', 'Updated street address')
    .option('--function <job>', 'Updated job position/function')
    .option('--company-id <id>', 'Updated parent company ID', (val) => parseInt(val, 10))
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const values = {
        name: options.name,
        email: options.email,
        phone: options.phone,
        city: options.city,
        country: options.country,
        street: options.street,
        function: options.function,
        parent_id: options.companyId
      };
      const result = await client.updatePartner(options.id, values);
      await Skills.writeOutput(result, options.output);
    });

  // Command: create-opportunity
  program
    .command('create-opportunity')
    .description('Create a CRM opportunity')
    .requiredOption('--name <subject>', 'Opportunity subject/name')
    .requiredOption('--partner-id <id>', 'Partner ID linked to the opportunity', (val) => parseInt(val, 10))
    .option('--revenue <amount>', 'Estimated revenue', (val) => parseFloat(val), 0.0)
    .option('--description <notes>', 'Internal description notes')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.createOpportunity(
        options.name,
        options.partnerId,
        options.revenue,
        options.description
      );
      await Skills.writeOutput(result, options.output);
    });

  // Command: create-meeting
  program
    .command('create-meeting')
    .description('Create a calendar event / meeting')
    .requiredOption('--name <subject>', 'Meeting subject')
    .requiredOption('--start <datetime>', 'Start datetime YYYY-MM-DD HH:MM:SS')
    .option('--duration <hours>', 'Duration in hours', (val) => parseFloat(val), 1.0)
    .option('--partner-ids <ids>', 'Comma-separated partner IDs', (val) => val.split(',').map((x) => parseInt(x.trim(), 10)))
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.createMeeting(
        options.name,
        options.start,
        options.duration,
        options.partnerIds
      );
      await Skills.writeOutput(result, options.output);
    });

  // Command: create-activity
  program
    .command('create-activity')
    .description('Create a planned activity on a model')
    .requiredOption('--model <model>', 'Target model (res.partner or crm.lead)')
    .requiredOption('--res-id <id>', 'Target record ID', (val) => parseInt(val, 10))
    .requiredOption('--summary <title>', 'Activity summary')
    .option('--note <html-text>', 'HTML formatted activity note')
    .option('--type <type>', 'Activity type (todo, email, call)', 'todo')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.createActivity(
        options.model,
        options.resId,
        options.summary,
        options.note,
        options.type
      );
      await Skills.writeOutput(result, options.output);
    });

  // Command: reset-crm
  program
    .command('reset-crm')
    .description('Delete all CRM leads/opportunities')
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.resetCrm();
      await Skills.writeOutput(result, options.output);
    });

  // Command: search-opportunities
  program
    .command('search-opportunities')
    .description('Search and list CRM opportunities')
    .option('--query <text>', 'Search query matching opportunity name')
    .requiredOption('--limit <number>', 'Max results limit', (val) => parseInt(val, 10))
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.searchOpportunities(options.query, options.limit);
      await Skills.writeOutput(result, options.output);
    });

  // Command: search-partners
  program
    .command('search-partners')
    .description('Search and list partners (contacts or companies)')
    .option('--query <text>', 'Search query matching partner name')
    .option('--is-company <boolean>', 'Filter by company status (true or false)', (val) => val === 'true')
    .requiredOption('--limit <number>', 'Max results limit', (val) => parseInt(val, 10))
    .requiredOption('--output <path>', 'Output JSON file path')
    .action(async (options) => {
      const client = new OdooClient();
      await client.authenticate();
      const result = await client.searchPartners(options.query, options.isCompany, options.limit);
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
