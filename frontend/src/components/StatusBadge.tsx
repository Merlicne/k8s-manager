import { useMemo } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '../lib/utils'

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = useMemo(() => {
    switch (status) {
      case 'Running':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'Pending':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Failed':
      case 'CrashLoopBackOff':
      case 'ErrImagePull':
        return 'bg-red-50 text-red-800 border-red-200'
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200'
    }
  }, [status])

  const Icon = useMemo(() => {
    switch (status) {
      case 'Running': return CheckCircle2
      case 'Pending': return Clock
      case 'Failed': return AlertCircle
      default: return Activity
    }
  }, [status])

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", styles)}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  )
}
