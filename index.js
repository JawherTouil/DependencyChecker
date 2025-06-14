#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const depcheck = require('depcheck');
const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

class DependencyChecker {
  constructor() {
    this.depcheckOptions = {
      ignorePatterns: ['dist', 'build', 'coverage', 'node_modules', '.next', '.nuxt'],
      ignoreDirs: ['dist', 'build', 'coverage', 'public', 'static'],
      ignoreMatches: ['@types/*', 'eslint-*', 'prettier', 'jest', 'babel-*'],
      parsers: {
        '*.js': depcheck.parser.es6,
        '*.jsx': depcheck.parser.jsx,
        '*.ts': depcheck.parser.typescript,
        '*.tsx': depcheck.parser.typescript,
        '*.vue': depcheck.parser.vue,
        // Add support for configuration files
        '*.config.js': depcheck.parser.es6,
        '*.config.ts': depcheck.parser.typescript
      },
      specials: [
        depcheck.special.eslint,
        depcheck.special.jest,
        depcheck.special.prettier,
        depcheck.special.babel,
        // Add support for Vite and Webpack configs
        depcheck.special.webpack,
        (file) => {
          // Custom special to parse Vite config files
          if (file.match(/vite\.config\.[jt]s$/)) {
            return depcheck.parser.es6(file);
          }
          return [];
        }
      ]
    };
    this.cwd = process.cwd();
    this.packageJsonPath = path.join(this.cwd, 'package.json');
    
    // Critical dependencies that should never be removed
    this.protectedPackages = new Set([
      'commander', 'chalk', 'depcheck', 'lodash', // This tool's dependencies
      'react', 'react-dom', 'next', 'vue', 'nuxt', // Framework core packages
      'express', 'fastify', 'koa', // Server frameworks
      'typescript', 'node', '@types/node', // Core language support
      'webpack', 'vite', 'rollup', 'parcel', // Build tools
      'jest', 'mocha', 'vitest', 'cypress', // Test frameworks
      'eslint', 'prettier', 'husky', 'lint-staged', // Code quality tools
      '@vitejs/plugin-react', '@vitejs/plugin-react-refresh', // Vite plugins
      'gsap', '@gsap/react' // Animation libraries
    ]);
  }

  async getPackageInfo() {
    try {
      const packageData = JSON.parse(await fs.readFile(this.packageJsonPath, 'utf8'));
      // Load user-defined protected packages from package.json
      const userProtected = packageData.dependencyChecker?.protectedPackages || [];
      userProtected.forEach(pkg => this.protectedPackages.add(pkg));
      return {
        name: packageData.name || 'unknown',
        version: packageData.version || '0.0.0',
        dependencies: Object.keys(packageData.dependencies || {}),
        devDependencies: Object.keys(packageData.devDependencies || {}),
        scripts: Object.keys(packageData.scripts || {}),
        engines: packageData.engines || {},
        dependencyChecker: packageData.dependencyChecker || {}
      };
    } catch (error) {
      throw new Error(`Failed to read package.json: ${error.message}`);
    }
  }

  async checkUnused() {
    try {
      const result = await depcheck(this.cwd, this.depcheckOptions);
      
      // Filter out protected packages and add safety checks
      const safeDependencies = (result.dependencies || []).filter(dep => {
        if (this.protectedPackages.has(dep)) return false;
        if (dep.startsWith('@types/') || dep.includes('eslint') || dep.includes('babel')) return false;
        return true;
      });
      
      const safeDevDependencies = (result.devDependencies || []).filter(dep => {
        if (this.protectedPackages.has(dep)) return false;
        if (dep.startsWith('@types/') || dep.includes('eslint') || dep.includes('babel')) return false;
        return true;
      });
      
      // Warn about potentially dynamic or config-based dependencies
      const potentiallyDynamic = [...safeDependencies, ...safeDevDependencies].filter(dep => {
        return dep.includes('plugin') || dep.includes('vite') || dep.includes('webpack') || dep.includes('gsap');
      });
      if (potentiallyDynamic.length > 0) {
        console.log(chalk.yellow('⚠️  Note: The following dependencies might be used dynamically or in config files:'));
        potentiallyDynamic.forEach(dep => console.log(chalk.gray(`  • ${dep}`)));
        console.log(chalk.cyan('💡 Consider adding these to "dependencyChecker.protectedPackages" in package.json to prevent removal.'));
      }

      return {
        dependencies: safeDependencies,
        devDependencies: safeDevDependencies,
        missing: result.missing || {},
        using: result.using || {},
        protected: {
          dependencies: (result.dependencies || []).filter(dep => this.protectedPackages.has(dep)),
          devDependencies: (result.devDependencies || []).filter(dep => this.protectedPackages.has(dep))
        }
      };
    } catch (error) {
      throw new Error(`Error checking unused dependencies: ${error.message}`);
    }
  }

  async checkOutdated() {
    try {
      const output = execSync('npm outdated --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const outdated = JSON.parse(output);
      // Filter out chalk to avoid reporting it as outdated
      delete outdated.chalk;
      return outdated;
    } catch (error) {
      if (error.stdout) {
        try {
          const outdated = JSON.parse(error.stdout);
          delete outdated.chalk;
          return outdated;
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  async checkVulnerabilities() {
    try {
      const output = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const audit = JSON.parse(output);
      return {
        vulnerabilities: audit.vulnerabilities || {},
        metadata: audit.metadata || {}
      };
    } catch (error) {
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          return {
            vulnerabilities: audit.vulnerabilities || {},
            metadata: audit.metadata || {}
          };
        } catch {
          return { vulnerabilities: {}, metadata: {} };
        }
      }
      return { vulnerabilities: {}, metadata: {} };
    }
  }

  async findDuplicates() {
    const lockPath = path.join(this.cwd, 'package-lock.json');
    
    try {
      await fs.access(lockPath);
    } catch {
      return { duplicates: [], lockFileExists: false };
    }

    try {
      const lockData = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      const versions = new Map();
      let totalPackages = 0;

      const scanDeps = (deps) => {
        if (!deps) return;
        
        Object.entries(deps).forEach(([name, info]) => {
          if (info.version) {
            totalPackages++;
            if (!versions.has(name)) {
              versions.set(name, new Set());
            }
            versions.get(name).add(info.version);
          }
          
          if (info.dependencies) {
            scanDeps(info.dependencies);
          }
        });
      };

      scanDeps(lockData.packages || lockData.dependencies);

      const duplicates = Array.from(versions.entries())
        .filter(([, versionSet]) => versionSet.size > 1)
        .map(([name, versionSet]) => ({
          name,
          versions: Array.from(versionSet),
          count: versionSet.size
        }));

      return { duplicates, totalPackages, lockFileExists: true };
    } catch (error) {
      throw new Error(`Failed to parse package-lock.json: ${error.message}`);
    }
  }

  async getProjectStats() {
    const packageInfo = await this.getPackageInfo();
    const unused = await this.checkUnused();
    const outdated = await this.checkOutdated();
    const vulnerabilities = await this.checkVulnerabilities();
    const duplicatesInfo = await this.findDuplicates();

    const stats = {
      project: {
        name: packageInfo.name,
        version: packageInfo.version,
        totalDeps: packageInfo.dependencies.length,
        totalDevDeps: packageInfo.devDependencies.length,
        totalScripts: packageInfo.scripts.length,
        hasEngines: Object.keys(packageInfo.engines).length > 0
      },
      unused: {
        dependencies: unused.dependencies,
        devDependencies: unused.devDependencies,
        total: unused.dependencies.length + unused.devDependencies.length
      },
      missing: {
        packages: Object.keys(unused.missing),
        total: Object.keys(unused.missing).length
      },
      outdated: {
        packages: Object.keys(outdated),
        total: Object.keys(outdated).length,
        details: outdated
      },
      vulnerabilities: {
        total: Object.keys(vulnerabilities.vulnerabilities).length,
        metadata: vulnerabilities.metadata,
        details: vulnerabilities.vulnerabilities
      },
      duplicates: {
        packages: duplicatesInfo.duplicates,
        total: duplicatesInfo.duplicates.length,
        totalPackages: duplicatesInfo.totalPackages,
        lockFileExists: duplicatesInfo.lockFileExists
      }
    };

    return stats;
  }

  async calculateHealthScore() {
    const stats = await this.getProjectStats();
    let score = 100;
    const issues = [];
    const suggestions = [];

    // Unused dependencies (max -30 points)
    if (stats.unused.total > 0) {
      const penalty = Math.min(30, stats.unused.total * 3);
      score -= penalty;
      issues.push(`${stats.unused.total} unused dependencies`);
      suggestions.push('Run "dependency-cli fix --unused" to remove unused packages');
    }

    // Outdated dependencies (max -25 points)
    if (stats.outdated.total > 0) {
      const penalty = Math.min(25, stats.outdated.total * 2);
      score -= penalty;
      issues.push(`${stats.outdated.total} outdated dependencies`);
      suggestions.push('Run "dependency-cli fix --outdated" to update packages');
    }

    // Security vulnerabilities (max -35 points)
    if (stats.vulnerabilities.total > 0) {
      const penalty = Math.min(35, stats.vulnerabilities.total * 5);
      score -= penalty;
      issues.push(`${stats.vulnerabilities.total} security vulnerabilities`);
      suggestions.push('Run "dependency-cli fix --vulnerabilities" to fix security issues');
    }

    // Duplicate packages (max -15 points)
    if (stats.duplicates.total > 0) {
      const penalty = Math.min(15, stats.duplicates.total * 2);
      score -= penalty;
      issues.push(`${stats.duplicates.total} duplicate packages`);
      suggestions.push('Run "dependency-cli fix --duplicates" to dedupe packages');
    }

    // Missing dependencies (max -20 points)
    if (stats.missing.total > 0) {
      const penalty = Math.min(20, stats.missing.total * 4);
      score -= penalty;
      issues.push(`${stats.missing.total} missing dependencies`);
      suggestions.push('Install missing dependencies manually');
    }

    return { 
      score: Math.max(0, Math.round(score)), 
      issues, 
      suggestions,
      stats 
    };
  }

  async fixIssues(options = {}) {
    const { unused, outdated, vulnerabilities, duplicates, all, force } = options;
    const results = [];

    if (all || unused) {
      console.log(chalk.yellow('🔧 Fixing unused dependencies...'));
      try {
        await this.removeUnused(force);
        results.push({ type: 'unused', success: true });
      } catch (error) {
        results.push({ type: 'unused', success: false, error: error.message });
      }
    }

    if (all || outdated) {
      console.log(chalk.yellow('📦 Updating outdated dependencies...'));
      try {
        await this.updateOutdated();
        results.push({ type: 'outdated', success: true });
      } catch (error) {
        results.push({ type: 'outdated', success: false, error: error.message });
      }
    }

    if (all || vulnerabilities) {
      console.log(chalk.yellow('🔒 Fixing security vulnerabilities...'));
      try {
        await this.fixVulnerabilities();
        results.push({ type: 'vulnerabilities', success: true });
      } catch (error) {
        results.push({ type: 'vulnerabilities', success: false, error: error.message });
      }
    }

    if (all || duplicates) {
      console.log(chalk.yellow('🔄 Deduplicating packages...'));
      try {
        await this.deduplicate();
        results.push({ type: 'duplicates', success: true });
      } catch (error) {
        results.push({ type: 'duplicates', success: false, error: error.message });
      }
    }

    return results;
  }

  async removeUnused(force = false) {
    const unused = await this.checkUnused();
    const allUnused = [...unused.dependencies, ...unused.devDependencies];
    
    if (allUnused.length === 0) {
      console.log(chalk.green('✅ No safe-to-remove unused dependencies found.'));
      
      // Show protected packages if any were detected as unused
      const protectedCount = unused.protected.dependencies.length + unused.protected.devDependencies.length;
      if (protectedCount > 0 && !force) {
        console.log(chalk.yellow(`⚠️  ${protectedCount} protected packages were detected as unused but kept for safety:`));
        [...unused.protected.dependencies, ...unused.protected.devDependencies].forEach(pkg => {
          console.log(chalk.gray(`  • ${pkg} (protected)`));
        });
        console.log(chalk.cyan('💡 Use --force flag if you really want to remove protected packages.'));
      }
      return;
    }

    console.log(chalk.yellow(`🔧 Found ${allUnused.length} safe-to-remove unused dependencies:`));
    allUnused.forEach(dep => console.log(chalk.gray(`  • ${dep}`)));

    const batchSize = 10;
    for (let i = 0; i < allUnused.length; i += batchSize) {
      const batch = allUnused.slice(i, i + batchSize);
      try {
        execSync(`npm uninstall ${batch.join(' ')}`, { stdio: 'pipe' });
      } catch (error) {
        console.log(chalk.red(`❌ Failed to remove: ${batch.join(', ')}`));
        throw error;
      }
    }
    
    console.log(chalk.green(`✅ Successfully removed ${allUnused.length} unused dependencies.`));
  }

  async updateOutdated() {
    execSync('npm update', { stdio: 'inherit' });
    console.log(chalk.green('✅ Updated outdated dependencies.'));
  }

  async fixVulnerabilities() {
    execSync('npm audit fix', { stdio: 'inherit' });
    console.log(chalk.green('✅ Fixed security vulnerabilities.'));
  }

  async deduplicate() {
    execSync('npm dedupe', { stdio: 'inherit' });
    console.log(chalk.green('✅ Deduplicated packages.'));
  }
}

// Initialize CLI
const program = new Command();
const checker = new DependencyChecker();

program
  .name('dependency-cli')
  .description('Advanced dependency management and optimization tool')
  .version('1.0.1');

program
  .command('summary')
  .description('Comprehensive project dependency analysis')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    if (options.json) {
      const stats = await checker.getProjectStats();
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('📊 Comprehensive Dependency Analysis\n'));
    
    const { stats } = await checker.calculateHealthScore();
    
    // Project Overview
    console.log(chalk.bold('🚀 Project Overview:'));
    console.log(`  Name: ${chalk.cyan(stats.project.name)} v${stats.project.version}`);
    console.log(`  Dependencies: ${chalk.yellow(stats.project.totalDeps)} production + ${chalk.yellow(stats.project.totalDevDeps)} development`);
    console.log(`  Scripts: ${chalk.yellow(stats.project.totalScripts)} npm scripts`);
    console.log(`  Node engines: ${stats.project.hasEngines ? chalk.green('✅ Specified') : chalk.gray('⚪ Not specified')}`);
    
    // Unused Dependencies
    console.log(chalk.bold('\n🔍 Unused Dependencies:'));
    if (stats.unused.total === 0) {
      console.log(chalk.green('  ✅ All dependencies are being used'));
    } else {
      console.log(chalk.red(`  ❌ ${stats.unused.total} unused packages found`));
      if (stats.unused.dependencies.length > 0) {
        console.log(chalk.gray(`    Production: ${stats.unused.dependencies.join(', ')}`));
      }
      if (stats.unused.devDependencies.length > 0) {
        console.log(chalk.gray(`    Development: ${stats.unused.devDependencies.join(', ')}`));
      }
    }

    // Missing Dependencies
    console.log(chalk.bold('\n🔗 Missing Dependencies:'));
    if (stats.missing.total === 0) {
      console.log(chalk.green('  ✅ All required dependencies are installed'));
    } else {
      console.log(chalk.red(`  ❌ ${stats.missing.total} missing dependencies`));
      console.log(chalk.gray(`    Packages: ${stats.missing.packages.join(', ')}`));
    }

    // Outdated Dependencies
    console.log(chalk.bold('\n📦 Outdated Dependencies:'));
    if (stats.outdated.total === 0) {
      console.log(chalk.green('  ✅ All packages are up to date'));
    } else {
      console.log(chalk.red(`  ❌ ${stats.outdated.total} outdated packages`));
      Object.entries(stats.outdated.details).slice(0, 5).forEach(([pkg, info]) => {
        console.log(chalk.gray(`    ${pkg}: ${info.current} → ${info.latest}`));
      });
      if (stats.outdated.total > 5) {
        console.log(chalk.gray(`    ... and ${stats.outdated.total - 5} more`));
      }
    }

    // Security Vulnerabilities
    console.log(chalk.bold('\n🔒 Security Vulnerabilities:'));
    if (stats.vulnerabilities.total === 0) {
      console.log(chalk.green('  ✅ No known security vulnerabilities'));
    } else {
      console.log(chalk.red(`  ❌ ${stats.vulnerabilities.total} vulnerabilities found`));
      if (stats.vulnerabilities.metadata.vulnerabilities) {
        const meta = stats.vulnerabilities.metadata.vulnerabilities;
        if (meta.critical) console.log(chalk.red(`    Critical: ${meta.critical}`));
        if (meta.high) console.log(chalk.red(`    High: ${meta.high}`));
        if (meta.moderate) console.log(chalk.yellow(`    Moderate: ${meta.moderate}`));
        if (meta.low) console.log(chalk.gray(`    Low: ${meta.low}`));
      }
    }

    // Duplicate Packages
    console.log(chalk.bold('\n🔄 Package Duplicates:'));
    if (!stats.duplicates.lockFileExists) {
      console.log(chalk.gray('  ⚪ No package-lock.json found'));
    } else if (stats.duplicates.total === 0) {
      console.log(chalk.green('  ✅ No duplicate package versions'));
    } else {
      console.log(chalk.red(`  ❌ ${stats.duplicates.total} packages with multiple versions`));
      console.log(chalk.gray(`  📊 Total packages in lock file: ${stats.duplicates.totalPackages}`));
      stats.duplicates.packages.slice(0, 3).forEach(({ name, versions }) => {
        console.log(chalk.gray(`    ${name}: ${versions.join(', ')}`));
      });
      if (stats.duplicates.total > 3) {
        console.log(chalk.gray(`    ... and ${stats.duplicates.total - 3} more`));
      }
    }

    // Quick Fix Suggestions
    const { suggestions } = await checker.calculateHealthScore();
    if (suggestions.length > 0) {
      console.log(chalk.bold('\n💡 Quick Fix Suggestions:'));
      suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
      console.log(chalk.cyan('\n🚀 Run "dependency-cli fix --all" to fix all issues automatically!'));
    }
  });

program
  .command('fix')
  .description('Automatically fix dependency issues')
  .option('--unused', 'Remove unused dependencies')
  .option('--outdated', 'Update outdated dependencies')
  .option('--vulnerabilities', 'Fix security vulnerabilities')
  .option('--duplicates', 'Deduplicate packages')
  .option('--all', 'Fix all issues')
  .option('--force', 'Remove protected packages (dangerous!)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    const { unused, outdated, vulnerabilities, duplicates, all, yes, force } = options;
    
    if (!unused && !outdated && !vulnerabilities && !duplicates && !all) {
      console.log(chalk.yellow('⚠️  Please specify what to fix:'));
      console.log('  --unused         Remove unused dependencies (with safety checks)');
      console.log('  --outdated       Update outdated dependencies');
      console.log('  --vulnerabilities Fix security vulnerabilities');
      console.log('  --duplicates     Deduplicate packages');
      console.log('  --all            Fix everything');
      console.log('  --force          Override safety checks (dangerous!)');
      return;
    }

    if (force) {
      console.log(chalk.red('⚠️  WARNING: --force flag will remove protected packages!'));
      console.log(chalk.red('This could break your project. Make sure you have a backup.'));
    }

    if (!yes) {
      console.log(chalk.yellow('⚠️  This will modify your package.json and node_modules.'));
      if (force) {
        console.log(chalk.red('⚠️  Force mode is enabled - protected packages may be removed!'));
      }
      console.log(chalk.cyan('Use --yes flag to skip this confirmation.'));
      console.log(chalk.red('Confirmation required - add --yes flag to proceed.'));
      return;
    }

    console.log(chalk.cyan('🔧 Starting dependency fixes...\n'));

    const results = await checker.fixIssues(options);
    
    console.log(chalk.cyan('\n📋 Fix Results:'));
    results.forEach(({ type, success, error }) => {
      if (success) {
        console.log(chalk.green(`  ✅ ${type}: Completed successfully`));
      } else {
        console.log(chalk.red(`  ❌ ${type}: ${error}`));
      }
    });

    console.log(chalk.cyan('\n🎉 Fixes completed!'));
    console.log(chalk.gray('💡 Run "dependency-cli summary" to see updated status.'));
  });

// Keep the existing individual commands but make them simpler
program
  .command('unused')
  .description('Check for unused dependencies')
  .action(async () => {
    console.log(chalk.yellow('🔍 Checking unused dependencies...'));
    const unused = await checker.checkUnused();
    const total = unused.dependencies.length + unused.devDependencies.length;
    
    if (total === 0) {
      console.log(chalk.green('✅ No unused dependencies found.'));
    } else {
      console.log(chalk.red(`❌ Found ${total} unused dependencies`));
      console.log(chalk.cyan('💡 Run "dependency-cli fix --unused --yes" to remove them.'));
    }
  });

program
  .command('outdated')
  .description('Check for outdated dependencies')
  .action(async () => {
    console.log(chalk.yellow('📦 Checking outdated dependencies...'));
    try {
      execSync('npm outdated', { stdio: 'inherit' });
    } catch {
      console.log(chalk.cyan('💡 Run "dependency-cli fix --outdated --yes" to update them.'));
    }
  });

program
  .command('score')
  .description('Calculate dependency health score')
  .action(async () => {
    console.log(chalk.yellow('📊 Calculating health score...\n'));
    
    const { score, issues, suggestions } = await checker.calculateHealthScore();
    
    let scoreColor = chalk.green;
    let emoji = '🟢';
    
    if (score < 70) {
      scoreColor = chalk.red;
      emoji = '🔴';
    } else if (score < 85) {
      scoreColor = chalk.yellow;
      emoji = '🟡';
    }
    
    console.log(scoreColor(`${emoji} Health Score: ${score}/100`));
    
    if (issues.length > 0) {
      console.log(chalk.cyan('\n📋 Issues:'));
      issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    if (suggestions.length > 0) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
    }
  });

program.on('command:*', () => {
  console.error(chalk.red('❌ Unknown command. Use --help for available commands.'));
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}