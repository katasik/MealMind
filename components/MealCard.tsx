'use client';

import { Clock, Users, RefreshCw, ChefHat, UtensilsCrossed } from 'lucide-react';
import { getTotalTime } from '@/lib/utils';
import type { PlannedMeal } from '@/lib/types';

interface MealCardProps {
  meal: PlannedMeal;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onClick?: () => void;
}

const mealTypeConfig: Record<string, { bg: string; text: string; accent: string; label: string; emoji: string }> = {
  breakfast: { bg: 'bg-amber-50', text: 'text-amber-700', accent: 'border-amber-200', label: 'Breakfast', emoji: '🌅' },
  lunch:     { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'border-emerald-200', label: 'Lunch', emoji: '☀️' },
  dinner:    { bg: 'bg-violet-50', text: 'text-violet-700', accent: 'border-violet-200', label: 'Dinner', emoji: '🌙' },
  snack:     { bg: 'bg-purple-50', text: 'text-purple-700', accent: 'border-purple-200', label: 'Snack', emoji: '🍎' },
};

export default function MealCard({ meal, onRegenerate, isRegenerating, onClick }: MealCardProps) {
  const totalTime = getTotalTime(meal.prepTimeMinutes, meal.cookTimeMinutes);
  const style = mealTypeConfig[meal.mealType] || mealTypeConfig.dinner;
  const ingredientCount = meal.ingredients?.length || 0;
  const stepCount = meal.instructions?.length || 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all flex flex-col ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Header with meal type accent */}
      <div className={`px-4 pt-4 pb-3 ${style.bg} border-b ${style.accent}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{style.emoji}</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${style.text}`}>
              {style.label}
            </span>
          </div>
          {meal.cuisine && (
            <span className="text-[11px] font-medium text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">
              {meal.cuisine}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-[15px] leading-snug mb-1.5 line-clamp-2">
          {meal.recipeName}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2 flex-1">
          {meal.recipeDescription || 'A delicious recipe to try!'}
        </p>

        {/* Recipe details grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{totalTime}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{meal.servings} servings</span>
          </div>
          {ingredientCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <UtensilsCrossed className="w-3.5 h-3.5 text-gray-400" />
              <span>{ingredientCount} ingredients</span>
            </div>
          )}
          {stepCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ChefHat className="w-3.5 h-3.5 text-gray-400" />
              <span>{stepCount} steps</span>
            </div>
          )}
        </div>

        {/* Top ingredients preview */}
        {ingredientCount > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {meal.ingredients.slice(0, 4).map((ing, i) => (
              <span
                key={i}
                className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded"
              >
                {ing.name}
              </span>
            ))}
            {ingredientCount > 4 && (
              <span className="text-[10px] font-medium text-gray-400 px-1 py-0.5">
                +{ingredientCount - 4} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        {onRegenerate && (
          <div className="flex justify-end items-center pt-2.5 border-t border-gray-100 mt-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={isRegenerating}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                isRegenerating
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Generate different meal"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Swap</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
