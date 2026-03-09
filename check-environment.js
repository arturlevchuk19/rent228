#!/usr/bin/env node

/**
 * Environment Check Script for RentMaster2
 * Проверяет наличие всех необходимых переменных окружения и зависимостей
 */

const fs = require('fs');
const path = require('path');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log(`✓ ${description} exists`, 'green');
  } else {
    log(`✗ ${description} not found: ${filePath}`, 'red');
  }
  return exists;
}

function checkEnvVariables() {
  log('\n=== Checking Environment Variables ===\n', 'cyan');
  
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    log('✗ .env file not found', 'red');
    log('  Run: cp .env.example .env', 'yellow');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];

  let allPresent = true;
  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    if (regex.test(envContent)) {
      log(`✓ ${varName} is set`, 'green');
    } else {
      log(`✗ ${varName} is missing or empty`, 'red');
      allPresent = false;
    }
  }

  return allPresent;
}

function checkNodeModules() {
  log('\n=== Checking Dependencies ===\n', 'cyan');
  
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('✗ node_modules not found', 'red');
    log('  Run: npm install', 'yellow');
    return false;
  }

  log('✓ node_modules exists', 'green');

  // Проверка ключевых зависимостей
  const keyDependencies = [
    '@supabase/supabase-js',
    'react',
    'react-dom',
    'vite'
  ];

  let allPresent = true;
  for (const dep of keyDependencies) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      log(`✓ ${dep}`, 'green');
    } else {
      log(`✗ ${dep} not found`, 'red');
      allPresent = false;
    }
  }

  return allPresent;
}

function checkSupabaseSetup() {
  log('\n=== Checking Supabase Setup ===\n', 'cyan');
  
  const migrationsPath = path.join(__dirname, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    log('✗ supabase/migrations directory not found', 'red');
    return false;
  }

  const migrationFiles = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
  log(`✓ Found ${migrationFiles.length} migration files`, 'green');

  checkFileExists(
    path.join(__dirname, 'supabase', 'config.toml'),
    'supabase/config.toml'
  );
  
  checkFileExists(
    path.join(__dirname, 'supabase', 'run-migrations.sh'),
    'supabase/run-migrations.sh'
  );

  return true;
}

function checkNodeVersion() {
  log('\n=== Checking Node.js Version ===\n', 'cyan');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  log(`Current Node.js version: ${nodeVersion}`, 'blue');
  
  if (majorVersion >= 18) {
    log('✓ Node.js version is compatible (>= 18)', 'green');
    return true;
  } else {
    log('✗ Node.js version is too old (< 18)', 'red');
    log('  Please upgrade Node.js to version 18 or higher', 'yellow');
    return false;
  }
}

function printSummary(checks) {
  log('\n=== Summary ===\n', 'cyan');
  
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  
  if (passed === total) {
    log(`✓ All checks passed (${passed}/${total})`, 'green');
    log('\nYou can now run:', 'cyan');
    log('  npm run dev', 'blue');
  } else {
    log(`✗ Some checks failed (${passed}/${total})`, 'red');
    log('\nPlease fix the issues above before running the application', 'yellow');
  }
}

function printNextSteps() {
  log('\n=== Next Steps ===\n', 'cyan');
  log('1. Ensure .env file has correct Supabase credentials', 'blue');
  log('2. Run migrations: cd supabase && ./run-migrations.sh', 'blue');
  log('3. Start dev server: npm run dev', 'blue');
  log('4. Open browser: http://localhost:5173', 'blue');
  log('\nFor detailed instructions, see DEPLOYMENT.md\n', 'yellow');
}

// Main execution
function main() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║  RentMaster2 Environment Check             ║', 'cyan');
  log('╚════════════════════════════════════════════╝\n', 'cyan');

  const checks = [
    { name: 'Node.js Version', passed: checkNodeVersion() },
    { name: 'Dependencies', passed: checkNodeModules() },
    { name: 'Environment Variables', passed: checkEnvVariables() },
    { name: 'Supabase Setup', passed: checkSupabaseSetup() }
  ];

  printSummary(checks);
  
  const allPassed = checks.every(c => c.passed);
  if (allPassed) {
    printNextSteps();
  }

  process.exit(allPassed ? 0 : 1);
}

main();
