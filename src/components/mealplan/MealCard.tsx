'use client';

import { Clock, RefreshCw, ChefHat, Utensils, BookOpen } from 'lucide-react';
import type { PlannedMeal, MealType } from '@/types';

interface MealCardProps {
  meal: PlannedMeal;
  onRegenerateClick?: () => void;
  onSelectFromSaved?: () => void;
  onViewRecipe?: () => void;
  isDraft: boolean;
  isRegenerating?: boolean;
}

// Notion-like subtle color scheme for meal types
const mealTypeColors: Record<MealType, { bg: string; text: string; badge: string }> = {
  breakfast: { bg: 'bg-[#FDF0D5]', text: 'text-[#B4540A]', badge: 'bg-[#FAEBDD]' },
  lunch: { bg: 'bg-[#DDEDEA]', text: 'text-[#2B7A6C]', badge: 'bg-[#DBEDDB]' },
  dinner: { bg: 'bg-[#FADEC9]', text: 'text-[#B35F2A]', badge: 'bg-[#F5E0E9]' },
  snack: { bg: 'bg-[#E8DEEE]', text: 'text-[#6940A5]', badge: 'bg-[#E8DEEE]' }
};

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
};

export default function MealCard({
  meal,
  onRegenerateClick,
  onSelectFromSaved,
  onViewRecipe,
  isDraft,
  isRegenerating = false
}: MealCardProps) {
  const colors = mealTypeColors[meal.mealType];
  const totalTime = meal.prepTime + meal.cookTime;

  return (
    <div
      className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden cursor-pointer hover:border-[#D3D3D0] hover:shadow-sm transition-all h-[200px] flex flex-col"
      onClick={onViewRecipe}
    >
      {/* Image */}
      {meal.imageUrl ? (
        <div className="h-[70px] w-full bg-[#F7F6F3] overflow-hidden flex-shrink-0">
          <img
            src={meal.imageUrl}
            alt={meal.recipeName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-[70px] w-full bg-gradient-to-br from-[#F7F6F3] to-[#E9E9E7] flex items-center justify-center flex-shrink-0">
          <span className="text-2xl opacity-50">🍽️</span>
        </div>
      )}

      <div className="p-2.5 flex flex-col flex-1">
        {/* Meal Type Badge & Actions */}
        <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
          <span className={`text-[9px] font-medium ${colors.text} ${colors.badge} px-1.5 py-0.5 rounded uppercase tracking-wide`}>
            {mealTypeLabels[meal.mealType]}
          </span>
          {isDraft && (
            <div className="flex items-center gap-0.5">
              {onSelectFromSaved && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFromSaved();
                  }}
                  className="p-1 hover:bg-[#F7F6F3] rounded transition-colors"
                  title="Choose from saved recipes"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#787774]" />
                </button>
              )}
              {onRegenerateClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerateClick();
                  }}
                  disabled={isRegenerating}
                  className="p-1 hover:bg-[#F7F6F3] rounded transition-colors disabled:opacity-50"
                  title="AI suggestion"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#787774] ${isRegenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recipe Name */}
        <h4 className="font-medium text-[#37352F] text-sm leading-tight line-clamp-2 flex-shrink-0">
          {meal.recipeName}
        </h4>

        {/* Description */}
        <p className="text-[11px] text-[#787774] line-clamp-1 mt-1 flex-1">
          {meal.recipeDescription || 'A delicious meal'}
        </p>

        {/* Meta Info */}
        <div className="flex items-center gap-2 text-[10px] text-[#787774] flex-shrink-0 mt-auto pt-1">
          <div className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            <span>{totalTime}m</span>
          </div>
          {meal.difficulty && (
            <div className="flex items-center gap-0.5">
              <ChefHat className="w-3 h-3" />
              <span className="capitalize">{meal.difficulty}</span>
            </div>
          )}
          {meal.servings && (
            <div className="flex items-center gap-0.5">
              <Utensils className="w-3 h-3" />
              <span>{meal.servings}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
