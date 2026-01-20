'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChefHat, MessageSquare, BookOpen, Settings } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Chat', icon: MessageSquare },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">MealMind</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Your AI Meal Planner</p>
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-100 text-orange-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
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
