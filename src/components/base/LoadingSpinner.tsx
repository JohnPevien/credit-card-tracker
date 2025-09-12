import React from "react";

interface LoadingSpinnerProps {
    text?: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
    ({ text = "Loading...", className = "", size = "md", ...props }, ref) => {
        const sizeClasses = {
            sm: "text-sm p-4",
            md: "text-base p-8",
            lg: "text-lg p-12",
        };

        return (
            <div
                ref={ref}
                className={`text-center ${sizeClasses[size]} ${className}`}
                {...props}
            >
                <div className="loading loading-spinner loading-md mb-2"></div>
                <div>{text}</div>
            </div>
        );
    },
);

LoadingSpinner.displayName = "LoadingSpinner";

export default LoadingSpinner;
export type { LoadingSpinnerProps };
