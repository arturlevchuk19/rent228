#!/bin/bash

# RentMaster2 Database Migration Script
# Этот скрипт выполняет все миграции базы данных в правильном порядке

set -e  # Остановить выполнение при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
MIGRATIONS_DIR="$(dirname "$0")/migrations"
SUPABASE_URL="https://jtgupdeuwovoyadgtcns.supabase.co"

echo -e "${GREEN}=== RentMaster2 Database Migration Tool ===${NC}"
echo ""

# Проверка наличия Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI не установлен${NC}"
    echo "Установите Supabase CLI:"
    echo "npm install -g supabase"
    echo "или посетите: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Проверка наличия директории с миграциями
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Директория с миграциями не найдена: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Подсчет количества миграций
MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name "*.sql" | wc -l)
echo -e "${YELLOW}Найдено миграций: $MIGRATION_COUNT${NC}"
echo ""

# Запрос подтверждения
read -p "Выполнить миграции? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено пользователем"
    exit 0
fi

# Проверка подключения к Supabase
echo -e "${YELLOW}Проверка подключения к Supabase...${NC}"
if ! supabase link --project-ref jtgupdeuwovoyadgtcns 2>/dev/null; then
    echo -e "${YELLOW}Требуется авторизация в Supabase CLI${NC}"
    echo "Выполните: supabase login"
    echo "Затем: supabase link --project-ref jtgupdeuwovoyadgtcns"
    exit 1
fi

echo -e "${GREEN}Подключение установлено${NC}"
echo ""

# Выполнение миграций
echo -e "${YELLOW}Выполнение миграций...${NC}"
echo ""

COUNTER=0
for migration_file in $(find "$MIGRATIONS_DIR" -name "*.sql" | sort); do
    COUNTER=$((COUNTER + 1))
    FILENAME=$(basename "$migration_file")
    
    echo -e "${YELLOW}[$COUNTER/$MIGRATION_COUNT] Выполнение: $FILENAME${NC}"
    
    if supabase db push; then
        echo -e "${GREEN}✓ Успешно: $FILENAME${NC}"
    else
        echo -e "${RED}✗ Ошибка при выполнении: $FILENAME${NC}"
        echo -e "${RED}Миграция остановлена${NC}"
        exit 1
    fi
    
    echo ""
done

echo -e "${GREEN}=== Все миграции выполнены успешно ===${NC}"
echo ""
echo "Следующие шаги:"
echo "1. Проверьте структуру базы данных в Supabase Dashboard"
echo "2. Убедитесь, что RLS политики настроены корректно"
echo "3. Создайте первого пользователя через приложение"
echo ""
