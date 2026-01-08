#!/usr/bin/env node

/**
 * Script to run a specific test suite based on suits.yml configuration
 * Usage: node scripts/run-suite.js <suite-name>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('yaml');

// Get suite name from command line argument
const suiteName = process.argv[2];

if (!suiteName) {
  console.error('Error: Suite name is required');
  console.error('Usage: node scripts/run-suite.js <suite-name>');
  process.exit(1);
}

// Read suits.yml
const suitsFilePath = path.join(__dirname, '..', 'suits.yml');
if (!fs.existsSync(suitsFilePath)) {
  console.error(`Error: suits.yml not found at ${suitsFilePath}`);
  process.exit(1);
}

const suitsContent = fs.readFileSync(suitsFilePath, 'utf8');
const suitsConfig = yaml.parse(suitsContent);

// Check if suite exists
if (!suitsConfig.suites || !suitsConfig.suites[suiteName]) {
  console.error(`Error: Suite "${suiteName}" not found in suits.yml`);
  console.error('Available suites:', Object.keys(suitsConfig.suites || {}).join(', '));
  process.exit(1);
}

const suite = suitsConfig.suites[suiteName];
const testFiles = suite.testFiles || [];

if (testFiles.length === 0) {
  console.error(`Error: Suite "${suiteName}" has no test files defined`);
  process.exit(1);
}

// Build Playwright command
const testFilesArgs = testFiles.join(' ');
const command = `npx playwright test ${testFilesArgs}`;

console.log(`Running suite: ${suiteName}`);
console.log(`Description: ${suite.description || 'No description'}`);
console.log(`Test files: ${testFiles.join(', ')}`);
console.log(`Command: ${command}\n`);

// Execute the command
try {
  execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (error) {
  process.exit(error.status || 1);
}

