import Link from "next/link";

interface NavLinkProps {
    href: string;
    children: React.ReactNode;
}

export default function NavLink({ href, children }: NavLinkProps) {
    return (
        <Link
            href={href}
            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
        >
            {children}
        </Link>
    );
}
