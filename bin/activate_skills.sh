#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

echo "=== Sales Skills LLM Activation & Update Script ==="

# 1. Local Workspace-Specific Customizations (.agents)
echo "Setting up local Gemini agent workspace customizations..."
mkdir -p .agents/skills

# Helper to link if target doesn't exist, or update/force symlink
link_skill() {
  local src="$1"
  local dest=".agents/skills/$2"
  echo "Linking skill '$2' -> '$src'..."
  ln -sfh "../../$src" "$dest"
}

link_skill "skills/vendor/google" "google-calendar"
link_skill "skills/vendor/odoo" "odoo-integration"
link_skill "skills/vendor/brevo" "brevo-integration"
link_skill "skills/actions/sync-meetings-to-odoo" "sync-meetings-to-odoo"

# Link AGENT.md as workspace customizations rule AGENTS.md
echo "Linking AGENT.md -> .agents/AGENTS.md..."
ln -sf "../AGENT.md" .agents/AGENTS.md

# 2. Cline & Roo Code Rule Files
echo "Setting up rules for Cline and Roo Code assistants..."
ln -sf "AGENT.md" .clinerules
ln -sf "AGENT.md" .roomodes

# 3. Global Gemini Assistant Skills (Optional)
GLOBAL_GEMINI_SKILLS_DIR="$HOME/.gemini/config/skills"
if [ -d "$HOME/.gemini/config" ]; then
  echo "Global Gemini config found. Setting up global skills..."
  mkdir -p "$GLOBAL_GEMINI_SKILLS_DIR"
  
  # Link/update skills globally
  ln -sfh "$WORKSPACE_ROOT/skills/vendor/google" "$GLOBAL_GEMINI_SKILLS_DIR/google-calendar"
  ln -sfh "$WORKSPACE_ROOT/skills/vendor/odoo" "$GLOBAL_GEMINI_SKILLS_DIR/odoo-integration"
  ln -sfh "$WORKSPACE_ROOT/skills/vendor/brevo" "$GLOBAL_GEMINI_SKILLS_DIR/brevo-integration"
  ln -sfh "$WORKSPACE_ROOT/skills/actions/sync-meetings-to-odoo" "$GLOBAL_GEMINI_SKILLS_DIR/sync-meetings-to-odoo"
  
  echo "Global skills successfully symlinked to $GLOBAL_GEMINI_SKILLS_DIR"
else
  echo "Global Gemini config path not found. Skipping global registration."
fi

echo "Success! Skills are linked, activated, and updated."
