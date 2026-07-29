#!/bin/bash
# healthcheck.sh — verify connectivity and dependencies
# Usage: ./scripts/bash/healthcheck.sh

set -euo pipefail

echo "Checking Azure CLI..."
az account show

echo "Checking Terraform..."
terraform version

echo "All checks passed."
