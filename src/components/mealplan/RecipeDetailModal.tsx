'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, ChefHat, Globe } from 'lucide-react';
import type { PlannedMeal } from '@/types';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: PlannedMeal | null;
}

export default function RecipeDetailModal({ isOpen, onClose, meal }: RecipeDetailModalProps) {
  if (!meal) return null;

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
              className="w-full max-w-2xl max-h-[85vh] bg-[#F9FAFB] rounded-lg shadow-xl overflow-hidden flex flex-col border border-[#E5E7EB]"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-[#E5E7EB]">
                <div className="flex-1 pr-4">
                  <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                    {meal.mealType}
                  </span>
                  <h2 className="text-xl font-semibold text-[#1F2937] mt-1">{meal.recipeName}</h2>
                  {meal.recipeDescription && (
                    <p className="text-[#6B7280] text-sm mt-1">{meal.recipeDescription}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[#F3F4F6] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

            {/* Meta Info */}
            <div className="flex items-center gap-4 px-5 py-3 bg-[#F3F4F6] border-b border-[#E5E7EB] text-sm">
              <div className="flex items-center gap-1.5 text-[#1F2937]">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>Prep: {meal.prepTime}min</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#1F2937]">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>Cook: {meal.cookTime}min</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#1F2937]">
                <Users className="w-4 h-4 text-[#6B7280]" />
                <span>{meal.servings} servings</span>
              </div>
              {meal.difficulty && (
                <div className="flex items-center gap-1.5 text-[#1F2937]">
                  <ChefHat className="w-4 h-4 text-[#6B7280]" />
                  <span className="capitalize">{meal.difficulty}</span>
                </div>
              )}
              {meal.cuisine && (
                <div className="flex items-center gap-1.5 text-[#1F2937]">
                  <Globe className="w-4 h-4 text-[#6B7280]" />
                  <span>{meal.cuisine}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Ingredients */}
                <div>
                  <h3 className="font-medium text-[#1F2937] mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    Ingredients
                  </h3>
                  <ul className="space-y-2">
                    {(meal.ingredients || []).map((ing, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-[#1F2937] rounded-full mt-2 flex-shrink-0 opacity-40" />
                        <span className="text-[#1F2937]">
                          <span className="font-medium">{ing.amount} {ing.unit}</span>{' '}
                          {ing.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="font-medium text-[#1F2937] mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    Instructions
                  </h3>
                  <ol className="space-y-3">
                    {(meal.instructions || []).map((step, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span className="w-5 h-5 bg-[#F3F4F6] text-[#6B7280] rounded flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-[#1F2937]">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#E5E7EB]">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
