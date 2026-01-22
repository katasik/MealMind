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
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[85vh] bg-[#FBFBFA] rounded-lg shadow-xl z-50 overflow-hidden flex flex-col border border-[#E9E9E7]"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-[#E9E9E7]">
              <div className="flex-1 pr-4">
                <span className="text-xs font-medium text-[#787774] uppercase tracking-wide">
                  {meal.mealType}
                </span>
                <h2 className="text-xl font-semibold text-[#37352F] mt-1">{meal.recipeName}</h2>
                {meal.recipeDescription && (
                  <p className="text-[#787774] text-sm mt-1">{meal.recipeDescription}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#F7F6F3] rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#787774]" />
              </button>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-4 px-5 py-3 bg-[#F7F6F3] border-b border-[#E9E9E7] text-sm">
              <div className="flex items-center gap-1.5 text-[#37352F]">
                <Clock className="w-4 h-4 text-[#787774]" />
                <span>Prep: {meal.prepTime}min</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#37352F]">
                <Clock className="w-4 h-4 text-[#787774]" />
                <span>Cook: {meal.cookTime}min</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#37352F]">
                <Users className="w-4 h-4 text-[#787774]" />
                <span>{meal.servings} servings</span>
              </div>
              {meal.difficulty && (
                <div className="flex items-center gap-1.5 text-[#37352F]">
                  <ChefHat className="w-4 h-4 text-[#787774]" />
                  <span className="capitalize">{meal.difficulty}</span>
                </div>
              )}
              {meal.cuisine && (
                <div className="flex items-center gap-1.5 text-[#37352F]">
                  <Globe className="w-4 h-4 text-[#787774]" />
                  <span>{meal.cuisine}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Ingredients */}
                <div>
                  <h3 className="font-medium text-[#37352F] mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    Ingredients
                  </h3>
                  <ul className="space-y-2">
                    {(meal.ingredients || []).map((ing, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-[#37352F] rounded-full mt-2 flex-shrink-0 opacity-40" />
                        <span className="text-[#37352F]">
                          <span className="font-medium">{ing.amount} {ing.unit}</span>{' '}
                          {ing.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="font-medium text-[#37352F] mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    Instructions
                  </h3>
                  <ol className="space-y-3">
                    {(meal.instructions || []).map((step, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span className="w-5 h-5 bg-[#F7F6F3] text-[#787774] rounded flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-[#37352F]">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E9E9E7]">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
