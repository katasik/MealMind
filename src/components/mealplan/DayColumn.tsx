'use client';

import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
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

  // Make this column droppable
  const { setNodeRef, isOver } = useDroppable({
    id: `${dayIndex}-day`,
  });

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.05 }}
      className={`flex flex-col w-[260px] flex-shrink-0 ${
        isToday ? 'ring-2 ring-[#0EA5E9]' : ''
      } ${isOver && isDraft ? 'ring-2 ring-[#10B981]' : ''} bg-white rounded-lg border border-[#E5E7EB] overflow-hidden`}
    >
      {/* Day Header - Notion style */}
      <div className={`px-3 py-2.5 text-center border-b border-[#E5E7EB] ${
        isToday ? 'bg-[#E8F0FE]' : 'bg-[#F3F4F6]'
      }`}>
        <div className={`font-medium text-sm ${isToday ? 'text-[#0EA5E9]' : 'text-[#1F2937]'}`}>
          {day.dayName}
        </div>
        <div className={`text-xs ${isToday ? 'text-[#0EA5E9]/70' : 'text-[#6B7280]'}`}>
          {dateStr}
        </div>
      </div>

      {/* Meals */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px] bg-[#F9FAFB]">
        {sortedMeals.length > 0 ? (
          sortedMeals.map((meal) => (
            <MealCard
              key={`${day.date}-${meal.mealType}`}
              meal={meal}
              dayIndex={dayIndex}
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
          <div className="text-center text-[#6B7280] text-sm py-4">
            No meals planned
          </div>
        )}
      </div>
    </motion.div>
  );
}
