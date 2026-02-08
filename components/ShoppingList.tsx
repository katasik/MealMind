'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Check, Loader2, Send, RefreshCw } from 'lucide-react';
import { cn, getCategoryIcon } from '@/lib/utils';
import { getShoppingListApi, createShoppingList, updateShoppingItem, sendShoppingListToTelegram } from '@/lib/api';
import { getTelegramChat } from '@/lib/firebase';
import type { ShoppingList as ShoppingListType, ShoppingItem } from '@/lib/types';

interface ShoppingListProps {
  mealPlanId: string;
  familyId: string;
}

export default function ShoppingList({ mealPlanId, familyId }: ShoppingListProps) {
  const [shoppingList, setShoppingList] = useState<ShoppingListType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'success' | 'error' | 'no-chat'>('idle');

  useEffect(() => {
    loadShoppingList();
  }, [mealPlanId]);

  const loadShoppingList = async () => {
    setIsLoading(true);
    try {
      const response = await getShoppingListApi(mealPlanId);
      if (response.success) {
        setShoppingList(response.shoppingList || null);
      }
    } catch (err) {
      console.error('Failed to load shopping list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await createShoppingList(mealPlanId);
      if (response.success && response.shoppingList) {
        setShoppingList(response.shoppingList);
      }
    } catch (err) {
      console.error('Failed to generate shopping list:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (!shoppingList) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));

    // Optimistic update
    setShoppingList({
      ...shoppingList,
      items: shoppingList.items.map((item) =>
        item.id === itemId ? { ...item, checked } : item
      ),
    });

    try {
      await updateShoppingItem(shoppingList.id, itemId, checked);
    } catch (err) {
      // Revert on error
      setShoppingList({
        ...shoppingList,
        items: shoppingList.items.map((item) =>
          item.id === itemId ? { ...item, checked: !checked } : item
        ),
      });
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleSendToTelegram = async () => {
    if (!shoppingList) return;

    setIsSendingTelegram(true);
    setTelegramStatus('idle');

    try {
      const chat = await getTelegramChat(familyId);
      if (!chat) {
        setTelegramStatus('no-chat');
        return;
      }

      const result = await sendShoppingListToTelegram(shoppingList.id, chat.chatId);
      if (result.success) {
        setTelegramStatus('success');
        setTimeout(() => setTelegramStatus('idle'), 3000);
      } else {
        setTelegramStatus('error');
      }
    } catch {
      setTelegramStatus('error');
    } finally {
      setIsSendingTelegram(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!shoppingList) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
          <ShoppingCart className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Shopping List Yet</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Generate a shopping list from your meal plan to see all the ingredients you need.
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              <span>Generate Shopping List</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Group items by category
  const groupedItems = shoppingList.items.reduce(
    (acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, ShoppingItem[]>
  );

  const categoryOrder = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'frozen', 'other'];
  const sortedCategories = Object.keys(groupedItems).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const totalItems = shoppingList.items.length;
  const checkedItems = shoppingList.items.filter((i) => i.checked).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Shopping List</h2>
          <p className="text-gray-500">Week of {shoppingList.weekStartDate}</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSendToTelegram}
            disabled={isSendingTelegram}
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isSendingTelegram ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : telegramStatus === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                <span>Sent!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send to Telegram</span>
              </>
            )}
          </button>
        </div>
      </div>

      {telegramStatus === 'no-chat' && (
        <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          No Telegram chat linked. Start a conversation with the MealMind bot on Telegram and send <code className="font-mono bg-amber-100 px-1 rounded">/start</code> to link your chat.
        </p>
      )}
      {telegramStatus === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          Failed to send shopping list. Please try again.
        </p>
      )}

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="bg-primary-500 h-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 text-center">
        {checkedItems} of {totalItems} items checked ({Math.round(progress)}%)
      </p>

      {/* Items by category */}
      <div className="space-y-6">
        {sortedCategories.map((category) => (
          <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 flex items-center space-x-2">
                <span>{getCategoryIcon(category)}</span>
                <span className="capitalize">{category}</span>
                <span className="text-gray-400 text-sm">
                  ({groupedItems[category].length})
                </span>
              </h3>
            </div>

            <ul className="divide-y divide-gray-100">
              {groupedItems[category].map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <label className="flex items-start space-x-3 cursor-pointer group">
                    <div className="flex-shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                        disabled={updatingItems.has(item.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-gray-900 transition-colors',
                          item.checked && 'line-through text-gray-400'
                        )}
                      >
                        {item.amount > 0 && (
                          <span className="font-medium">
                            {item.amount} {item.unit}{' '}
                          </span>
                        )}
                        {item.name}
                      </p>
                      {item.fromRecipes.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          For: {item.fromRecipes.join(', ')}
                        </p>
                      )}
                    </div>
                    {updatingItems.has(item.id) && (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
