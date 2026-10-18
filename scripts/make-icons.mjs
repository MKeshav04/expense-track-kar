// Generates the PNG app icons (sunny yellow square, three ink bars) with no dependencies.
// Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function icon(size) {
  const bg = [0xff, 0xd2, 0x3f]
  const fg = [0x1b, 0x17, 0x12]
  // Bars sit inside the central 60% so the maskable crop never cuts them.
  const bars = [
    { x: 0.27, h: 0.26 },
    { x: 0.44, h: 0.44 },
    { x: 0.61, h: 0.34 },
  ]
  const w = 0.12
  const base = 0.72
  const r = w / 2
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      let on = false
      for (const b of bars) {
        const top = base - b.h
        if (u < b.x || u > b.x + w || v > base || v < top) continue
        // Rounded top.
        const cy = top + r
        if (v < cy) {
          const dx = u - (b.x + r)
          const dy = v - cy
          if (dx * dx + dy * dy > r * r) continue
        }
        on = true
      }
      const c = on ? fg : bg
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', icon(192))
writeFileSync('public/icon-512.png', icon(512))
writeFileSync('public/apple-touch-icon.png', icon(180))
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#ffd23f" stroke="#1b1712" stroke-width="6"/><g fill="#1b1712"><rect x="27" y="46" width="12" height="26" rx="6"/><rect x="44" y="28" width="12" height="44" rx="6"/><rect x="61" y="38" width="12" height="34" rx="6"/></g></svg>`,
)
console.log('icons written')
