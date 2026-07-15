import { ImageResponse } from 'next/og'
import { getAppHost } from '@/lib/app-url'

export const runtime = 'edge'
export const alt = 'mentorix — ИИ-ассистент для достижения целей'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const appHost = getAppHost()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e1b4b 70%, #020617 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '-80px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            right: '-60px',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              fontSize: '96px',
              fontWeight: 900,
              letterSpacing: '-2px',
              display: 'flex',
            }}
          >
            <span
              style={{
                background: 'linear-gradient(90deg, #818cf8, #c084fc, #60a5fa)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              mentorix
            </span>
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 500,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: '#94a3b8',
              marginTop: '-4px',
            }}
          >
            АССИСТЕНТ
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '900px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '44px',
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.15,
              letterSpacing: '-0.5px',
            }}
          >
            Сделай каждый день
          </div>
          <div
            style={{
              fontSize: '44px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(90deg, #818cf8, #60a5fa, #c084fc)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            шагом к мечте
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: '#94a3b8',
            marginTop: '24px',
            maxWidth: '700px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Опиши цель — Ментор построит маршрут и будет ежедневно помогать двигаться вперёд
        </div>

        {/* Bottom bar with features */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            marginTop: '48px',
            padding: '16px 32px',
            borderRadius: '16px',
            border: '1px solid rgba(148,163,184,0.15)',
            background: 'rgba(15,23,42,0.6)',
          }}
        >
          {[
            { label: 'Планирование', marker: '01' },
            { label: 'ИИ-оценка', marker: '02' },
            { label: 'Прогноз', marker: '03' },
            { label: 'Аналитика', marker: '04' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '18px',
                color: '#cbd5e1',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid rgba(56,189,248,0.32)',
                  background: 'rgba(14,165,233,0.10)',
                  color: '#7dd3fc',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                {item.marker}
              </span>
              {item.label}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '32px',
            fontSize: '16px',
            color: '#475569',
            fontWeight: 500,
          }}
        >
          {appHost}
        </div>
      </div>
    ),
    { ...size }
  )
}
