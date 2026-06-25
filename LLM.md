# LLM Agent Skill Activation

Activate and update all integration skills for your local or global LLM agents with a single command:

```bash
bun run setup-skills
```

---

## What the Script Sets Up

### 1. Gemini Coding Assistant (Customization Roots)
- Links all workspace integrations under `skills/` to the local customization directory `.agents/skills/`.
- Registers rule definitions (`AGENT.md`) to `.agents/AGENTS.md`.
- Automatically links skills globally to `~/.gemini/config/skills/` if the global config directory exists.

### 2. Claude-based Assistants (Cline, Roo Code, etc.)
- Exposes workspace guidelines by linking `AGENT.md` directly to `.clinerules` and `.roomodes` at the root.
- The assistant automatically parses these files at startup to understand available commands.

### 3. Local Models via LM Studio (Agent Runner)
You can run this skill set with local models (e.g. Qwen-2.5-Coder, Llama-3) hosted via LM Studio:
1. Turn on the local server in LM Studio (defaults to `http://localhost:1234/v1`).
2. Run the agent using `local-agent`:
   ```bash
   bun run local-agent "Search Odoo for partners at infotel"
   ```
- Environment variables `LM_STUDIO_URL` and `LM_STUDIO_MODEL` can be defined in your `.env` to override the defaults.

### 4. Other Assistants (OpenAI / Custom GPTs)
- Register the TS CLI runner commands under your Custom Actions / Functions.
- Example execute command:
  ```bash
  bun run skills/actions/sync-meetings-to-odoo/scripts/sync_meetings_cli.ts --calendar-id <email> --date <date> --output <output_path>
  ```

