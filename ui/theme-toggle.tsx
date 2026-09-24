'use client';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

/** Runs before paint (inlined in <head>) so there is no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'), []);
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="rounded-md p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {}
        setTheme(next);
      }}
    >
      {theme === 'light' ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
    </button>
  );
}
