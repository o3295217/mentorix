import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

type IconBaseProps = IconProps & {
  children: ReactNode
}

function IconBase({ children, ...props }: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function TaskPostponeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4.5 8.5h15" />
      <rect x="4.5" y="5" width="15" height="15.5" rx="3" />
      <path d="M9 14h5.5" />
      <path d="m12.5 11.5 2.5 2.5-2.5 2.5" />
    </IconBase>
  )
}

export function TaskRepeatIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m17 3 3 3-3 3" />
      <path d="M4 11V9a3 3 0 0 1 3-3h13" />
      <path d="m7 21-3-3 3-3" />
      <path d="M20 13v2a3 3 0 0 1-3 3H4" />
    </IconBase>
  )
}

export function TaskDeleteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M18 7 17.2 18.2A2 2 0 0 1 15.2 20H8.8a2 2 0 0 1-2-1.8L6 7" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </IconBase>
  )
}

export function PlanListIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 6h11" />
      <path d="M8 12h11" />
      <path d="M8 18h11" />
      <path d="M5 6h.01" />
      <path d="M5 12h.01" />
      <path d="M5 18h.01" />
    </IconBase>
  )
}

export function PlanTimelineIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 1.9" />
    </IconBase>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  )
}

// Чашка — отдых, еда, перерывы и прочие сервисные блоки дня
export function MealRestIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 9h11v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
      <path d="M15 10h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M7 5v1.5" />
      <path d="M11 5v1.5" />
    </IconBase>
  )
}

// Песочные часы — буфер/запас времени дня
export function BufferTimeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 4h11" />
      <path d="M6.5 20h11" />
      <path d="M8 4v3.5l4 4.5 4-4.5V4" />
      <path d="M8 20v-3.5l4-4.5 4 4.5V20" />
    </IconBase>
  )
}
