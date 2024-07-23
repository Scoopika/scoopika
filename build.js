const fs = require('fs');
const path = require('path');

// Get the package path from command line arguments
const packagePath = process.argv[2];
if (!packagePath) {
  console.error('Please provide the package path as an argument.');
  process.exit(1);
}

// Paths
const packageJsonPath = path.join(packagePath, 'package.json');
const distPath = path.join(packagePath, 'dist');
const distPackageJsonPath = path.join(distPath, 'package.json');
const readmePath = path.join(packagePath, 'README.md');
const distReadmePath = path.join(distPath, 'README.md');

// Ensure dist directory exists
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Copy package.json and README.md to dist
fs.copyFileSync(packageJsonPath, distPackageJsonPath);
fs.copyFileSync(readmePath, distReadmePath);

// Modify the main field in the copied package.json
const packageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, 'utf8'));
if (typeof packageJson.main === "string") packageJson.main = packageJson.main.replace("dist/", ""); // Update the path as needed
if (typeof packageJson.types === "string") packageJson.types = packageJson.types.replace("dist/", "");

fs.writeFileSync(distPackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

console.log(`Build script completed successfully for package: ${packagePath}`);

