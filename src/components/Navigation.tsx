'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Settings, CalendarDays, Home } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/home', label: 'Home', icon: Home },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/', label: 'Meal Plan', icon: CalendarDays },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <header className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="text-lg font-semibold text-[#1F2937]">MealMind</h1>
              <p className="text-[10px] text-[#6B7280] hidden sm:block">AI Meal Planner</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1F2937] text-white'
                      : 'text-[#1F2937] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
