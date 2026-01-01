import NavLink from "./NavLink";

export default function NavigationBar() {
    return (
        <div
            className="fixed top-4 left-0 right-0 z-50 flex justify-center"
            data-component="NavigationBar"
        >
            <nav className="px-6 py-4 rounded-full border">
                <ul className="flex space-x-6">
                    <li>
                        <NavLink href="/">Home</NavLink>
                    </li>
                    <li>
                        <NavLink href="/credit-cards">Credit Cards</NavLink>
                    </li>
                    <li>
                        <NavLink href="/persons">Persons</NavLink>
                    </li>
                    <li>
                        <NavLink href="/purchases">Purchases</NavLink>
                    </li>
                    <li>
                        <NavLink href="/transactions">Transactions</NavLink>
                    </li>
                </ul>
            </nav>
        </div>
    );
}
