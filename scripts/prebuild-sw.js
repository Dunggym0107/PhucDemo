const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = path.join(__dirname, '..', 'public', 'sw.js.template');
const dest = path.join(__dirname, '..', 'public', 'sw.js');

const buildVersion = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
const template = fs.readFileSync(src, 'utf-8');
const output = template.replace(/__BUILD_VERSION__/g, buildVersion);
fs.writeFileSync(dest, output, 'utf-8');

console.log('[prebuild-sw] generated public/sw.js with build version:', buildVersion);
