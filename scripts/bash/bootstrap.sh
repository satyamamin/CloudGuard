#!/bin/bash
# bootstrap.sh — environment setup
# Usage: ./scripts/bash/bootstrap.sh

set -euo pipefail

ENV=${1:-dev}
echo "Bootstrapping environment: $ENV"

# Add setup steps here (install tools, set env vars, etc.)
