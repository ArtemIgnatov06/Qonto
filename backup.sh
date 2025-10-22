#!/bin/bash

# Це інструкція для робота як робити бекап

echo "=== Початок бекапу ==="

# Робимо копію бази
mysqldump -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE | gzip > /tmp/backup_$(date +%Y-%m-%d).sql.gz

echo "✅ Бекап створено!"

# Видаляємо старі копії (більше 7 днів)
find /tmp -name "backup_*.sql.gz" -mtime +7 -delete

echo "🗑️ Старі бекапи видалено"
echo "=== Готово! ==="