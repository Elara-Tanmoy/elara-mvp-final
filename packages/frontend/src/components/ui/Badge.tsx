import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
        sev0: 'bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] dark:bg-[#0c1e2f] dark:text-[#7dd3fc] dark:border-[#1e3a5f]',
        sev1: 'bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] dark:bg-[#0a2e1a] dark:text-[#86efac] dark:border-[#14532d]',
        sev2: 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a] dark:bg-[#2e1f0a] dark:text-[#fde047] dark:border-[#78350f]',
        sev3: 'bg-[#fef3c7] text-[#92400e] border border-[#fbbf24] dark:bg-[#3e1f0a] dark:text-[#fbbf24] dark:border-[#92400e]',
        sev4: 'bg-[#fef2f2] text-[#991b1b] border border-[#fecaca] dark:bg-[#3e0a0a] dark:text-[#fca5a5] dark:border-[#7f1d1d]',
        sev5: 'bg-[#450a0a] text-[#fecaca] border border-[#7f1d1d] dark:bg-[#7f1d1d] dark:text-[#fef2f2] dark:border-[#dc2626]',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, icon, children, ...props }, ref) => {
    return (
      <div ref={ref} className={badgeVariants({ variant, className })} {...props}>
        {icon && <span className="inline-flex">{icon}</span>}
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';
