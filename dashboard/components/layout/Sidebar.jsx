'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 border-r border-bg-tertiary p-4 bg-bg-primary">
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block py-2 px-3 rounded-lg ${
              pathname === link.href ? 'bg-bg-secondary text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
