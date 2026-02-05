'use client';

import { Clock, Users, Trash2 } from 'lucide-react';
import { getTotalTime } from '@/lib/utils';
import type { Recipe } from '@/lib/types';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
  onClick?: () => void;
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

export default function RecipeCard({ recipe, onDelete, onClick }: RecipeCardProps) {
  const totalTime = getTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes);

  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-lg overflow-hidden hover:border-[#1F2937] hover:shadow-sm transition-all flex flex-col ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Image */}
      <div className="h-40 w-full bg-[#F3F4F6] overflow-hidden relative">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const placeholder = e.currentTarget.nextElementSibling;
              if (placeholder) {
                placeholder.classList.remove('hidden');
              }
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center ${recipe.imageUrl ? 'hidden' : ''}`}>
          <span className="text-5xl opacity-40">🍽️</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Tags row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {recipe.cuisine && (
            <span className="text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
              {recipe.cuisine}
            </span>
          )}
          {recipe.difficulty && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${difficultyStyles[recipe.difficulty] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
              {recipe.difficulty}
            </span>
          )}
          {recipe.mealTypes && recipe.mealTypes.slice(0, 2).map((type) => (
            <span key={type} className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${mealTypeStyles[type] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
              {type}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[#1F2937] mb-1 line-clamp-2">
          {recipe.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#6B7280] mb-3 line-clamp-2 flex-1">
          {recipe.description || 'A delicious recipe to try!'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{recipe.servings ?? '-'}</span>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded">
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#9CA3AF] rounded">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end items-center pt-3 border-t border-[#E5E7EB] mt-auto">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 text-[#6B7280] hover:text-[#EB5757] hover:bg-[#FDEBEC] rounded transition-colors"
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
