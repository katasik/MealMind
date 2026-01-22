'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Loader2, Check, AlertCircle, Globe } from 'lucide-react';

interface ParsedRecipe {
  name: string;
  description: string;
  ingredients: Array<{ name: string; amount: string; unit: string; category?: string }>;
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  imageUrl?: string;
  sourceUrl?: string;
}

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipes: ParsedRecipe[]) => Promise<void>;
}

export default function AddRecipeModal({ isOpen, onClose, onSave }: AddRecipeModalProps) {
  const [mode, setMode] = useState<'select' | 'text' | 'pdf' | 'url'>('select');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setMode('select');
    setText('');
    setUrl('');
    setLoading(false);
    setError(null);
    setParsedRecipes([]);
    setSelectedRecipes(new Set());
    setSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseText = async () => {
    if (!text.trim()) {
      setError('Please paste some recipe text');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipes');
      }

      setParsedRecipes(data.recipes);
      setSelectedRecipes(new Set(data.recipes.map((_: ParsedRecipe, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse recipes');
    } finally {
      setLoading(false);
    }
  };

  const parseUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a recipe URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/recipe)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipe from URL');
      }

      setParsedRecipes(data.recipes);
      setSelectedRecipes(new Set(data.recipes.map((_: ParsedRecipe, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse recipe from URL');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum size is 100MB');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/recipes/parse', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse PDF');
      }

      setParsedRecipes(data.recipes);
      setSelectedRecipes(new Set(data.recipes.map((_: ParsedRecipe, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipe = (index: number) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRecipes(newSelected);
  };

  const handleSave = async () => {
    const recipesToSave = parsedRecipes.filter((_, i) => selectedRecipes.has(i));
    if (recipesToSave.length === 0) {
      setError('Please select at least one recipe to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(recipesToSave);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipes');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E9E9E7]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
            <h2 className="text-xl font-semibold text-[#37352F]">Add Recipe</h2>
            <button
              onClick={handleClose}
              className="p-2 text-[#787774] hover:text-[#37352F] hover:bg-[#F7F6F3] rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-[#FDEBEC] border border-[#EB5757]/20 rounded-md flex items-center gap-2 text-[#EB5757]">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {parsedRecipes.length === 0 ? (
              // Input mode
              <>
                {mode === 'select' && (
                  <div className="space-y-4">
                    <p className="text-[#787774] text-center mb-6">
                      How would you like to add your recipe?
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => setMode('url')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-[#E9E9E7] rounded-lg hover:border-[#37352F] hover:bg-[#F7F6F3] transition-colors"
                      >
                        <Globe className="w-10 h-10 text-[#37352F]" />
                        <span className="font-medium text-[#37352F]">From URL</span>
                        <span className="text-xs text-[#787774] text-center">
                          Paste a recipe link
                        </span>
                      </button>
                      <button
                        onClick={() => setMode('text')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-[#E9E9E7] rounded-lg hover:border-[#37352F] hover:bg-[#F7F6F3] transition-colors"
                      >
                        <FileText className="w-10 h-10 text-[#37352F]" />
                        <span className="font-medium text-[#37352F]">Paste Text</span>
                        <span className="text-xs text-[#787774] text-center">
                          Copy and paste recipe
                        </span>
                      </button>
                      <button
                        onClick={() => setMode('pdf')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-[#E9E9E7] rounded-lg hover:border-[#37352F] hover:bg-[#F7F6F3] transition-colors"
                      >
                        <Upload className="w-10 h-10 text-[#37352F]" />
                        <span className="font-medium text-[#37352F]">Upload PDF</span>
                        <span className="text-xs text-[#787774] text-center">
                          Import from PDF file
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'url' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setMode('select')}
                      className="text-sm text-[#787774] hover:text-[#37352F]"
                    >
                      &larr; Back
                    </button>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[#37352F]">
                        Recipe URL
                      </label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/recipe/delicious-pasta"
                        className="w-full p-4 border border-[#E9E9E7] rounded-md focus:border-[#37352F] focus:outline-none text-[#37352F] placeholder:text-[#9B9A97]"
                      />
                      <p className="text-xs text-[#787774]">
                        Paste a link to any recipe page. We&apos;ll extract the recipe details automatically.
                      </p>
                    </div>
                    <button
                      onClick={parseUrl}
                      disabled={loading || !url.trim()}
                      className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Fetching recipe...
                        </>
                      ) : (
                        <>
                          <Globe className="w-5 h-5" />
                          Import from URL
                        </>
                      )}
                    </button>
                  </div>
                )}

                {mode === 'text' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setMode('select')}
                      className="text-sm text-[#787774] hover:text-[#37352F]"
                    >
                      &larr; Back
                    </button>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your recipe text here...&#10;&#10;Include the recipe name, ingredients, and instructions."
                      className="w-full h-64 p-4 border border-[#E9E9E7] rounded-md focus:border-[#37352F] focus:outline-none resize-none text-[#37352F] placeholder:text-[#9B9A97]"
                    />
                    <button
                      onClick={parseText}
                      disabled={loading || !text.trim()}
                      className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        'Parse Recipe'
                      )}
                    </button>
                  </div>
                )}

                {mode === 'pdf' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setMode('select')}
                      className="text-sm text-[#787774] hover:text-[#37352F]"
                    >
                      &larr; Back
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#E9E9E7] rounded-lg p-12 text-center hover:border-[#37352F] hover:bg-[#F7F6F3] cursor-pointer transition-colors"
                    >
                      {loading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-12 h-12 text-[#37352F] animate-spin" />
                          <span className="text-[#787774]">Processing PDF...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-[#787774] mx-auto mb-4" />
                          <p className="text-[#37352F] font-medium">
                            Click to upload PDF
                          </p>
                          <p className="text-sm text-[#787774] mt-2">
                            Maximum file size: 100MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Preview mode
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#37352F]">
                    Found {parsedRecipes.length} recipe{parsedRecipes.length > 1 ? 's' : ''}
                  </h3>
                  <button
                    onClick={() => {
                      setParsedRecipes([]);
                      setSelectedRecipes(new Set());
                    }}
                    className="text-sm text-[#787774] hover:text-[#37352F]"
                  >
                    &larr; Start over
                  </button>
                </div>

                <p className="text-sm text-[#787774]">
                  Select the recipes you want to save:
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {parsedRecipes.map((recipe, index) => (
                    <div
                      key={index}
                      onClick={() => toggleRecipe(index)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRecipes.has(index)
                          ? 'border-[#37352F] bg-[#F7F6F3]'
                          : 'border-[#E9E9E7] hover:border-[#D3D3D0]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selectedRecipes.has(index)
                              ? 'border-[#37352F] bg-[#37352F]'
                              : 'border-[#D3D3D0]'
                          }`}
                        >
                          {selectedRecipes.has(index) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        {/* Recipe Image */}
                        {recipe.imageUrl ? (
                          <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-[#F7F6F3]">
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-[#F7F6F3] flex items-center justify-center flex-shrink-0">
                            <span className="text-xl opacity-40">🍽️</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[#37352F]">{recipe.name}</h4>
                          <p className="text-sm text-[#787774] line-clamp-2 mt-1">
                            {recipe.description}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-[#787774]">
                            <span>{recipe.prepTime + recipe.cookTime} min</span>
                            <span>{recipe.servings} servings</span>
                            <span>{recipe.cuisine}</span>
                            <span className="capitalize">{recipe.difficulty}</span>
                          </div>
                          <div className="text-xs text-[#9B9A97] mt-1">
                            {recipe.ingredients.length} ingredients &bull; {recipe.instructions.length} steps
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {parsedRecipes.length > 0 && (
            <div className="px-6 py-4 border-t border-[#E9E9E7] bg-[#F7F6F3]">
              <button
                onClick={handleSave}
                disabled={saving || selectedRecipes.size === 0}
                className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save ${selectedRecipes.size} Recipe${selectedRecipes.size > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
