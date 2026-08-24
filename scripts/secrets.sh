#!/bin/bash

# Upload GitHub Actions secrets for askvera-examples
# These are the S3 credentials needed for the release workflow to upload zips.
#
# Usage: ./scripts/secrets.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "Setting GitHub secrets for $(gh repo view --json nameWithOwner -q .nameWithOwner)..."

cat "$REPO_DIR/private/aws-s3-rw-access-key.txt" | tr -d '\n' | gh secret set AWS_S3_RW_ACCESS_KEY
cat "$REPO_DIR/private/aws-s3-rw-secret-access-key.txt" | tr -d '\n' | gh secret set AWS_S3_RW_SECRET_ACCESS_KEY

echo "Done. Secrets set:"
echo "  - AWS_S3_RW_ACCESS_KEY"
echo "  - AWS_S3_RW_SECRET_ACCESS_KEY"
