/**
 * Build script for @actview packages
 * 
 * Usage:
 *   node build/index.mjs           # Build all packages
 *   node build/index.mjs core      # Build specific package
 *   node build/index.mjs jsx       # Build specific package
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdir, readFile, writeFile, copyFile } from 'fs/promises';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const packagesDir = resolve(rootDir, 'packages');

/**
 * Package-specific build configurations
 */
const packageConfigs = {
  core: {
    entries: {
      index: 'index.ts',
    },
  },
  jsx: {
    entries: {
      index: 'jsx.ts',
      'jsx-runtime': 'jsx-runtime.ts',
      'jsx-dev-runtime': 'jsx-dev-runtime.ts',
    },
  },
  actview: {
    entries: {
      index: 'index.ts',
    },
  },
  router: {
    entries: {
      index: 'index.ts',
    },
  },
};

/**
 * Get all package directories
 */
async function getPackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * Read package.json for a package
 */
async function readPackageJson(packageName) {
  const pkgPath = resolve(packagesDir, packageName, 'package.json');
  if (!existsSync(pkgPath)) {
    return null;
  }
  const content = await readFile(pkgPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get all workspace package versions
 */
async function getWorkspaceVersions() {
  const packages = await getPackages();
  const versions = {};
  
  for (const pkg of packages) {
    const pkgJson = await readPackageJson(pkg);
    if (pkgJson) {
      versions[pkgJson.name] = pkgJson.version;
    }
  }
  
  return versions;
}

/**
 * Replace workspace:* with actual versions
 */
function resolveWorkspaceDeps(deps, versions) {
  if (!deps) return deps;
  
  const resolved = {};
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith('workspace:')) {
      // workspace:* -> ^x.x.x, workspace:^ -> ^x.x.x, workspace:~ -> ~x.x.x
      const actualVersion = versions[name] || '1.0.0';
      const prefix = version === 'workspace:*' ? '^' : version.replace('workspace:', '');
      resolved[name] = prefix === '*' ? `^${actualVersion}` : `${prefix}${actualVersion}`;
    } else {
      resolved[name] = version;
    }
  }
  return resolved;
}

/**
 * Generate dist/package.json for publishing
 */
async function generateDistPackageJson(packageName, config) {
  const packageDir = resolve(packagesDir, packageName);
  const pkgJson = await readPackageJson(packageName);
  const versions = await getWorkspaceVersions();
  
  if (!pkgJson) return;

  const entries = config?.entries || { index: 'index.ts' };
  const hasMultipleEntries = Object.keys(entries).length > 1;
  
  // Build exports object
  const exports = {};
  for (const [entryName] of Object.entries(entries)) {
    const exportPath = entryName === 'index' ? '.' : `./${entryName}`;
    exports[exportPath] = {
      import: {
        types: `./${entryName}.d.ts`,
        default: `./${entryName}.mjs`
      },
      require: {
        types: `./${entryName}.d.ts`,
        default: `./${entryName}.cjs`
      }
    };
  }

  // Create dist package.json
  const distPkgJson = {
    name: pkgJson.name,
    version: pkgJson.version,
    description: pkgJson.description,
    type: 'module',
    main: './index.cjs',
    module: './index.mjs',
    types: './index.d.ts',
    exports,
    keywords: pkgJson.keywords,
    author: pkgJson.author || '',
    license: pkgJson.license,
    repository: pkgJson.repository || { type: 'git', url: '' },
    homepage: pkgJson.homepage || '',
    bugs: pkgJson.bugs || { url: '' },
    // Resolve workspace dependencies
    ...(pkgJson.dependencies && { 
      dependencies: resolveWorkspaceDeps(pkgJson.dependencies, versions) 
    }),
    ...(pkgJson.peerDependencies && { 
      peerDependencies: resolveWorkspaceDeps(pkgJson.peerDependencies, versions) 
    }),
    publishConfig: {
      access: 'public'
    }
  };

  // Remove undefined values
  Object.keys(distPkgJson).forEach(key => {
    if (distPkgJson[key] === undefined) {
      delete distPkgJson[key];
    }
  });

  const distPath = resolve(packageDir, 'dist', 'package.json');
  await writeFile(distPath, JSON.stringify(distPkgJson, null, 2));
  
  console.log(`📄 Generated dist/package.json for ${pkgJson.name}`);
}

/**
 * Copy README files to dist
 */
async function copyReadmeFiles(packageName) {
  const packageDir = resolve(packagesDir, packageName);
  const distDir = resolve(packageDir, 'dist');
  
  const readmeFiles = ['README.md', 'README.zh.md'];
  
  // For actview package, copy from root directory
  const sourceDir = packageName === 'actview' ? rootDir : packageDir;
  
  for (const file of readmeFiles) {
    const srcPath = resolve(sourceDir, file);
    if (existsSync(srcPath)) {
      await copyFile(srcPath, resolve(distDir, file));
      console.log(`📋 Copied ${file} to dist${packageName === 'actview' ? ' (from root)' : ''}`);
    }
  }
}

/**
 * Build a single package
 */
async function buildPackage(packageName) {
  const packageDir = resolve(packagesDir, packageName);
  const pkgJson = await readPackageJson(packageName);
  
  if (!pkgJson) {
    console.warn(`⚠️  No package.json found for ${packageName}, skipping...`);
    return;
  }

  const config = packageConfigs[packageName] || { entries: { index: 'index.ts' } };
  const outDir = resolve(packageDir, 'dist');
  
  console.log(`\n📦 Building ${pkgJson.name}...`);
  console.log(`   Entries: ${Object.keys(config.entries).join(', ')}`);
  console.log(`   Output: ${outDir}`);

  // Determine external dependencies
  const external = [
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
  ];

  try {
    // Build each entry
    let isFirst = true;
    for (const [entryName, entryFile] of Object.entries(config.entries)) {
      const entry = resolve(packageDir, entryFile);
      
      console.log(`   📄 Building entry: ${entryName} (${entryFile})`);

      await build({
        configFile: false,
        root: packageDir,
        esbuild: {
          drop: ['console'],
        },
        build: {
          outDir,
          emptyOutDir: isFirst, // Only clear on first build
          lib: {
            entry,
            name: entryName,
            formats: ['es', 'cjs'],
            fileName: (format) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
          },
          rollupOptions: {
            external,
            output: {
              exports: 'named',
              globals: {
                jquery: '$',
              },
            },
          },
          minify: false,
          sourcemap: true,
        },
      });
      
      isFirst = false;
    }

    console.log(`✅ ${pkgJson.name} built successfully!`);
    return config;
  } catch (error) {
    console.error(`❌ Failed to build ${pkgJson.name}:`, error);
    process.exit(1);
  }
}

/**
 * Generate TypeScript declarations
 */
async function generateDts(packageName) {
  const { execSync } = await import('child_process');
  const { unlink } = await import('fs/promises');
  const packageDir = resolve(packagesDir, packageName);
  const tempTsConfig = resolve(packageDir, 'tsconfig.build.temp.json');
  
  console.log(`\n📝 Generating types for ${packageName}...`);
  
  // Create a temporary tsconfig for this specific package
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      moduleResolution: "bundler",
      declaration: true,
      declarationMap: true,
      emitDeclarationOnly: true,
      outDir: "./dist",
      rootDir: ".",
      skipLibCheck: true,
      strict: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true
    },
    include: ["./*.ts", "./*.tsx", "./types/*.ts", "./types/*.tsx"],
    exclude: ["./dist", "node_modules"]
  };

  try {
    // Write temp tsconfig
    await writeFile(tempTsConfig, JSON.stringify(tsConfig, null, 2));
    
    // Run tsc with the temp config
    execSync(`npx tsc --project ${tempTsConfig}`, {
      cwd: packageDir,
      stdio: 'inherit',
    });
    
    console.log(`✅ Types generated for ${packageName}`);
  } catch (error) {
    console.warn(`⚠️  Failed to generate types for ${packageName}, continuing...`);
  } finally {
    // Clean up temp config
    try {
      await unlink(tempTsConfig);
    } catch {}
  }
}

/**
 * Main build function
 */
async function main() {
  const args = process.argv.slice(2);
  const targetPackage = args[0];

  console.log('🚀 Actview Package Builder\n');
  console.log('='.repeat(40));

  let packages;
  
  if (targetPackage) {
    // Build specific package
    packages = [targetPackage];
  } else {
    // Build all packages
    packages = await getPackages();
  }

  console.log(`📋 Packages to build: ${packages.join(', ')}`);

  for (const pkg of packages) {
    const config = await buildPackage(pkg);
    await generateDts(pkg);
    await generateDistPackageJson(pkg, config);
    await copyReadmeFiles(pkg);
  }

  console.log('\n' + '='.repeat(40));
  console.log('🎉 All packages built successfully!');
  console.log('📦 Run `cd packages/<name>/dist && npm publish` to publish\n');
}

main().catch(console.error);
