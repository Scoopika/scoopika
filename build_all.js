const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Read the list of package paths from _packages.json
const packagesFilePath = path.resolve(__dirname, '_packages.json');
const packagePaths = JSON.parse(fs.readFileSync(packagesFilePath, 'utf8'));

packagePaths.forEach(packagePath => {
  const absolutePath = path.resolve(__dirname, packagePath);
  console.log(`Building package at ${absolutePath}`);
  execSync('npm run build', { stdio: 'inherit', cwd: absolutePath });
});
