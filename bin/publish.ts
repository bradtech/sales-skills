import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgName = pkg.name;
const version = pkg.version;

console.log(`[PUBLISH] Preparing to publish ${pkgName}@${version}...`);

// 1. Resolve workspace:* dependencies
let changed = false;
for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
  if (pkg[depType]) {
    for (const [name, val] of Object.entries(pkg[depType])) {
      if (typeof val === 'string' && (val === 'workspace:*' || val.startsWith('workspace:'))) {
        try {
          // Query the version from the registry
          const latestVersion = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();
          pkg[depType][name] = `^${latestVersion}`;
          console.log(`[PUBLISH] Resolved workspace dependency ${name} to ^${latestVersion}`);
          changed = true;
        } catch (err: any) {
          console.warn(`[WARNING] Failed to resolve version for ${name} from npmjs, falling back to local workspace...`);
          try {
            // Find matching package.json under workspaces
            let resolvedLocal = false;
            const corePkgsDir = path.resolve(process.cwd(), '../../QUATRAIN/Core/packages');
            if (fs.existsSync(corePkgsDir)) {
              const dirs = fs.readdirSync(corePkgsDir);
              for (const dir of dirs) {
                const localPkgJsonPath = path.join(corePkgsDir, dir, 'package.json');
                if (fs.existsSync(localPkgJsonPath)) {
                  const localPkgJson = JSON.parse(fs.readFileSync(localPkgJsonPath, 'utf8'));
                  if (localPkgJson.name === name) {
                    pkg[depType][name] = `^${localPkgJson.version}`;
                    console.log(`[PUBLISH] Resolved workspace dependency ${name} from local workspace to ^${localPkgJson.version}`);
                    changed = true;
                    resolvedLocal = true;
                    break;
                  }
                }
              }
            }
            if (!resolvedLocal) {
              throw new Error(`Could not find package ${name} in local workspaces.`);
            }
          } catch (err2: any) {
            console.error(`[ERROR] Could not resolve version for ${name}: ${err2.message}`);
            process.exit(1);
          }
        }
      }
    }
  }
}

// Keep the original package.json content to restore it later
const originalPkgContent = fs.readFileSync(pkgPath, 'utf8');

let packageTgz: string | null = null;
try {
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  // Create temporary .npmignore to prevent packaging unnecessary items
  const npmIgnorePath = './.npmignore';
  const hasExistingNpmIgnore = fs.existsSync(npmIgnorePath);
  const originalNpmIgnore = hasExistingNpmIgnore ? fs.readFileSync(npmIgnorePath, 'utf8') : '';

  fs.writeFileSync(npmIgnorePath, 'node_modules\n.env\nservice_account.json\ncredentials.json\ntoken.json\n.log\n.git\n.github\n.agents\nbin/publish.ts\n', 'utf8');

  // Pack the package using npm pack
  console.log('[PUBLISH] Packaging library...');
  const packOutput = execSync('npm pack', { encoding: 'utf8' }).trim();
  const lines = packOutput.split('\n');
  packageTgz = lines[lines.length - 1].trim();
  console.log(`[PUBLISH] Package packed to ${packageTgz}`);

  // Restore the original .npmignore
  if (hasExistingNpmIgnore) {
    fs.writeFileSync(npmIgnorePath, originalNpmIgnore, 'utf8');
  } else {
    fs.unlinkSync(npmIgnorePath);
  }
} finally {
  // Always restore the original package.json (retaining workspace:* protocols)
  fs.writeFileSync(pkgPath, originalPkgContent, 'utf8');
}

if (!packageTgz || !fs.existsSync(packageTgz)) {
  console.error('[ERROR] Packed tgz file not found.');
  process.exit(1);
}

// 2. Check and Publish to npmjs.org
let existsNpmjs = false;
try {
  const out = execSync(`npm view ${pkgName}@${version} version --registry https://registry.npmjs.org/`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  if (out === version) existsNpmjs = true;
} catch (e) { /* ignores 404 */ }

if (!existsNpmjs) {
  try {
    console.log(`[PUBLISH] Publishing ${pkgName}@${version} to npmjs.org...`);
    const publishArgs = ['publish', packageTgz, '--registry', 'https://registry.npmjs.org/', '--access', 'public'];
    if (process.env.GITHUB_ACTIONS) publishArgs.push('--provenance');
    execSync(`npm ${publishArgs.join(' ')}`, { stdio: 'inherit' });
  } catch (err: any) {
    console.warn(`[WARNING] Failed to publish to npmjs.org: ${err.message}`);
  }
} else {
  console.log(`[PUBLISH] ${pkgName}@${version} already exists on npmjs.org, skipping.`);
}

// 3. Check and Publish to GitHub Packages
let existsGithub = false;
try {
  const out = execSync(`npm view ${pkgName}@${version} version --registry https://npm.pkg.github.com/`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  if (out === version) existsGithub = true;
} catch (e) { /* ignores 404 */ }

if (!existsGithub) {
  try {
    console.log(`[PUBLISH] Publishing ${pkgName}@${version} to GitHub Packages...`);
    execSync(`npm publish ${packageTgz} --registry https://npm.pkg.github.com/`, { stdio: 'inherit' });
  } catch (err: any) {
    console.warn(`[WARNING] Failed to publish to GitHub Packages: ${err.message}`);
  }
} else {
  console.log(`[PUBLISH] ${pkgName}@${version} already exists on GitHub Packages, skipping.`);
}

// Clean up packed tgz file
try {
  if (fs.existsSync(packageTgz)) {
    fs.unlinkSync(packageTgz);
    console.log(`[PUBLISH] Cleaned up local archive ${packageTgz}`);
  }
} catch (e: any) {
  console.warn(`[WARNING] Failed to delete ${packageTgz}: ${e.message}`);
}

console.log('[PUBLISH] Completed publish check.');
