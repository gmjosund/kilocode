#!/usr/bin/env bash
# test-migration-wizard.sh
#
# Launch VS Code with a fully isolated environment for testing the Kilo
# migration wizard. Both VS Code's storage (user data, extensions, SecretStorage)
# and the Kilo CLI's XDG directories are redirected to a temp tree so nothing
# touches your real config.
#
# Usage:
#   ./script/test-migration-wizard.sh [TEST_ROOT] [WORKSPACE]
#
# Defaults:
#   TEST_ROOT  = /tmp/kilo-migration-test
#   WORKSPACE  = current directory
#
# To reset and start fresh:
#   rm -rf /tmp/kilo-migration-test && ./script/test-migration-wizard.sh

set -euo pipefail

TEST_ROOT="${1:-/tmp/kilo-migration-test}"
WORKSPACE="${2:-$(pwd)}"

# ---------------------------------------------------------------------------
# Create isolated directory tree
# ---------------------------------------------------------------------------

mkdir -p \
  "$TEST_ROOT/vscode-data" \
  "$TEST_ROOT/vscode-extensions" \
  "$TEST_ROOT/xdg-config" \
  "$TEST_ROOT/xdg-data" \
  "$TEST_ROOT/xdg-state" \
  "$TEST_ROOT/xdg-cache"

echo "Test root: $TEST_ROOT"
echo "Workspace: $WORKSPACE"

# ---------------------------------------------------------------------------
# XDG overrides — redirect all Kilo CLI config/data/state/cache
#
# The extension spawns 'kilo serve' as a child process and passes through
# process.env, so these vars automatically reach the CLI backend.
# MarketplacePaths also reads XDG_CONFIG_HOME directly from the environment.
# ---------------------------------------------------------------------------

export XDG_CONFIG_HOME="$TEST_ROOT/xdg-config"
export XDG_DATA_HOME="$TEST_ROOT/xdg-data"
export XDG_STATE_HOME="$TEST_ROOT/xdg-state"
export XDG_CACHE_HOME="$TEST_ROOT/xdg-cache"

# ---------------------------------------------------------------------------
# Reduce noise / avoid network calls during testing
# ---------------------------------------------------------------------------

export KILO_DISABLE_MODELS_FETCH=1
export KILO_DISABLE_LSP_DOWNLOAD=1
export KILO_DISABLE_AUTOUPDATE=1

# ---------------------------------------------------------------------------
# VS Code globalStorageUri for the Kilo extension lands at:
#   <user-data-dir>/User/globalStorage/kilo-code.kilo-code/
#
# Seed directories here before launching to test specific migration scenarios.
# Example (legacy session):
#   mkdir -p "$TEST_ROOT/vscode-data/User/globalStorage/kilo-code.kilo-code/tasks/test-session-001"
#
# Example (legacy MCP settings):
#   mkdir -p "$TEST_ROOT/vscode-data/User/globalStorage/kilo-code.kilo-code/settings"
#   echo '{"mcpServers":{}}' > \
#     "$TEST_ROOT/vscode-data/User/globalStorage/kilo-code.kilo-code/settings/mcp_settings.json"
#
# Note: SecretStorage (legacy provider API keys) is encrypted by VS Code and
# tied to the user-data-dir. To test provider migration, install the legacy
# Kilo Code v5.x extension in this test instance first, configure a provider,
# then install the new extension — it will detect the stored secrets and show
# the wizard automatically.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Locate the VS Code executable
# ---------------------------------------------------------------------------

find_code() {
  # 1. Explicit override
  if [[ -n "${VSCODE_EXEC_PATH:-}" ]]; then
    echo "$VSCODE_EXEC_PATH"
    return
  fi
  # 2. PATH lookup
  if command -v code &>/dev/null; then
    echo "code"
    return
  fi
  # 3. macOS default install paths
  for candidate in \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
    "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  echo ""
}

CODE=$(find_code)

if [[ -z "$CODE" ]]; then
  echo "ERROR: VS Code executable not found." >&2
  echo "Set VSCODE_EXEC_PATH to the path of your 'code' binary." >&2
  exit 1
fi

echo "VS Code: $CODE"
echo ""
echo "Kilo CLI dirs:"
echo "  config : $XDG_CONFIG_HOME/kilo"
echo "  data   : $XDG_DATA_HOME/kilo"
echo "  state  : $XDG_STATE_HOME/kilo"
echo "  cache  : $XDG_CACHE_HOME/kilo"
echo ""
echo "VS Code dirs:"
echo "  user-data  : $TEST_ROOT/vscode-data"
echo "  extensions : $TEST_ROOT/vscode-extensions"
echo "  globalStorage (Kilo): $TEST_ROOT/vscode-data/User/globalStorage/kilo-code.kilo-code"
echo ""

# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------

exec "$CODE" \
  --user-data-dir "$TEST_ROOT/vscode-data" \
  --extensions-dir "$TEST_ROOT/vscode-extensions" \
  "$WORKSPACE"
