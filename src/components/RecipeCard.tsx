'use client';

import { motion } from 'framer-motion';
import { Clock, Users, ChefHat, Trash2 } from 'lucide-react';
import type { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  onView: (recipe: Recipe) => void;
  onDelete?: (recipeId: string) => void;
  canDelete?: boolean;
}

export default function RecipeCard({ recipe, onView, onDelete, canDelete }: RecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const difficultyColor = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700'
  }[recipe.difficulty] || 'bg-gray-100 text-gray-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onView(recipe)}
    >
      {/* Header with cuisine badge */}
      <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-3">
        <div className="flex justify-between items-start">
          <span className="text-white text-xs font-medium px-2 py-1 bg-white/20 rounded-full">
            {recipe.cuisine || 'Various'}
          </span>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColor}`}>
            {recipe.difficulty}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
          {recipe.name}
        </h3>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {recipe.description || 'A delicious recipe to try!'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{totalTime} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ChefHat className="w-3 h-3" />
            <span>{recipe.addedByUserName || 'Unknown'}</span>
          </div>
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(recipe.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Delete recipe"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
