import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AION — ИИ-ассистент для достижения целей'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
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
            <span style={{ color: '#818cf8' }}>A</span>
            <span
              style={{
                background: 'linear-gradient(180deg, #c084fc, #60a5fa)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              I
            </span>
            <span style={{ color: '#e2e8f0' }}>ON</span>
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
          Опиши цель — ИОН построит маршрут и будет ежедневно помогать двигаться вперёд
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
            { label: 'Планирование', icon: '📋' },
            { label: 'ИИ-оценка', icon: '🎯' },
            { label: 'Прогноз', icon: '📈' },
            { label: 'Аналитика', icon: '📊' },
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
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
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
          assist.labaiion.ru
        </div>
      </div>
    ),
    { ...size }
  )
}
