const { copyFileSync, existsSync, mkdirSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const manifestPath = join(__dirname, 'vendor', '8thwall-runtime', 'manifest.json');
const defaultSourceRoot = join(__dirname, 'vendor', '8thwall-runtime');
const targetRoot = join(__dirname, 'public', '8thwall');

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const sourceRoot = sourceArg ? resolve(sourceArg.slice('--source='.length)) : defaultSourceRoot;

if (!existsSync(manifestPath)) {
  throw new Error(`8th Wall runtime manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const requiredFiles = manifest.engineFiles;

mkdirSync(targetRoot, { recursive: true });

const copiedFiles = [];
for (const relativeFile of requiredFiles) {
  const sourceFile = join(sourceRoot, relativeFile);
  const targetFile = join(targetRoot, relativeFile);

  if (!existsSync(sourceFile)) {
    throw new Error(`Required 8th Wall engine file missing: ${sourceFile}`);
  }

  copyFileSync(sourceFile, targetFile);
  copiedFiles.push(relativeFile);
}

console.log(`Synced 8th Wall engine files from ${sourceRoot}`);
for (const copiedFile of copiedFiles) {
  console.log(`- ${copiedFile}`);
}