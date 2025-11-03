import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    variant?: "default" | "primary" | "secondary";
    hover?: boolean;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode;
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

const CardRoot = React.forwardRef<HTMLDivElement, CardProps>(
    (
        {
            children,
            variant = "default",
            hover = false,
            className = "",
            ...props
        },
        ref,
    ) => {
        const variantClasses = {
            default: "shadow rounded-lg p-6",
            primary: "shadow bg-primary rounded-lg p-6",
            secondary: "shadow bg-secondary rounded-lg p-6",
        };

        const hoverClasses = hover ? "hover:shadow-md transition-shadow" : "";

        const cardClasses = [variantClasses[variant], hoverClasses, className]
            .filter(Boolean)
            .join(" ");

        return (
            <div ref={ref} className={cardClasses} {...props}>
                {children}
            </div>
        );
    },
);

const CardHeader = React.forwardRef<
    HTMLHeadingElement,
    CardHeaderProps
>(({ children, as = "h2", className = "", ...props }, ref) => {
    const Component = as;
    return (
        <Component
            ref={ref}
            className={`text-xl font-bold mb-2 ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
});

const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
    ({ children, className = "", ...props }, ref) => {
        return (
            <div ref={ref} className={className} {...props}>
                {children}
            </div>
        );
    },
);

CardRoot.displayName = "Card";
CardHeader.displayName = "Card.Header";
CardBody.displayName = "Card.Body";

const Card = Object.assign(CardRoot, {
    Header: CardHeader,
    Body: CardBody,
});

export default Card;
export type { CardProps, CardHeaderProps, CardBodyProps };
