'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, BookOpen, Settings, CalendarDays, ShoppingCart } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Chat', icon: MessageSquare },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/mealplan', label: 'Meal Plan', icon: CalendarDays },
    { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <header className="bg-[#FBFBFA] border-b border-[#E9E9E7] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="text-lg font-semibold text-[#37352F]">MealMind</h1>
              <p className="text-[10px] text-[#787774] hidden sm:block">AI Meal Planner</p>
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
                      ? 'bg-[#37352F] text-white'
                      : 'text-[#37352F] hover:bg-[#F7F6F3]'
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
