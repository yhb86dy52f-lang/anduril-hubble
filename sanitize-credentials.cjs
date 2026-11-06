const fs = require('fs');
const path = require('path');

const filesToPatch = ['hubble-poller.cjs', 'backfill-hubble.cjs'];
const token = "2ddfbffd9a7b175b73ee2f278e71341c2be03c632b5a4e2e5e181b605f56e7c78e5d2c3a3947444ac5d17833a99b5993";
const orgId = "2d3cab0a-1b43-46c9-85c7-b6470e00318a";

// 1. Actualizar .env
let envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
if (!envContent.includes('HUBBLE_TOKEN')) {
    envContent += `\nHUBBLE_TOKEN=${token}\nHUBBLE_ORG_ID=${orgId}\n`;
    fs.writeFileSync('.env', envContent.trim() + '\n', 'utf8');
    console.log('   [OK] .env actualizado con credenciales de Hubble.');
}

// 2. Parchear archivos para usar process.env
filesToPatch.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(new RegExp(token, 'g'), 'process.env.HUBBLE_TOKEN');
        content = content.replace(new RegExp(orgId, 'g'), 'process.env.HUBBLE_ORG_ID');
        
        // Asegurar que dotenv se cargue al principio del archivo
        if (!content.includes('require(\'dotenv\').config()')) {
            content = "require('dotenv').config();\n" + content;
        }
        
        fs.writeFileSync(file, content, 'utf8');
        console.log(`   [OK] ${file} sanitizado (usa process.env).`);
    }
});
