'use client';

import { motion } from 'framer-motion';
import type { DayPlan, MealType } from '@/types';
import MealCard from './MealCard';

interface DayColumnProps {
  day: DayPlan;
  dayIndex: number;
  isToday: boolean;
  isDraft: boolean;
  onRegenerateMeal: (dayIndex: number, mealType: MealType) => void;
  onSelectFromSaved: (dayIndex: number, mealType: MealType) => void;
  onViewRecipe: (dayIndex: number, mealType: MealType) => void;
  regeneratingMeal?: { dayIndex: number; mealType: MealType } | null;
}

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function DayColumn({
  day,
  dayIndex,
  isToday,
  isDraft,
  onRegenerateMeal,
  onSelectFromSaved,
  onViewRecipe,
  regeneratingMeal
}: DayColumnProps) {
  // Format date for display
  const date = new Date(day.date);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Sort meals by type order
  const sortedMeals = [...day.meals].sort(
    (a, b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.05 }}
      className={`flex flex-col w-[220px] flex-shrink-0 ${
        isToday ? 'ring-2 ring-[#2383E2] ring-offset-2' : ''
      } bg-white rounded-lg border border-[#E9E9E7] overflow-hidden`}
    >
      {/* Day Header - Notion style */}
      <div className={`px-3 py-2.5 text-center border-b border-[#E9E9E7] ${
        isToday ? 'bg-[#E8F0FE]' : 'bg-[#F7F6F3]'
      }`}>
        <div className={`font-medium text-sm ${isToday ? 'text-[#2383E2]' : 'text-[#37352F]'}`}>
          {day.dayName}
        </div>
        <div className={`text-xs ${isToday ? 'text-[#2383E2]/70' : 'text-[#787774]'}`}>
          {dateStr}
        </div>
      </div>

      {/* Meals */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px] bg-[#FBFBFA]">
        {sortedMeals.length > 0 ? (
          sortedMeals.map((meal) => (
            <MealCard
              key={`${day.date}-${meal.mealType}`}
              meal={meal}
              isDraft={isDraft}
              isRegenerating={
                regeneratingMeal?.dayIndex === dayIndex &&
                regeneratingMeal?.mealType === meal.mealType
              }
              onRegenerateClick={() => onRegenerateMeal(dayIndex, meal.mealType)}
              onSelectFromSaved={() => onSelectFromSaved(dayIndex, meal.mealType)}
              onViewRecipe={() => onViewRecipe(dayIndex, meal.mealType)}
            />
          ))
        ) : (
          <div className="text-center text-[#787774] text-sm py-4">
            No meals planned
          </div>
        )}
      </div>
    </motion.div>
  );
}
