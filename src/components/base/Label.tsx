import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  text?: string;
  altText?: string;
  required?: boolean;
  children?: React.ReactNode;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
 ({ text, altText, required, children, className = '', htmlFor, ...props }, ref) => {
    return (
     <label ref={ref} htmlFor={htmlFor} className={`label ${className}`} {...props}>
       <span className="label-text">
          {text}
          {required && <span className="text-error ml-1">*</span>}
        </span>
        {altText && <span className="label-text-alt">{altText}</span>}
        {children}
     </label>
    );
  }
);

Label.displayName = 'Label';

export default Label;
