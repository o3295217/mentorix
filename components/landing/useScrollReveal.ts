import { useEffect, useRef } from 'react'

export default function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    )

    el.querySelectorAll('[data-reveal]').forEach((child) => {
      observer.observe(child)
    })

    return () => observer.disconnect()
  }, [])

  return ref
}
