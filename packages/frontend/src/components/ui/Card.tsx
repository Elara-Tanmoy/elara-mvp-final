import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  notched?: boolean;
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', notched = false, elevated = false, children, ...props }, ref) => {
    const classes = [
      'rounded-lg border border-border-default bg-surface-base p-6',
      notched && 'notched',
      elevated && 'shadow-md hover:shadow-lg transition-shadow duration-fast',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => <div className={`flex flex-col space-y-1.5 ${className}`} {...props} />;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  ...props
}) => <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />;

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  ...props
}) => <p className={`text-sm text-text-secondary ${className}`} {...props} />;

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => <div className={`pt-6 ${className}`} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => <div className={`flex items-center pt-6 ${className}`} {...props} />;
