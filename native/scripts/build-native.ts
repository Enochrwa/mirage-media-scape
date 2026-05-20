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
    // Run the actual napi build
    // We don't use --platform here because we'll handle the copy ourselves if it fails
    execSync('npx napi build --release', { cwd: nativeRoot, stdio: 'inherit' });
  } catch (err) {
    // If it failed with the copy error, we might still have the .so file
    console.log('NAPI build finished (might have had a copy error, checking for output)...');
  }

  const targetDir = path.join(nativeRoot, 'target');
  const releaseDirs = [
    path.join(targetDir, 'release'),
    path.join(targetDir, 'x86_64-unknown-linux-gnu', 'release')
  ];

  let foundSo = false;
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

  for (const dir of releaseDirs) {
    const soPath = path.join(dir, `${prefix}zovyra_native${extension}`);
    if (fs.existsSync(soPath)) {
      console.log(`Found built library at ${soPath}`);

      // Map platform/arch to NAPI-RS naming convention
      let triple = '';
      if (platform === 'linux') {
        triple = `linux-${arch}-gnu`; // Assuming GNU for now
      } else if (platform === 'darwin') {
        triple = `darwin-${arch}`;
      } else if (platform === 'win32') {
        triple = `win32-${arch}-msvc`;
      }

      const dest = path.join(nativeRoot, `zovyra-native.${triple}.node`);
      fs.copyFileSync(soPath, dest);
      fs.copyFileSync(soPath, path.join(nativeRoot, 'zovyra-native.node'));
      console.log(`Copied to ${dest}`);
      foundSo = true;
      break;
    }
  }

  if (!foundSo) {
    console.error('Could not find libzovyra_native.so in any expected directory.');
    process.exit(1);
  }

  console.log('Building stub...');
  execSync('npm run build:stub', { cwd: nativeRoot, stdio: 'inherit' });
  console.log('Native build complete.');
}

build();
