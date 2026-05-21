import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nativeRoot = path.resolve(__dirname, '..');

function build() {
  console.log('Building native addon...');

  try {
    // Run cargo build directly for release
    console.log('Running: cargo build --release');
    execSync('cargo build --release', { cwd: nativeRoot, stdio: 'inherit' });
  } catch (err) {
    console.error('Cargo build failed!');
    process.exit(1);
  }

  const platform = process.platform;
  const arch = process.arch;

  let extension = '.so';
  let prefix = 'lib';
  if (platform === 'win32') {
    extension = '.dll';
    prefix = '';
  } else if (platform === 'darwin') {
    extension = '.dylib';
    prefix = 'lib';
  }

  // Check if a target-specific directory exists (e.g., x86_64-apple-darwin)
  const genericReleaseDir = path.join(nativeRoot, 'target', 'release');
  let targetSpecificDir = '';
  try {
    const targetEntries = fs.readdirSync(path.join(nativeRoot, 'target'));
    targetSpecificDir = targetEntries.find(f => f.match(/^[a-z0-9_-]+-apple-darwin$/i)) || '';
  } catch {
    // ignore
  }
  const targetDir = targetSpecificDir
    ? path.join(nativeRoot, 'target', targetSpecificDir, 'release')
    : genericReleaseDir;

  const libName = `${prefix}zovyra_native${extension}`;
  const primaryPath = path.join(targetDir, libName);
  const fallbackPath = path.join(targetDir, 'deps', libName);

  let libPath = '';
  if (fs.existsSync(primaryPath)) {
    libPath = primaryPath;
  } else if (fs.existsSync(fallbackPath)) {
    libPath = fallbackPath;
  }

  console.log(`Looking for library at: ${primaryPath}`);

  // List files in target/release to debug
  if (fs.existsSync(targetDir)) {
    console.log('Files in target/release:');
    const files = fs.readdirSync(targetDir);
    files.filter(f => f.includes('zovyra')).forEach(f => {
      console.log(`  - ${f}`);
    });
  } else {
    console.error(`Target directory not found: ${targetDir}`);
    process.exit(1);
  }

  if (!libPath) {
    console.error(`Library not found at expected paths: ${primaryPath} or ${fallbackPath}`);
    process.exit(1);
  }

  console.log(`Found built library at ${libPath}`);

// Map platform/arch to NAPI-RS naming convention
  let triple = '';
  if (platform === 'linux') {
    triple = `linux-${arch}-gnu`;
  } else if (platform === 'darwin') {
    // NAPI-RS uses darwin-x64 (not darwin-x86_64) for Intel Macs
    triple = `darwin-${arch}`;
  } else if (platform === 'win32') {
    triple = `win32-${arch}-msvc`;
  }

  const dest = path.join(nativeRoot, `zovyra-native.${triple}.node`);
  fs.copyFileSync(libPath, dest);
  fs.copyFileSync(libPath, path.join(nativeRoot, 'zovyra-native.node'));
  console.log(`Copied to ${dest}`);
  console.log(`Copied to zovyra-native.node`);

  console.log('Building stub...');
  execSync('npm run build:stub', { cwd: nativeRoot, stdio: 'inherit' });
  console.log('Native build complete.');
}

build();
