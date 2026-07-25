// Generate compressed icon PNGs from the WorkFlow SVG monogram.
// Run: node scripts/build-icons.mjs
// Output: public/icon-512.png, public/icon-192.png
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

// Same design as src/components/ui/logo.tsx — rasterized for PWA install.
// Padding bigger so the mark stays visible inside maskable safe area.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="512" height="512">
  <rect width="40" height="40" rx="10" fill="#1e40af"/>
  <path d="M9 12 L14 28 L20 18 L26 28 L31 12"
        stroke="white" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`

async function generate(size, outName) {
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 })
    .toBuffer()
  writeFileSync(join(PUBLIC, outName), buf)
  console.log(`✓ ${outName}: ${(buf.length / 1024).toFixed(1)}KB`)
}

await generate(512, 'icon-512.png')
await generate(192, 'icon-192.png')
console.log('Done.')
