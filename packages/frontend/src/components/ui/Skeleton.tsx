import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', variant = 'rect', width, height, style, ...props }, ref) => {
    const variantClasses = {
      text: 'h-4 w-full',
      circle: 'rounded-full',
      rect: 'rounded-md',
    };

    return (
      <div
        ref={ref}
        className={`skeleton ${variantClasses[variant]} ${className}`}
        style={{
          width: width || (variant === 'circle' ? '40px' : undefined),
          height: height || (variant === 'circle' ? '40px' : undefined),
          ...style,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
