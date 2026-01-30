'use client';

import { Clock, RefreshCw, ChefHat, Utensils, BookOpen, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import type { PlannedMeal, MealType } from '@/types';

interface MealCardProps {
  meal: PlannedMeal;
  dayIndex: number;
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
  dayIndex,
  onRegenerateClick,
  onSelectFromSaved,
  onViewRecipe,
  isDraft,
  isRegenerating = false
}: MealCardProps) {
  const colors = mealTypeColors[meal.mealType];
  const totalTime = meal.prepTime + meal.cookTime;

  // Make this card draggable only if in draft mode
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${dayIndex}-${meal.mealType}`,
    disabled: !isDraft,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`bg-white border border-[#E5E7EB] rounded-lg overflow-hidden hover:border-[#D3D3D0] hover:shadow-md transition-all h-[220px] flex flex-col cursor-pointer ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      onClick={onViewRecipe}
    >
      {/* Image */}
      <div
        className="h-[80px] w-full bg-[#F3F4F6] overflow-hidden flex-shrink-0 cursor-pointer relative"
        onClick={(e) => {
          e.stopPropagation();
          onViewRecipe?.();
        }}
      >
        {meal.imageUrl ? (
          <img
            src={meal.imageUrl}
            alt={meal.recipeName}
            className="w-full h-full object-cover pointer-events-none"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center ${meal.imageUrl ? 'hidden' : ''}`}>
          <span className="text-3xl opacity-40 pointer-events-none">🍽️</span>
        </div>
      </div>

      <div className="p-2.5 flex flex-col flex-1">
        {/* Meal Type Badge & Actions */}
        <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {isDraft && (
              <div
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-[#F3F4F6] rounded touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                title="Drag to reorder"
                style={{ minWidth: '24px', minHeight: '24px' }}
              >
                <GripVertical className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </div>
            )}
            <span className={`text-[9px] font-medium ${colors.text} ${colors.badge} px-1.5 py-0.5 rounded uppercase tracking-wide`}>
              {mealTypeLabels[meal.mealType]}
            </span>
          </div>
          {isDraft && (
            <div className="flex items-center gap-0.5">
              {onSelectFromSaved && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFromSaved();
                  }}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  title="Choose from saved recipes"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#6B7280]" />
                </button>
              )}
              {onRegenerateClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerateClick();
                  }}
                  disabled={isRegenerating}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors disabled:opacity-50"
                  title="AI suggestion"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${isRegenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recipe Name */}
        <h4
          className="font-medium text-[#1F2937] text-sm leading-tight line-clamp-2 flex-shrink-0 cursor-pointer hover:text-[#0EA5E9]"
          onClick={(e) => {
            e.stopPropagation();
            onViewRecipe?.();
          }}
        >
          {meal.recipeName}
        </h4>

        {/* Description */}
        <p
          className="text-[11px] text-[#6B7280] line-clamp-1 mt-1 flex-1 cursor-pointer hover:text-[#1F2937]"
          onClick={(e) => {
            e.stopPropagation();
            onViewRecipe?.();
          }}
        >
          {meal.recipeDescription || 'A delicious meal'}
        </p>

        {/* Meta Info */}
        <div className="flex items-center gap-2 text-[10px] text-[#6B7280] flex-shrink-0 mt-auto pt-1">
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
