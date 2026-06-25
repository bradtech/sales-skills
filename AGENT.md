# LLM Agent Instructions: Sales Skills Guidelines

This repository follows the core guidelines and styling conventions of the crapougnax ecosystem.

---

## 🧭 Base Guidelines & Personal Rules

For base development principles, coding standards, and project rules, all agent actions must comply with the rules defined in:
👉 **[Gist: Personal Gemini Rules & Instructions](https://gist.github.com/crapougnax/47971b85aa73dd702f4372a89858111c)**

---

## 🛠 How to Add a New Vendor Skill

Vendor skills represent atomic wrappers around third-party APIs. To add a new vendor integration:

1. **Create the Vendor Directory**:
   - Location: `skills/vendor/<vendor_name>/`
2. **Implement Client and CLI Runner**:
   - Create scripts inside the vendor directory (e.g., `client.ts` for logic, `cli.ts` for Commander-based runner).
   - Use standard `@quatrain` core libraries for logging, HTTP clients, and prompt helpers:
     - `@quatrain/log` for output reporting.
     - `@quatrain/cli` for interactive prompts.
     - `@quatrain/api-client` (REST) or `@quatrain/api-xmlrpc` (XML-RPC).
3. **Prevent Subcommand Collision**:
   - Ensure the command parsing in the main CLI entrypoint (`cli.ts`) is conditionally executed:
     ```typescript
     if (import.meta.main) {
       main().catch(...)
     }
     ```
4. **Create the Skill Definition**:
   - Add `skills/vendor/<vendor_name>/SKILL.md` containing YAML frontmatter (`name` and `description`) and detailed instruction triggers.
5. **Activate the Skill**:
   - Link the directory into the agent customization workspace folder:
     ```bash
     ln -s ../../skills/vendor/<vendor_name> .agents/skills/<vendor_name>
     ```

---

## 🚀 How to Add a New Composite Action

Composite actions orchestrate workflows across multiple vendors. To add a new composite action:

1. **Create the Action Directory**:
   - Location: `skills/actions/<action_name>/`
2. **Implement the Action Orchestrator**:
   - Create scripts inside a `scripts/` subdirectory, e.g., `skills/actions/<action_name>/scripts/<action_name>_cli.ts`.
   - Import vendor client instances from `../../../vendor/` relative paths.
3. **Create the Skill Definition**:
   - Add `skills/actions/<action_name>/SKILL.md` containing YAML frontmatter (`name` and `description`) and instructions defining the workflow steps.
4. **Activate the Action**:
   - Link the directory into the agent customization workspace folder:
     ```bash
     ln -s ../../skills/actions/<action_name> .agents/skills/<action_name>
     ```
