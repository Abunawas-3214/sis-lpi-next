#!/bin/bash
# ========================================================
# Script Deployment Otomatis SIS-LPI via GitHub Webhook
# Lokasi: /var/www/sis-lpi/deploy.sh
# ========================================================

export PATH="$HOME/.bun/bin:/root/.bun/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

LOG_FILE="/var/log/sis-lpi-deploy.log"

echo "" >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"
echo "🚀 [$(date '+%Y-%m-%d %H:%M:%S')] PUSH EVENT DITERIMA. MEMULAI DEPLOYMENT..." >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"

cd /var/www/sis-lpi || {
    echo "❌ Gagal berpindah ke direktori /var/www/sis-lpi" >> "$LOG_FILE"
    exit 1
}

# 1. Tarik perubahan terbaru dari GitHub
echo "📥 Menarik kode terbaru dari Git..." >> "$LOG_FILE"
git fetch origin main >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1

# 2. Instal dependensi jika ada perubahan package
echo "📦 Menginstal dependensi..." >> "$LOG_FILE"
bun install --frozen-lockfile >> "$LOG_FILE" 2>&1

# 3. Build Next.js untuk produksi
echo "🏗️ Membangun build produksi Next.js..." >> "$LOG_FILE"
bun run build >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Build berhasil!" >> "$LOG_FILE"
    # 4. Restart service systemd sis-lpi
    echo "🔄 Me-restart service sis-lpi..." >> "$LOG_FILE"
    systemctl restart sis-lpi >> "$LOG_FILE" 2>&1
    echo "🎉 [$(date '+%Y-%m-%d %H:%M:%S')] DEPLOYMENT SUKSES SELESAI!" >> "$LOG_FILE"
else
    echo "❌ [$(date '+%Y-%m-%d %H:%M:%S')] BUILD GAGAL! Service tidak di-restart." >> "$LOG_FILE"
fi
