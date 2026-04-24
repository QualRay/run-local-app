import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  let variantClass = ""
  if (variant === "default") {
    variantClass = "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80"
  } else if (variant === "secondary") {
    variantClass = "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80"
  } else if (variant === "destructive") {
    variantClass = "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80"
  } else if (variant === "outline") {
    variantClass = "text-slate-950 border-slate-200"
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 ${variantClass} ${className || ""}`}
      {...props}
    />
  )
}

export { Badge }
