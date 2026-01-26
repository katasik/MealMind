'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, Trash2 } from 'lucide-react';
import type { Recipe } from '@/types';

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (recipeId: string) => void;
  onUse?: (recipe: Recipe) => void;
  canDelete?: boolean;
}

const difficultyStyles = {
  easy: 'bg-[#DBEDDB] text-[#1E7C45]',
  medium: 'bg-[#FDF0D5] text-[#B4540A]',
  hard: 'bg-[#FDEBEC] text-[#EB5757]'
};

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15 }}
          className="bg-[#FBFBFA] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E9E9E7]"
        >
          {/* Image */}
          {recipe.imageUrl && (
            <div className="h-48 w-full bg-[#F7F6F3] overflow-hidden relative flex-shrink-0">
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-white rounded-md transition-colors shadow-sm"
              >
                <X className="w-5 h-5 text-[#787774]" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className={`flex items-start justify-between p-5 border-b border-[#E9E9E7] ${recipe.imageUrl ? '' : ''}`}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                {recipe.cuisine && (
                  <span className="text-xs font-medium text-[#787774] bg-[#F7F6F3] px-2 py-0.5 rounded">
                    {recipe.cuisine}
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${difficultyStyles[recipe.difficulty] || 'bg-[#F7F6F3] text-[#787774]'}`}>
                  {recipe.difficulty}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-[#37352F]">{recipe.name}</h2>
              {recipe.description && (
                <p className="text-[#787774] text-sm mt-1">{recipe.description}</p>
              )}
            </div>
            {!recipe.imageUrl && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#F7F6F3] rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#787774]" />
              </button>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 px-5 py-3 bg-[#F7F6F3] border-b border-[#E9E9E7] text-sm flex-wrap">
            <div className="flex items-center gap-1.5 text-[#37352F]">
              <Clock className="w-4 h-4 text-[#787774]" />
              <span>
                <strong>{totalTime}</strong> min
                {recipe.prepTime > 0 && recipe.cookTime > 0 && (
                  <span className="text-[#787774] ml-1">
                    ({recipe.prepTime} prep + {recipe.cookTime} cook)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#37352F]">
              <Users className="w-4 h-4 text-[#787774]" />
              <span><strong>{recipe.servings}</strong> servings</span>
            </div>
            {recipe.addedByUserName && (
              <div className="text-[#787774] text-xs">
                Added by {recipe.addedByUserName}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {recipe.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-[#F7F6F3] text-[#787774] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div className="mb-6">
              <h3 className="font-medium text-[#37352F] mb-3 text-sm uppercase tracking-wide">
                Ingredients
              </h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
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
            <div className="mb-6">
              <h3 className="font-medium text-[#37352F] mb-3 text-sm uppercase tracking-wide">
                Instructions
              </h3>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-5 h-5 bg-[#F7F6F3] text-[#787774] rounded flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[#37352F]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Nutritional Info */}
            {recipe.nutritionalInfo && (
              <div className="bg-[#F7F6F3] rounded-lg p-4 border border-[#E9E9E7]">
                <h3 className="font-medium text-[#37352F] mb-3 text-sm uppercase tracking-wide">
                  Nutrition (per serving)
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold text-[#37352F]">{recipe.nutritionalInfo.calories}</div>
                    <div className="text-[10px] text-[#787774]">calories</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#37352F]">{recipe.nutritionalInfo.protein}g</div>
                    <div className="text-[10px] text-[#787774]">protein</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#37352F]">{recipe.nutritionalInfo.carbs}g</div>
                    <div className="text-[10px] text-[#787774]">carbs</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#37352F]">{recipe.nutritionalInfo.fat}g</div>
                    <div className="text-[10px] text-[#787774]">fat</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#37352F]">{recipe.nutritionalInfo.fiber}g</div>
                    <div className="text-[10px] text-[#787774]">fiber</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#E9E9E7] flex gap-3">
            {onUse && (
              <button
                onClick={() => onUse(recipe)}
                className="flex-1 py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
              >
                Use This Recipe
              </button>
            )}
            {!onUse && (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
              >
                Close
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(recipe.id)}
                className="px-4 py-2.5 text-[#EB5757] hover:bg-[#FDEBEC] rounded-md font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
