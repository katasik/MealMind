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
  imageUrl?: string;
  sourceUrl?: string;
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
      "tags": ["quick", "vegetarian"],
      "imageUrl": "https://example.com/recipe-image.jpg"
    }
  ]
}

CRITICAL RULES FOR INGREDIENTS:
- The "name" field should contain ONLY the ingredient name WITHOUT any quantity or amount
- The "amount" field should contain ONLY the numeric value (e.g., "2", "1.5", "3")
- The "unit" field should contain the measurement unit (e.g., "db", "cup", "g", "ml", "tbsp", "tsp", "piece", "darab")
- NEVER duplicate quantity information between fields
- Example: "2 db érett banán" should be: {"name": "érett banán", "amount": "2", "unit": "db"}
- Example: "1 cup flour" should be: {"name": "flour", "amount": "1", "unit": "cup"}

IMAGE EXTRACTION:
- Look for the main recipe image (usually the largest/hero image)
- Extract the full URL of the image
- Look in og:image meta tags, schema.org Recipe image, or main content images
- Only include actual image URLs (ending in .jpg, .jpeg, .png, .webp, or from known CDNs)
- If no image is found, omit the imageUrl field

Other notes:
- Extract ALL recipes found
- prepTime and cookTime should be in minutes (numbers only)
- difficulty must be "easy", "medium", or "hard"
- If you can't determine a value, use reasonable defaults
- If no recipes are found, return: {"recipes": [], "error": "No recipes found"}`;

// Fetch webpage content from URL
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MealMind/1.0; Recipe Collector)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error(`Could not fetch the URL. Make sure it's accessible and contains a recipe.`);
  }
}

// Parse recipe from a URL
async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe[]> {
  // Fetch the webpage content
  const html = await fetchUrlContent(url);

  // Use Gemini to extract recipe from HTML
  const prompt = `You are extracting recipe information from a webpage. The webpage HTML is provided below.

${RECIPE_PARSE_PROMPT}

Important for URL parsing:
- Look for structured recipe data (JSON-LD, microdata, schema.org) first as it's most reliable
- Extract from the main content if no structured data is found
- Ignore ads, navigation, comments, and other non-recipe content
- Focus on the main recipe on the page
- The URL source was: ${url}

Webpage HTML (truncated if too long):
${html.substring(0, 80000)}`; // Limit HTML size to avoid token limits

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

    // Add source URL to recipes
    return parsed.recipes.map((recipe: ParsedRecipe) => ({
      ...recipe,
      sourceUrl: url
    }));
  } catch (error) {
    console.error('Error parsing recipe from URL:', error);
    return [];
  }
}

// Check if a string is a valid URL
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
      // Handle JSON body (text paste or URL)
      const body = await request.json();
      const { text: textToParse, url: urlToParse } = body;

      // Handle URL parsing
      if (urlToParse) {
        if (!isValidUrl(urlToParse)) {
          return NextResponse.json(
            { error: 'Please provide a valid URL (starting with http:// or https://)' },
            { status: 400 }
          );
        }

        try {
          const recipes = await parseRecipeFromUrl(urlToParse);

          if (recipes.length === 0) {
            return NextResponse.json(
              { error: 'Could not identify any recipes on that webpage. Try a different URL or paste the recipe text directly.' },
              { status: 400 }
            );
          }

          return NextResponse.json({
            recipes,
            count: recipes.length,
            source: 'url'
          });
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to fetch recipe from URL' },
            { status: 400 }
          );
        }
      }

      // Handle text parsing
      if (!textToParse || textToParse.trim().length < 20) {
        return NextResponse.json(
          { error: 'Please provide recipe text or a URL to parse' },
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
        count: recipes.length,
        source: 'text'
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
