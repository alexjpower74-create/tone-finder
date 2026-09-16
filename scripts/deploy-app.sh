#!/bin/bash
# Deploy the app to tone-finder-app.alexjpower74.workers.dev. Copies app/ into deploy/dist with the production API
# base, drops the test and tooling files, and deploys deploy/app/wrangler.toml. The API Worker deploys separately:
# `cd worker && npx wrangler deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API_BASE:-https://tone-finder.alexjpower74.workers.dev}"
rm -rf deploy/dist; mkdir -p deploy/dist
cp -r app/. deploy/dist/
rm -rf deploy/dist/tests deploy/dist/tools deploy/dist/test-results deploy/dist/playwright-report deploy/dist/playwright.config.mjs deploy/dist/serve.mjs
sed -i "s#content=\"http://127.0.0.1:8302\"#content=\"$API\"#" deploy/dist/*.html
if grep -l "127.0.0.1:8302" deploy/dist/*.html; then echo "a page still points at the local API"; exit 1; fi
(cd deploy/app && npx wrangler deploy)
echo "deployed: https://tone-finder-app.alexjpower74.workers.dev"
