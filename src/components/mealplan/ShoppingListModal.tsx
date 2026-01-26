'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { MealPlanShoppingList, MealPlanShoppingItem } from '@/types';

interface ShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  shoppingList: MealPlanShoppingList | null;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onFinalize: () => void;
  isLoading?: boolean;
}

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

  // Sort items within each category
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => {
      // Checked items go to the bottom
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.ingredientName.localeCompare(b.ingredientName);
    });
  }

  return grouped;
}

export default function ShoppingListModal({
  isOpen,
  onClose,
  shoppingList,
  onToggleItem,
  onFinalize,
  isLoading = false
}: ShoppingListModalProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!shoppingList) return null;

  const groupedItems = groupByCategory(shoppingList.items);
  const categories = Object.keys(groupedItems).sort();

  const totalItems = shoppingList.items.length;
  const checkedItems = shoppingList.items.filter(i => i.checked).length;
  const remainingItems = totalItems - checkedItems;

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg max-h-[85vh] bg-[#FBFBFA] rounded-lg shadow-xl overflow-hidden flex flex-col border border-[#E9E9E7]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#E9E9E7]">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🛒</div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#37352F]">Shopping List</h2>
                    <p className="text-sm text-[#787774]">
                      Check off items you already have
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[#F7F6F3] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-[#787774]" />
                </button>
              </div>

            {/* Progress Bar */}
            <div className="px-5 py-3 bg-[#F7F6F3] border-b border-[#E9E9E7]">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-[#787774]">
                  {checkedItems} of {totalItems} items checked
                </span>
                <span className="font-medium text-[#37352F]">
                  {remainingItems} to buy
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(checkedItems / totalItems) * 100}%` }}
                  className="h-full bg-[#37352F] rounded-full"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {categories.map((category) => {
                const items = groupedItems[category];
                const categoryChecked = items.filter(i => i.checked).length;
                const isExpanded = !expandedCategories.has(category);

                return (
                  <div key={category} className="mb-4">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between py-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#37352F]">{category}</span>
                        <span className="text-xs text-[#787774] bg-[#F7F6F3] px-2 py-0.5 rounded-full">
                          {categoryChecked}/{items.length}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#787774]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#787774]" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <ul className="space-y-1 pl-1">
                            {items.map((item) => (
                              <li key={item.id}>
                                <button
                                  onClick={() => onToggleItem(item.id, !item.checked)}
                                  className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors ${
                                    item.checked
                                      ? 'bg-[#F7F6F3] text-[#787774]'
                                      : 'hover:bg-[#F7F6F3] text-[#37352F]'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                      item.checked
                                        ? 'bg-[#37352F] border-[#37352F]'
                                        : 'border-[#D3D3D0]'
                                    }`}
                                  >
                                    {item.checked && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className={`flex-1 text-left text-sm ${item.checked ? 'line-through' : ''}`}>
                                    <span className="font-medium">{item.amount} {item.unit}</span>{' '}
                                    {item.ingredientName}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#E9E9E7] space-y-2">
                <button
                  onClick={onFinalize}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Finalize Plan ({remainingItems} items to buy)</span>
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 text-[#787774] hover:text-[#37352F] font-medium transition-colors"
                >
                  Continue Editing
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
