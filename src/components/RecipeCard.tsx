'use client';

import { Clock, Users, Trash2 } from 'lucide-react';
import type { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  onView: (recipe: Recipe) => void;
  onDelete?: (recipeId: string) => void;
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

export default function RecipeCard({ recipe, onView, onDelete, canDelete }: RecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div
      onClick={() => onView(recipe)}
      className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden hover:border-[#D3D3D0] hover:shadow-sm transition-all cursor-pointer flex flex-col"
    >
      {/* Image */}
      <div className="h-40 w-full bg-[#F7F6F3] overflow-hidden relative">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image and show placeholder
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#F7F6F3] to-[#E9E9E7] flex items-center justify-center ${recipe.imageUrl ? 'hidden' : ''}`}>
          <span className="text-5xl opacity-40">🍽️</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Tags row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {recipe.cuisine && (
            <span className="text-[10px] font-medium text-[#787774] bg-[#F7F6F3] px-2 py-0.5 rounded">
              {recipe.cuisine}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${difficultyStyles[recipe.difficulty] || 'bg-[#F7F6F3] text-[#787774]'}`}>
            {recipe.difficulty}
          </span>
          {recipe.mealTypes && recipe.mealTypes.slice(0, 2).map((type) => (
            <span key={type} className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${mealTypeStyles[type]}`}>
              {type}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[#37352F] mb-1 line-clamp-2">
          {recipe.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#787774] mb-3 line-clamp-2 flex-1">
          {recipe.description || 'A delicious recipe to try!'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#787774] mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalTime} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{recipe.servings}</span>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-[#F7F6F3] text-[#787774] rounded">
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 bg-[#F7F6F3] text-[#9B9A97] rounded">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-[#E9E9E7] mt-auto">
          <div className="text-[10px] text-[#9B9A97]">
            {recipe.addedByUserName || 'Unknown'}
          </div>
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(recipe.id);
              }}
              className="p-1.5 text-[#9B9A97] hover:text-[#EB5757] hover:bg-[#FDEBEC] rounded transition-colors"
              title="Delete recipe"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
