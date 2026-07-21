/**
 * npm install sırasında (postinstall/prepare) çalışır: git hook'ların
 * .githooks/ dizininden okunmasını sağlar (husky gibi bir bağımlılık
 * eklemeden). Git deposu değilse (ör. paket başka bir yerden tüketiliyorsa)
 * sessizce atlanır.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
} catch {
    process.exit(0); // git deposu değil
}

try {
    execSync('git config core.hooksPath .githooks');
    const hookPath = path.join(__dirname, '..', '.githooks', 'pre-commit');
    if (fs.existsSync(hookPath)) {
        fs.chmodSync(hookPath, 0o755);
    }
} catch (e) {
    console.warn('Git hook kurulamadı (önemsiz):', e.message);
}
