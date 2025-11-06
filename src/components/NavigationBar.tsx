import Link from "next/link";

export default function NavigationBar() {
    return (
        <div
            className="fixed top-4 left-0 right-0 z-50 flex justify-center"
            data-component="NavigationBar"
        >
            <nav className="px-6 py-4 rounded-full border">
                <ul className="flex space-x-6">
                    <li>
                        <Link
                            href="/"
                            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
                        >
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/credit-cards"
                            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
                        >
                            Credit Cards
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/persons"
                            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
                        >
                            Persons
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/purchases"
                            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
                        >
                            Purchases
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/transactions"
                            className="text-white hover:text-blue-400 transition-colors duration-200 font-medium"
                        >
                            Transactions
                        </Link>
                    </li>
                </ul>
            </nav>
        </div>
    );
}
