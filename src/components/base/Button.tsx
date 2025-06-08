import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
  variant?: 'outline' | 'dash' | 'soft' | 'ghost' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  modifier?: 'wide' | 'block' | 'square' | 'circle';
  active?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  as?: 'button' | 'a' | 'input';
  href?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    color, 
    variant, 
    size, 
    modifier, 
    active, 
    loading, 
    disabled, 
    className = '', 
    children, 
    as = 'button',
    href,
    ...props 
  }, ref) => {
    const baseClasses = 'btn';
    const colorClasses = color ? `btn-${color}` : '';
    const variantClasses = variant ? `btn-${variant}` : '';
    const sizeClasses = size ? `btn-${size}` : '';
    const modifierClasses = modifier ? `btn-${modifier}` : '';
    const activeClasses = active ? 'btn-active' : '';
    const disabledClasses = disabled ? 'btn-disabled' : '';
    const loadingClasses = loading ? 'loading' : '';

    const buttonClasses = [
      baseClasses,
      colorClasses,
      variantClasses,
      sizeClasses,
      modifierClasses,
      activeClasses,
      disabledClasses,
      loadingClasses,
      className
    ]
      .filter(Boolean)
      .join(' ');

    const buttonProps = {
      className: buttonClasses,
      disabled: disabled || loading,
      ...props
    };

    // For accessibility when using btn-disabled class
    if (disabled && !buttonProps.disabled) {
      buttonProps.tabIndex = -1;
      buttonProps.role = 'button';
      buttonProps['aria-disabled'] = 'true';
    }

    if (as === 'a') {
      return (
        <a
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          {...(buttonProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
        </a>
      );
    }

    if (as === 'input') {
      return (
        <input
          ref={ref as React.ForwardedRef<HTMLInputElement>}
          type="button"
          value={typeof children === 'string' ? children : ''}
          {...(buttonProps as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      );
    }

    return (
      <button
        ref={ref}
        {...buttonProps}
      >
        {loading && <span className="loading loading-spinner loading-sm mr-2"></span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
export type { ButtonProps };
