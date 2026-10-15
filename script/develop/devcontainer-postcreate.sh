#!/bin/sh
set -eu

# claude code — native installer (standalone binary, no Node dependency)
# installs to ~/.local/bin/claude; auto-updates in the background
curl -fsSL https://claude.ai/install.sh | bash
