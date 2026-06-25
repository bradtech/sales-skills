const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

console.log('[PREPARE] Resolving workspace dependencies for CI install...');

// Remove workspaces since they don't exist in CI
delete pkg.workspaces;

let changed = false;
for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
  if (pkg[depType]) {
    for (const [name, val] of Object.entries(pkg[depType])) {
      if (typeof val === 'string' && (val === 'workspace:*' || val.startsWith('workspace:'))) {
        try {
          // Query the version from the registry
          console.log(`[PREPARE] Querying registry version for ${name}...`);
          const latestVersion = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();
          pkg[depType][name] = `^${latestVersion}`;
          console.log(`[PREPARE] Resolved ${name} dependency to ^${latestVersion}`);
          changed = true;
        } catch (err) {
          console.warn(`[WARNING] Failed to resolve version for ${name} from registry: ${err.message}`);
          
          // Try local workspace fallback if present
          let resolvedLocal = false;
          const corePkgsDir = path.resolve(process.cwd(), '../../QUATRAIN/Core/packages');
          if (fs.existsSync(corePkgsDir)) {
            try {
              const dirs = fs.readdirSync(corePkgsDir);
              for (const dir of dirs) {
                const localPkgJsonPath = path.join(corePkgsDir, dir, 'package.json');
                if (fs.existsSync(localPkgJsonPath)) {
                  const localPkgJson = JSON.parse(fs.readFileSync(localPkgJsonPath, 'utf8'));
                  if (localPkgJson.name === name) {
                    pkg[depType][name] = `^${localPkgJson.version}`;
                    console.log(`[PREPARE] Resolved ${name} from local workspace to ^${localPkgJson.version}`);
                    changed = true;
                    resolvedLocal = true;
                    break;
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          }
          
          if (!resolvedLocal) {
            // Fallback to '*' if it is not published yet and local workspace not found
            pkg[depType][name] = '*';
            console.log(`[PREPARE] Fallback resolved ${name} dependency to *`);
            changed = true;
          }
        }
      }
    }
  }
}

if (changed || pkg.hasOwnProperty('workspaces')) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('[PREPARE] package.json updated successfully.');
} else {
  console.log('[PREPARE] No changes made to package.json.');
}
