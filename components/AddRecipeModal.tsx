'use client';

import { useState, useRef } from 'react';
import { X, Link, FileUp, Type, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseRecipe } from '@/lib/api';
import type { Recipe } from '@/lib/types';

interface AddRecipeModalProps {
  familyId: string;
  onClose: () => void;
  onSuccess: (recipe: Recipe) => void;
}

type SourceType = 'url' | 'pdf' | 'text';

const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB

export default function AddRecipeModal({ familyId, onClose, onSuccess }: AddRecipeModalProps) {
  const [sourceType, setSourceType] = useState<SourceType>('url');
  const [source, setSource] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    passed: boolean;
    hallucinationsDetected: boolean;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PDF_SIZE) {
      setError(`File too large. Maximum size is 5MB (yours: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      setPdfFile(null);
      setPdfBase64(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      setPdfFile(null);
      setPdfBase64(null);
      return;
    }

    setError(null);
    setPdfFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitSource = sourceType === 'pdf' ? pdfBase64 : source.trim();
    if (!submitSource) return;

    setIsLoading(true);
    setError(null);
    setEvaluation(null);

    try {
      const response = await parseRecipe(submitSource, sourceType, familyId);

      if (response.success && response.recipe) {
        setEvaluation(response.evaluation || null);
        onSuccess(response.recipe);
      } else {
        setError(response.error || 'Failed to parse recipe');
        if (response.evaluation) {
          setEvaluation(response.evaluation);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add Recipe</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Source type tabs */}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => { setSourceType('url'); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  sourceType === 'url'
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                )}
              >
                <Link className="w-4 h-4" />
                <span>URL</span>
              </button>
              <button
                type="button"
                onClick={() => { setSourceType('pdf'); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  sourceType === 'pdf'
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                )}
              >
                <FileUp className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => { setSourceType('text'); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  sourceType === 'text'
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                )}
              >
                <Type className="w-4 h-4" />
                <span>Text</span>
              </button>
            </div>

            {/* Input */}
            {sourceType === 'url' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe URL
                </label>
                <input
                  type="url"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="https://example.com/recipe..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Paste a link to any recipe website
                </p>
              </div>
            ) : sourceType === 'pdf' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload PDF
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                    pdfFile
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {pdfFile ? (
                    <div>
                      <FileUp className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">{pdfFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(pdfFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <FileUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Click to upload a PDF recipe</p>
                      <p className="text-xs text-gray-400 mt-1">Max 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe Text
                </label>
                <textarea
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Paste your recipe here..."
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Paste the recipe ingredients and instructions
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Failed to import recipe</p>
                  <p className="text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Evaluation feedback */}
            {evaluation && (
              <div
                className={cn(
                  'p-3 rounded-lg flex items-start space-x-2',
                  evaluation.passed
                    ? 'bg-green-50 text-green-700'
                    : 'bg-yellow-50 text-yellow-700'
                )}
              >
                {evaluation.passed ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    Quality Score: {Math.round(evaluation.score * 100)}%
                  </p>
                  {evaluation.hallucinationsDetected && (
                    <p className="text-sm mt-0.5">
                      Warning: Some extracted data may not be accurate
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || (sourceType === 'pdf' ? !pdfBase64 : !source.trim())}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import Recipe</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
