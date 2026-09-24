'use client';

import { NAV, type NavItem } from '#/lib/nav';
import { LinkStatus } from '#/ui/link-status';
import { ThemeToggle } from '#/ui/theme-toggle';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center gap-2 px-4 py-4 lg:h-auto">
        <Link href="/" className="group flex min-w-0 flex-1 items-center gap-x-2.5" onClick={close}>
          <div className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-gray-800 font-mono text-sm font-bold text-accent group-hover:border-gray-700">
            π̂
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium text-gray-200 group-hover:text-white">Revion simulations</h3>
          </div>
        </Link>
        <div className="mr-20 lg:mr-0">
          <ThemeToggle />
        </div>
      </div>
      <button
        type="button"
        className="group absolute top-0 right-0 flex h-14 items-center gap-x-2 px-4 lg:hidden"
        aria-expanded={isOpen}
        aria-controls="site-nav"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="font-medium text-gray-100 group-hover:text-gray-400">Menu</div>
        {isOpen ? <XMarkIcon className="block w-6 text-gray-400" /> : <Bars3Icon className="block w-6 text-gray-400" />}
      </button>

      <div
        id="site-nav"
        className={clsx('overflow-y-auto lg:static lg:block', {
          'fixed inset-x-0 top-14 bottom-0 mt-px bg-black': isOpen,
          hidden: !isOpen,
        })}
      >
        <nav aria-label="Sections" className="space-y-6 px-2 pt-5 pb-24">
          {NAV.map((section) => (
            <div key={section.name}>
              <div className="mb-2 px-3 font-mono text-xs font-semibold tracking-wide text-gray-500 uppercase">
                {section.name}
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} close={close} isActive={pathname === item.href || (item.href.length > 4 && pathname.startsWith(`${item.href}/`))} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}

function NavLink({ item, close, isActive }: { item: NavItem; close: () => void; isActive: boolean }) {
  return (
    <Link
      onClick={close}
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={clsx('flex justify-between rounded-md px-3 py-2 text-sm font-medium hover:text-gray-300', {
        'text-gray-400 hover:bg-gray-800': !isActive,
        'bg-gray-900 text-white': isActive,
      })}
    >
      {item.name}
      <LinkStatus />
    </Link>
  );
}
