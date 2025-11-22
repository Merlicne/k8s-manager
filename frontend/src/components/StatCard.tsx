import { cn } from '../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color: string
  subtext?: string
}

export function StatCard({ title, value, icon: Icon, color, subtext }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <h3 className="text-2xl font-bold text-stone-900 mt-1">{value}</h3>
          {subtext && <p className="text-xs text-stone-400 mt-1">{subtext}</p>}
        </div>
        <div className={cn("p-3 rounded-lg bg-opacity-10", color)}>
          <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
        </div>
      </div>
    </div>
  )
}
