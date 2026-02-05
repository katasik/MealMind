'use client';

import { Clock, Users, RefreshCw } from 'lucide-react';
import { getTotalTime } from '@/lib/utils';
import type { PlannedMeal } from '@/lib/types';

interface MealCardProps {
  meal: PlannedMeal;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onClick?: () => void;
}

const mealTypeStyles = {
  breakfast: 'bg-[#FAEBDD] text-[#B4540A]',
  lunch: 'bg-[#DBEDDB] text-[#2B7A6C]',
  dinner: 'bg-[#F5E0E9] text-[#B35F2A]',
  snack: 'bg-[#E8DEEE] text-[#6940A5]'
};

export default function MealCard({ meal, onRegenerate, isRegenerating, onClick }: MealCardProps) {
  const totalTime = getTotalTime(meal.prepTimeMinutes, meal.cookTimeMinutes);

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E5E7EB] rounded-lg overflow-hidden hover:border-[#1F2937] hover:shadow-sm transition-all flex flex-col ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Image */}
      <div className="h-40 w-full bg-[#F3F4F6] overflow-hidden relative">
        {meal.imageUrl ? (
          <img
            src={meal.imageUrl}
            alt={meal.recipeName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const placeholder = e.currentTarget.nextElementSibling;
              if (placeholder) {
                placeholder.classList.remove('hidden');
              }
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center ${meal.imageUrl ? 'hidden' : ''}`}>
          <span className="text-5xl opacity-40">🍽️</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Tags row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {meal.cuisine && (
            <span className="text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
              {meal.cuisine}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${mealTypeStyles[meal.mealType] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
            {meal.mealType}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[#1F2937] mb-1 line-clamp-2">
          {meal.recipeName}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#6B7280] mb-3 line-clamp-2 flex-1">
          {meal.recipeDescription || 'A delicious recipe to try!'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{meal.servings}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center pt-3 border-t border-[#E5E7EB] mt-auto">
          {onRegenerate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={isRegenerating}
              className={`p-1.5 rounded transition-colors ${
                isRegenerating
                  ? 'text-[#9CA3AF] cursor-not-allowed'
                  : 'text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6]'
              }`}
              title="Generate different meal"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
