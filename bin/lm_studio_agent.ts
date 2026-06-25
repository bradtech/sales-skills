import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const MODEL_NAME = process.env.LM_STUDIO_MODEL || "qwen2.5-coder-7b-instruct"; // Default fallback model name

console.log(`=== LM Studio Local Agent Runner ===`);
console.log(`Connecting to LM Studio at: ${LM_STUDIO_URL}`);
console.log(`Using model: ${MODEL_NAME}`);

// Define tools according to OpenAI / LM Studio specification
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_odoo_partners",
      description: "Search for contacts or companies in Odoo ERP matching a query string.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (email, name, or domain)" },
          limit: { type: "integer", description: "Maximum number of partners to return", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_google_events",
      description: "List upcoming calendar events from Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Email address of the calendar owner", default: "primary" },
          limit: { type: "integer", description: "Maximum number of events to fetch", default: 10 }
        },
        required: ["calendarId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sync_meetings_to_odoo",
      description: "Sync meetings from Google Calendar to Odoo CRM interactively, confirming contacts and meetings creation.",
      parameters: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Google Calendar owner email (defaults to Odoo login)" },
          date: { type: "string", description: "Target date to sync in YYYY-MM-DD format (defaults to today)" }
        },
        required: ["calendarId"]
      }
    }
  }
];

// Helper to execute local CLI scripts and return the JSON output
async function executeTool(name: string, args: any): Promise<any> {
  const logDir = join(process.cwd(), ".log");
  await $`mkdir -p ${logDir}`;
  const outputPath = join(logDir, `lm_studio_${name}_result.json`);

  console.log(`\n[Executing Tool: ${name} with arguments:`, args, "]");

  try {
    if (name === "search_odoo_partners") {
      const limit = args.limit || 5;
      await $`bun run skills/vendor/odoo/cli.ts search-partners --query ${args.query} --limit ${limit} --output ${outputPath}`;
    } else if (name === "list_google_events") {
      const limit = args.limit || 10;
      await $`bun run skills/vendor/google/cli.ts list-events --calendar-id ${args.calendarId} --limit ${limit} --output ${outputPath}`;
    } else if (name === "sync_meetings_to_odoo") {
      const dateOption = args.date ? ["--date", args.date] : [];
      // Note: This script is interactive and uses stdin. We spawn it inheriting parent terminal I/O.
      await $`bun run skills/actions/sync-meetings-to-odoo/scripts/sync_meetings_cli.ts --calendar-id ${args.calendarId} ${dateOption} --output ${outputPath}`.inherit();
    } else {
      throw new Error(`Unknown tool name: ${name}`);
    }

    if (existsSync(outputPath)) {
      const content = readFileSync(outputPath, "utf8");
      return JSON.parse(content);
    }
    return { status: "success", info: "Command ran successfully, but no output JSON was produced." };
  } catch (err: any) {
    console.error(`Tool execution failed: ${err.message}`);
    return { error: err.message };
  }
}

// Simple agent loop
async function runAgent(prompt: string) {
  const messages: any[] = [
    {
      role: "system",
      content: "You are a helpful sales assistant with access to Odoo CRM, Google Calendar, and Brevo tools. Run actions whenever requested."
    },
    { role: "user", content: prompt }
  ];

  let loop = true;
  while (loop) {
    try {
      const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages,
          tools: TOOLS,
          tool_choice: "auto"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      const message = choice?.message;

      if (!message) {
        console.log("No response message received.");
        break;
      }

      // Add assistant response to history
      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const resultPayload = await executeTool(functionName, functionArgs);

          // Add tool result to history
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(resultPayload)
          });
        }
      } else {
        // Model returned final text answer
        console.log(`\n[Assistant Response]:\n${message.content}`);
        loop = false;
      }
    } catch (err: any) {
      console.error(`Agent loop error: ${err.message}`);
      break;
    }
  }
}

// Run using prompt argument or exit
const userPrompt = process.argv.slice(2).join(" ");
if (!userPrompt) {
  console.log("Usage: bun run bin/lm_studio_agent.ts <your prompt here>");
  console.log("Example: bun run bin/lm_studio_agent.ts 'Search Odoo for contacts at infotel'");
  process.exit(1);
}

runAgent(userPrompt).catch((err) => {
  console.error("Agent execution failed:", err);
});
