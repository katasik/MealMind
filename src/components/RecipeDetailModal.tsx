'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, ChefHat, Trash2 } from 'lucide-react';
import type { Recipe } from '@/types';

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (recipeId: string) => void;
  onUse?: (recipe: Recipe) => void;
  canDelete?: boolean;
}

export default function RecipeDetailModal({
  recipe,
  isOpen,
  onClose,
  onDelete,
  onUse,
  canDelete
}: RecipeDetailModalProps) {
  if (!isOpen || !recipe) return null;

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const difficultyColor = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700'
  }[recipe.difficulty] || 'bg-gray-100 text-gray-700';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white text-xs font-medium px-2 py-1 bg-white/20 rounded-full">
                    {recipe.cuisine || 'Various'}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColor}`}>
                    {recipe.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">{recipe.name}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Description */}
            {recipe.description && (
              <p className="text-gray-600 mb-4">{recipe.description}</p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-5 h-5 text-orange-500" />
                <span>
                  <strong>{totalTime}</strong> min total
                  {recipe.prepTime > 0 && recipe.cookTime > 0 && (
                    <span className="text-sm text-gray-400 ml-1">
                      ({recipe.prepTime} prep + {recipe.cookTime} cook)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-5 h-5 text-orange-500" />
                <span><strong>{recipe.servings}</strong> servings</span>
              </div>
              {recipe.addedByUserName && (
                <div className="flex items-center gap-2 text-gray-600">
                  <ChefHat className="w-5 h-5 text-orange-500" />
                  <span>Added by {recipe.addedByUserName}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {recipe.tags.map((tag, i) => (
                  <span key={i} className="text-sm px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div className="mb-6">
              <h3 className="font-bold text-lg text-gray-900 mb-3">Ingredients</h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span className="text-orange-500 mt-1">•</span>
                    <span>
                      <strong>{ing.amount}</strong> {ing.unit} {ing.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div className="mb-6">
              <h3 className="font-bold text-lg text-gray-900 mb-3">Instructions</h3>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Nutritional Info */}
            {recipe.nutritionalInfo && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-900 mb-3">Nutrition (per serving)</h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-orange-600">{recipe.nutritionalInfo.calories}</div>
                    <div className="text-xs text-gray-500">calories</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{recipe.nutritionalInfo.protein}g</div>
                    <div className="text-xs text-gray-500">protein</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{recipe.nutritionalInfo.carbs}g</div>
                    <div className="text-xs text-gray-500">carbs</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{recipe.nutritionalInfo.fat}g</div>
                    <div className="text-xs text-gray-500">fat</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{recipe.nutritionalInfo.fiber}g</div>
                    <div className="text-xs text-gray-500">fiber</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
            {onUse && (
              <button
                onClick={() => onUse(recipe)}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                Use This Recipe
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(recipe.id)}
                className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
