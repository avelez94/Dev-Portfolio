import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Alante Velez. Your business deserves a website you’re excited to share.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const dir = join(process.cwd(), 'src/assets/og')
  const [display, displayItalic, sans, portrait] = await Promise.all([
    readFile(join(dir, 'fraunces-latin-600-normal.woff')),
    readFile(join(dir, 'fraunces-latin-600-italic.woff')),
    readFile(join(dir, 'figtree-latin-600-normal.woff')),
    readFile(join(dir, 'portrait.jpg')),
  ])
  const portraitSrc = `data:image/jpeg;base64,${portrait.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#FBF3E8',
          color: '#2A1F1B',
          padding: '64px 72px',
          position: 'relative',
          fontFamily: 'Figtree',
        }}
      >
        <div style={{ position: 'absolute', right: -80, top: -120, width: 520, height: 520, borderRadius: 999, background: '#F2C9C1', display: 'flex' }} />
        <div style={{ position: 'absolute', left: -60, bottom: -90, width: 220, height: 220, borderRadius: 999, background: '#FFD9CF', display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 640, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 600 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50% 50% 50% 14px',
                background: '#FF6B4F',
                border: '3px solid #2A1F1B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Fraunces',
                fontStyle: 'italic',
                fontSize: 22,
              }}
            >
              AV
            </div>
            Alante Velez
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34, fontFamily: 'Fraunces', fontSize: 60, lineHeight: 1.06, letterSpacing: -1.5 }}>
            <span>Your business deserves</span>
            <span>a website you’re</span>
            <span style={{ fontStyle: 'italic', color: '#B33A26' }}>excited to share.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 30, fontSize: 28, color: '#5C4A42' }}>Website design, redesigns, and care</div>
        </div>

        <div style={{ display: 'flex', position: 'absolute', right: 80, top: 70, width: 330, height: 440 }}>
          <div style={{ position: 'absolute', left: 14, top: 14, width: 330, height: 440, borderRadius: '200px 200px 34px 34px', background: '#FF6B4F', display: 'flex' }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 330,
              height: 440,
              borderRadius: '200px 200px 34px 34px',
              border: '4px solid #2A1F1B',
              background: '#FFFAF3',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={portraitSrc} width={322} height={432} style={{ objectFit: 'cover', width: 322, height: 432, borderRadius: '196px 196px 30px 30px' }} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: display, style: 'normal', weight: 600 },
        { name: 'Fraunces', data: displayItalic, style: 'italic', weight: 600 },
        { name: 'Figtree', data: sans, style: 'normal', weight: 600 },
      ],
    }
  )
}
