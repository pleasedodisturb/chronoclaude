#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pluginJson = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (pluginJson.version !== packageJson.version) {
  process.stderr.write(
    `Version mismatch: plugin.json=${pluginJson.version} vs package.json=${packageJson.version}\n` +
    `Update both to the same version before releasing.\n`
  );
  process.exit(1);
}

process.stdout.write(`Version OK: ${pluginJson.version}\n`);
