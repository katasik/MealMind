'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, ExternalLink, Trash2 } from 'lucide-react';
import { getTotalTime } from '@/lib/utils';
import type { Recipe } from '@/lib/types';

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onDelete?: () => void;
  onUse?: (recipe: Recipe) => void;
  canDelete?: boolean;
}

const difficultyStyles = {
  easy: 'bg-[#DBEDDB] text-[#1E7C45]',
  medium: 'bg-[#FDF0D5] text-[#B4540A]',
  hard: 'bg-[#FDEBEC] text-[#EB5757]'
};

const mealTypeStyles = {
  breakfast: 'bg-[#FAEBDD] text-[#B4540A]',
  lunch: 'bg-[#DBEDDB] text-[#2B7A6C]',
  dinner: 'bg-[#F5E0E9] text-[#B35F2A]',
  snack: 'bg-[#E8DEEE] text-[#6940A5]'
};

export default function RecipeModal({
  recipe,
  onClose,
  onDelete,
  onUse,
  canDelete
}: RecipeModalProps) {
  const totalTime = getTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15 }}
          className="bg-[#F9FAFB] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E5E7EB]"
        >
          {/* Image */}
          {recipe.imageUrl && (
            <div className="h-48 w-full bg-[#F3F4F6] overflow-hidden relative flex-shrink-0">
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-white rounded-md transition-colors shadow-sm"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className={`flex items-start justify-between p-5 border-b border-[#E5E7EB] ${recipe.imageUrl ? '' : ''}`}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                {recipe.cuisine && (
                  <span className="text-xs font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
                    {recipe.cuisine}
                  </span>
                )}
                {recipe.difficulty && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${difficultyStyles[recipe.difficulty] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {recipe.difficulty}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-[#1F2937]">{recipe.name}</h2>
              {recipe.description && (
                <p className="text-[#6B7280] text-sm mt-1">{recipe.description}</p>
              )}
            </div>
            {!recipe.imageUrl && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#F3F4F6] rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 px-5 py-3 bg-[#F3F4F6] border-b border-[#E5E7EB] text-sm flex-wrap">
            <div className="flex items-center gap-1.5 text-[#1F2937]">
              <Clock className="w-4 h-4 text-[#6B7280]" />
              <span>
                <strong>{totalTime}</strong> min
                {recipe.prepTimeMinutes && recipe.prepTimeMinutes > 0 && recipe.cookTimeMinutes && recipe.cookTimeMinutes > 0 && (
                  <span className="text-[#6B7280] ml-1">
                    ({recipe.prepTimeMinutes} prep + {recipe.cookTimeMinutes} cook)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#1F2937]">
              <Users className="w-4 h-4 text-[#6B7280]" />
              <span><strong>{recipe.servings ?? '-'}</strong> servings</span>
            </div>
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="text-xs">Source</span>
              </a>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {recipe.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-[#F3F4F6] text-[#6B7280] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Meal Types */}
            {recipe.mealTypes && recipe.mealTypes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {recipe.mealTypes.map((type) => (
                  <span
                    key={type}
                    className={`text-xs font-medium px-2.5 py-1 rounded capitalize ${mealTypeStyles[type] || 'bg-[#F3F4F6] text-[#6B7280]'}`}
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div className="mb-6">
              <h3 className="font-medium text-[#1F2937] mb-3 text-sm uppercase tracking-wide">
                Ingredients
              </h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 bg-[#1F2937] rounded-full mt-2 flex-shrink-0 opacity-40" />
                    <span className="text-[#1F2937]">
                      {ing.amount && ing.amount > 0 && (
                        <>
                          <span className="font-medium">{ing.amount} {ing.unit}</span>{' '}
                        </>
                      )}
                      {ing.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div className="mb-6">
              <h3 className="font-medium text-[#1F2937] mb-3 text-sm uppercase tracking-wide">
                Instructions
              </h3>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-5 h-5 bg-[#F3F4F6] text-[#6B7280] rounded flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[#1F2937]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-3 flex-shrink-0">
            {onUse ? (
              <button
                onClick={() => onUse(recipe)}
                className="flex-1 py-2.5 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
              >
                Use This Recipe
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
              >
                Close
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={onDelete}
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
