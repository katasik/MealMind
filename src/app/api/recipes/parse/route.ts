import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

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

const RECIPE_PARSE_PROMPT = `Extract ALL recipes from the provided content. The content may contain one or multiple recipes.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description of the dish",
      "ingredients": [
        {"name": "ingredient name", "amount": "1", "unit": "cup", "category": "produce"}
      ],
      "instructions": ["Step 1 instruction", "Step 2 instruction"],
      "prepTime": 15,
      "cookTime": 20,
      "servings": 4,
      "cuisine": "Italian",
      "difficulty": "easy",
      "tags": ["quick", "vegetarian"]
    }
  ]
}

Notes:
- Extract ALL recipes found
- prepTime and cookTime should be in minutes (numbers only)
- difficulty must be "easy", "medium", or "hard"
- If you can't determine a value, use reasonable defaults
- If no recipes are found, return: {"recipes": [], "error": "No recipes found"}`;

async function parseRecipeText(rawText: string): Promise<ParsedRecipe[]> {
  const prompt = `${RECIPE_PARSE_PROMPT}

Text:
${rawText}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);

    if (parsed.error || !parsed.recipes || parsed.recipes.length === 0) {
      return [];
    }

    return parsed.recipes;
  } catch (error) {
    console.error('Error parsing recipe text:', error);
    return [];
  }
}

async function parseRecipeFromPdf(pdfBuffer: Buffer): Promise<ParsedRecipe[]> {
  // Use Gemini's native PDF support
  const base64Pdf = pdfBuffer.toString('base64');

  try {
    const result = await model.generateContent([
      RECIPE_PARSE_PROMPT,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf
        }
      }
    ]);

    const response = result.response.text();

    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);

    if (parsed.error || !parsed.recipes || parsed.recipes.length === 0) {
      return [];
    }

    return parsed.recipes;
  } catch (error) {
    console.error('Error parsing PDF with Gemini:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload (PDF)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Only PDF files are supported' },
          { status: 400 }
        );
      }

      // Check file size (max 100MB for recipe books)
      if (file.size > 100 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 100MB' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use Gemini's native PDF support
      const recipes = await parseRecipeFromPdf(buffer);

      if (recipes.length === 0) {
        return NextResponse.json(
          { error: 'Could not identify any recipes in the PDF' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        recipes,
        count: recipes.length
      });
    } else {
      // Handle JSON body (text paste)
      const body = await request.json();
      const textToParse = body.text;

      if (!textToParse || textToParse.trim().length < 20) {
        return NextResponse.json(
          { error: 'Please provide recipe text to parse' },
          { status: 400 }
        );
      }

      // Parse recipes from text
      const recipes = await parseRecipeText(textToParse);

      if (recipes.length === 0) {
        return NextResponse.json(
          { error: 'Could not identify any recipes in the provided text' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        recipes,
        count: recipes.length
      });
    }

  } catch (error) {
    console.error('Recipe parse API error:', error);
    return NextResponse.json(
      { error: 'Failed to parse recipes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
