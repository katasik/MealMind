'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Loader2,
  ArrowLeft,
  Printer
} from 'lucide-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import type { MealPlanShoppingList, MealPlanShoppingItem } from '@/types';

// Group items by category
function groupByCategory(items: MealPlanShoppingItem[]): Record<string, MealPlanShoppingItem[]> {
  const grouped: Record<string, MealPlanShoppingItem[]> = {};

  for (const item of items) {
    const category = item.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }

  // Sort items within each category - unchecked first, then alphabetically
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.ingredientName.localeCompare(b.ingredientName);
    });
  }

  return grouped;
}

export default function ShoppingPage() {
  const [shoppingList, setShoppingList] = useState<MealPlanShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchShoppingList();
  }, []);

  const fetchShoppingList = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/shopping');
      const data = await response.json();
      setShoppingList(data.shoppingList || null);
    } catch (error) {
      console.error('Error fetching shopping list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    if (!shoppingList) return;

    // Optimistic update
    setShoppingList({
      ...shoppingList,
      items: shoppingList.items.map(item =>
        item.id === itemId ? { ...item, checked } : item
      )
    });

    try {
      await fetch('/api/shopping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: shoppingList.id, itemId, checked })
      });
    } catch (error) {
      console.error('Error updating shopping item:', error);
      fetchShoppingList();
    }
  };

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA]">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#787774] animate-spin" />
        </div>
      </div>
    );
  }

  if (!shoppingList) {
    return (
      <div className="min-h-screen bg-[#FBFBFA]">
        <Navigation />
        <main className="max-w-2xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-[#37352F] mb-2">
              No shopping list yet
            </h2>
            <p className="text-[#787774] mb-6 max-w-md mx-auto">
              Create a meal plan first, then approve it to generate your shopping list.
            </p>
            <Link
              href="/mealplan"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Go to Meal Plan
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  const groupedItems = groupByCategory(shoppingList.items);
  const categories = Object.keys(groupedItems).sort();

  const totalItems = shoppingList.items.length;
  const checkedItems = shoppingList.items.filter(i => i.checked).length;
  const remainingItems = totalItems - checkedItems;

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <Navigation />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/mealplan"
                className="p-1 hover:bg-[#F7F6F3] rounded-md transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#787774]" />
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛒</span>
                <h1 className="text-2xl font-bold text-[#37352F]">Shopping List</h1>
              </div>
            </div>
            <p className="text-[#787774] text-sm ml-8">
              Week of {new Date(shoppingList.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 text-[#787774] hover:text-[#37352F] hover:bg-[#F7F6F3] rounded-md transition-colors print:hidden text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#E9E9E7] rounded-lg p-4 mb-6"
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#787774]">
              {checkedItems} of {totalItems} items checked
            </span>
            <span className="font-medium text-[#37352F]">
              {remainingItems} items to buy
            </span>
          </div>
          <div className="w-full h-2 bg-[#F7F6F3] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(checkedItems / totalItems) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-[#37352F] rounded-full"
            />
          </div>
        </motion.div>

        {/* Shopping List */}
        <div className="space-y-3">
          {categories.map((category, categoryIndex) => {
            const items = groupedItems[category];
            const categoryChecked = items.filter(i => i.checked).length;
            const isCollapsed = collapsedCategories.has(category);

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.05 }}
                className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[#F7F6F3] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#37352F]">{category}</span>
                    <span className="text-xs text-[#787774] bg-[#F7F6F3] px-2 py-0.5 rounded-full">
                      {categoryChecked}/{items.length}
                    </span>
                  </div>
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-[#787774]" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-[#787774]" />
                  )}
                </button>

                {/* Items */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-[#E9E9E7]"
                    >
                      <ul>
                        {items.map((item, itemIndex) => (
                          <motion.li
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: itemIndex * 0.02 }}
                          >
                            <button
                              onClick={() => toggleItem(item.id, !item.checked)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F7F6F3] transition-colors ${
                                item.checked ? 'bg-[#F7F6F3]' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                  item.checked
                                    ? 'bg-[#37352F] border-[#37352F]'
                                    : 'border-[#D3D3D0]'
                                }`}
                              >
                                {item.checked && <Check className="w-3 h-3 text-white" />}
                              </div>

                              {/* Item Details */}
                              <div className="flex-1 text-left">
                                <span
                                  className={`block text-sm ${
                                    item.checked ? 'text-[#787774] line-through' : 'text-[#37352F]'
                                  }`}
                                >
                                  <span className="font-medium">{item.amount} {item.unit}</span>{' '}
                                  {item.ingredientName}
                                </span>
                                {item.recipeNames.length > 0 && (
                                  <span className="text-[10px] text-[#787774]">
                                    For: {item.recipeNames.slice(0, 2).join(', ')}
                                    {item.recipeNames.length > 2 && ` +${item.recipeNames.length - 2} more`}
                                  </span>
                                )}
                              </div>
                            </button>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Back to Meal Plan */}
        <div className="mt-8 text-center print:hidden">
          <Link
            href="/mealplan"
            className="inline-flex items-center gap-2 text-[#787774] hover:text-[#37352F] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meal Plan
          </Link>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
