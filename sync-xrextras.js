const { cpSync, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const sourceRoot = join(__dirname, 'node_modules', '@8thwall', 'xrextras', 'dist');
const targetRoot = join(__dirname, 'public', '8thwall');

if (!existsSync(sourceRoot)) {
  throw new Error(`XR Extras dist folder not found: ${sourceRoot}`);
}

mkdirSync(targetRoot, { recursive: true });

cpSync(join(sourceRoot, 'xrextras.js'), join(targetRoot, 'xrextras.js'));

const sourceResources = join(sourceRoot, 'resources');
if (existsSync(sourceResources)) {
  cpSync(sourceResources, join(targetRoot, 'resources'), {
    recursive: true,
    force: true,
  });
}

console.log('Synced @8thwall/xrextras assets into public/8thwall');