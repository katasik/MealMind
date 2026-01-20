'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Loader2, Check, AlertCircle } from 'lucide-react';

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
}

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipes: ParsedRecipe[]) => Promise<void>;
}

export default function AddRecipeModal({ isOpen, onClose, onSave }: AddRecipeModalProps) {
  const [mode, setMode] = useState<'select' | 'text' | 'pdf'>('select');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setMode('select');
    setText('');
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
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Add Recipe</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {parsedRecipes.length === 0 ? (
              // Input mode
              <>
                {mode === 'select' && (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-center mb-6">
                      How would you like to add your recipe?
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setMode('text')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors"
                      >
                        <FileText className="w-10 h-10 text-orange-500" />
                        <span className="font-medium text-gray-700">Paste Text</span>
                        <span className="text-xs text-gray-500 text-center">
                          Copy and paste recipe text
                        </span>
                      </button>
                      <button
                        onClick={() => setMode('pdf')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors"
                      >
                        <Upload className="w-10 h-10 text-orange-500" />
                        <span className="font-medium text-gray-700">Upload PDF</span>
                        <span className="text-xs text-gray-500 text-center">
                          Import from PDF file
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'text' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setMode('select')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      &larr; Back
                    </button>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your recipe text here...&#10;&#10;Include the recipe name, ingredients, and instructions."
                      className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none"
                    />
                    <button
                      onClick={parseText}
                      disabled={loading || !text.trim()}
                      className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                      className="text-sm text-gray-500 hover:text-gray-700"
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
                      className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-orange-400 hover:bg-orange-50 cursor-pointer transition-colors"
                    >
                      {loading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                          <span className="text-gray-600">Processing PDF...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium">
                            Click to upload PDF
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
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
                  <h3 className="font-semibold text-gray-900">
                    Found {parsedRecipes.length} recipe{parsedRecipes.length > 1 ? 's' : ''}
                  </h3>
                  <button
                    onClick={() => {
                      setParsedRecipes([]);
                      setSelectedRecipes(new Set());
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    &larr; Start over
                  </button>
                </div>

                <p className="text-sm text-gray-600">
                  Select the recipes you want to save:
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {parsedRecipes.map((recipe, index) => (
                    <div
                      key={index}
                      onClick={() => toggleRecipe(index)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                        selectedRecipes.has(index)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selectedRecipes.has(index)
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {selectedRecipes.has(index) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900">{recipe.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                            {recipe.description}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>{recipe.prepTime + recipe.cookTime} min</span>
                            <span>{recipe.servings} servings</span>
                            <span>{recipe.cuisine}</span>
                            <span className="capitalize">{recipe.difficulty}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
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
            <div className="px-6 py-4 border-t bg-gray-50">
              <button
                onClick={handleSave}
                disabled={saving || selectedRecipes.size === 0}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
