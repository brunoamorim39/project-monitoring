import { cp, mkdir, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function buildForPages() {
  console.log('📦 Building Cloudflare Pages deployment structure...');

  const buildDir = join(rootDir, 'build');
  const outputDir = join(buildDir, 'cloudflare');

  try {
    // Clean output directory
    console.log('🧹 Cleaning output directory...');
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    // Copy client build to root of output (this becomes the static assets)
    console.log('📋 Copying client build...');
    const clientDir = join(buildDir, 'client');
    const clientFiles = await readdir(clientDir, { withFileTypes: true });

    for (const file of clientFiles) {
      const srcPath = join(clientDir, file.name);
      const destPath = join(outputDir, file.name);
      await cp(srcPath, destPath, { recursive: true });
    }

    // Create functions directory in output
    console.log('⚙️  Setting up Functions...');
    const functionsDir = join(outputDir, 'functions');
    await mkdir(functionsDir, { recursive: true });

    // Copy the Functions handler
    const srcFunctionsHandler = join(rootDir, 'functions', '[[path]].ts');
    const destFunctionsHandler = join(functionsDir, '[[path]].ts');
    await cp(srcFunctionsHandler, destFunctionsHandler);

    // Copy server build into functions directory so it's bundled with the function
    console.log('🚀 Copying server build...');
    const srcServerBuild = join(buildDir, 'server');
    const destServerBuild = join(functionsDir, 'server');
    await cp(srcServerBuild, destServerBuild, { recursive: true });

    // Copy _routes.json if it exists
    const routesFile = join(rootDir, 'public', '_routes.json');
    try {
      await cp(routesFile, join(outputDir, '_routes.json'));
      console.log('📋 Copied _routes.json');
    } catch (err) {
      console.log('ℹ️  No _routes.json found (optional)');
    }

    console.log('✅ Cloudflare Pages build complete!');
    console.log(`   Output: ${outputDir}`);
    console.log('   Structure:');
    console.log('   - /assets (client assets)');
    console.log('   - /functions/[[path]].ts (SSR handler)');
    console.log('   - /functions/server (server build)');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildForPages();
