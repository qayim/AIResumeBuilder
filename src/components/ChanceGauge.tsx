interface Props {
  value: number
  verdict: string
}

function colorFor(value: number): string {
  if (value >= 75) return '#16a34a'
  if (value >= 50) return '#ca8a04'
  if (value >= 30) return '#ea580c'
  return '#dc2626'
}

export default function ChanceGauge({ value, verdict }: Props) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const dash = (clamped / 100) * circumference
  const color = colorFor(clamped)

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-900">{clamped}%</span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            chance
          </span>
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold" style={{ color }}>
        {verdict}
      </span>
    </div>
  )
}
