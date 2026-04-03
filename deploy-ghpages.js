// Deploy script for GitHub Pages
const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const { join } = require('path');

const project = 'poc_ar'; // dist folder name (mit Unterstrich)
const repoName = 'POC_AR'; // GitHub Pages Pfad (Großbuchstaben wie im Repo)
const distPath = join(__dirname, 'dist', project, 'browser');

// Clean old dist
if (existsSync(distPath)) {
  rmSync(distPath, { recursive: true, force: true });
}

// Build with correct base-href (Großbuchstaben wie im Repo)
execSync(`npx ng build --base-href=/${repoName}/ --configuration=production`, { stdio: 'inherit' });

// Deploy to gh-pages branch (browser subfolder)
execSync(`npx angular-cli-ghpages --dir=dist/${project}/browser --no-silent`, { stdio: 'inherit' });
