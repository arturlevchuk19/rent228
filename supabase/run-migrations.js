#!/usr/bin/env node

/**
 * RentMaster2 Database Migration Script (Node.js)
 * Этот скрипт выполняет SQL миграции через Supabase API
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Конфигурация из переменных окружения
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jtgupdeuwovoyadgtcns.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigrations() {
  log('\n=== RentMaster2 Database Migration Tool (Node.js) ===\n', 'green');

  // Проверка наличия Service Role Key
  if (!SUPABASE_SERVICE_KEY) {
    log('Error: SUPABASE_SERVICE_ROLE_KEY не установлен', 'red');
    log('Установите переменную окружения:', 'yellow');
    log('export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"', 'yellow');
    log('\nВнимание: Service Role Key можно найти в:', 'yellow');
    log('Supabase Dashboard > Settings > API > service_role secret\n', 'yellow');
    process.exit(1);
  }

  // Создание клиента Supabase с Service Role Key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Путь к директории с миграциями
  const migrationsDir = path.join(__dirname, 'migrations');

  // Проверка наличия директории
  if (!fs.existsSync(migrationsDir)) {
    log(`Error: Директория миграций не найдена: ${migrationsDir}`, 'red');
    process.exit(1);
  }

  // Получение списка файлов миграций
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    log('Не найдено файлов миграций', 'yellow');
    process.exit(0);
  }

  log(`Найдено миграций: ${migrationFiles.length}\n`, 'yellow');

  // Создание таблицы для отслеживания миграций (если не существует)
  log('Создание таблицы для отслеживания миграций...', 'blue');
  const createMigrationsTable = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: createMigrationsTable });
    if (error) {
      log(`Предупреждение: ${error.message}`, 'yellow');
      log('Продолжаем без таблицы отслеживания миграций...', 'yellow');
    }
  } catch (err) {
    log(`Предупреждение: ${err.message}`, 'yellow');
  }

  // Выполнение каждой миграции
  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < migrationFiles.length; i++) {
    const fileName = migrationFiles[i];
    const filePath = path.join(migrationsDir, fileName);
    
    log(`[${i + 1}/${migrationFiles.length}] Обработка: ${fileName}`, 'yellow');

    // Чтение содержимого миграции
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    try {
      // Примечание: Supabase JS client не поддерживает прямое выполнение SQL
      // Для production использования необходимо использовать Supabase CLI
      // или REST API напрямую
      
      log(`  ℹ Файл прочитан (${sqlContent.length} символов)`, 'blue');
      log(`  ⚠ Прямое выполнение SQL через JS client недоступно`, 'yellow');
      log(`  → Используйте Supabase CLI: supabase db push`, 'yellow');
      
      skipCount++;
    } catch (err) {
      log(`  ✗ Ошибка: ${err.message}`, 'red');
      log('\nМиграция остановлена из-за ошибки', 'red');
      process.exit(1);
    }

    console.log('');
  }

  log('=== Итоги ===', 'green');
  log(`Обработано файлов: ${migrationFiles.length}`, 'blue');
  log(`Успешно выполнено: ${successCount}`, 'green');
  log(`Пропущено: ${skipCount}`, 'yellow');
  log('\n💡 Рекомендация:', 'yellow');
  log('Для выполнения миграций используйте:', 'yellow');
  log('  1. Supabase CLI: cd supabase && ./run-migrations.sh', 'blue');
  log('  2. Supabase Dashboard: SQL Editor', 'blue');
  log('  3. Ручное выполнение каждого файла через psql\n', 'blue');
}

// Запуск
runMigrations().catch(err => {
  log(`\n✗ Критическая ошибка: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
