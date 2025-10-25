import React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: string;
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className = '', label, ...props }, ref) => {
  const switchId = React.useId();

  return (
    <div className="flex items-center gap-3">
      <SwitchPrimitives.Root
        id={switchId}
        className={`
          peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
          transition-colors duration-fast
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          data-[state=checked]:bg-primary-600 data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-700
          ${className}
        `}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className="
            pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0
            transition-transform duration-fast
            data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0
          "
        />
      </SwitchPrimitives.Root>
      {label && (
        <label htmlFor={switchId} className="text-sm font-medium text-text-primary cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
});

Switch.displayName = 'Switch';
