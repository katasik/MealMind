# MealMind - Stop Stressing About What's for Dinner

**Decision fatigue is over. Eat better, save money, and get your time back.**

MealMind is an AI-powered meal planning assistant that helps families eliminate the daily "what's for dinner?" stress. Build your recipe library from trusted sources, let AI create personalized weekly plans, and get automatic shopping lists—all while respecting dietary restrictions.

## The Problem

Every evening, the same question: "What should we make for dinner?"

- **Decision fatigue**: Planning meals daily is mentally exhausting
- **Unhealthy defaults**: No plan means ordering expensive takeout or eating whatever's at home
- **Money wasted**: Frequent takeout and inefficient grocery shopping add up fast
- **Ad-hoc ingredient shopping**: Getting what you need on the spot is difficult and time-consuming
- **Dietary concerns**: Managing food allergies and restrictions adds complexity and stress

## The Solution

Plan once, eat all week. MealMind provides:

- **AI-generated weekly meal plans** using recipes you already trust and love
- **Recipe library** - Import from URLs, PDFs, or upload entire recipe books
- **Smart shopping lists** - Auto-generated with what you need, organized by category
- **Calendar export** - Share with family so everyone knows what's for dinner
- **Telegram integration** - Shopping reminders and AI Q&A on the go
- **Dietary safety** - Respects all allergies and restrictions automatically

## Key Features

### Weekly Meal Planner
- Generate a full 7-day meal plan with one click
- AI respects all dietary restrictions and preferences
- Regenerate individual meals you don't like
- Select from your saved recipes library
- Approve plan to generate shopping list

### Recipe Knowledge Base
- Import recipes from any URL (AI extracts structured data)
- Upload PDF cookbooks (up to 5MB for fast processing)
- Paste recipe text manually
- Upload entire recipe books - AI extracts all recipes automatically
- View recipe images, ingredients, and step-by-step instructions
- Only use recipes you trust and love

### Smart Shopping List
- Auto-generated from approved meal plans
- Grouped by category (Produce, Dairy, Meat, etc.)
- Check off items you already have
- Send to Telegram for mobile access
- Auto-clears when the week ends

### Telegram Bot
- Ask "What's for dinner tonight?" while shopping
- View your shopping list on mobile
- Get AI-powered answers about ingredients and recipes
- Add recipes to your library from Telegram
- Commands: `/today`, `/week`, `/list`

### Landing Experience
- First-time visitors see a compelling landing page explaining the value
- Returning users skip directly to their meal planner
- Clear walkthrough of how MealMind saves time, money, and stress

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Gemini API key (free at https://aistudio.google.com/)

### Installation

1. **Clone and install**
```bash
git clone <repo-url>
cd mealmind
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your keys:
```env
GEMINI_API_KEY=your_gemini_api_key        # Required
TELEGRAM_BOT_TOKEN=your_token              # Optional
FIREBASE_API_KEY=your_key                  # Optional (uses mock data without)
```

3. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

## Architecture

```
mealmind/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Meal Planner (home) with landing page
│   │   ├── recipes/           # Recipe library
│   │   ├── settings/          # User preferences
│   │   └── api/               # API routes
│   │       ├── mealplans/     # Meal plan CRUD & generation
│   │       ├── recipes/       # Recipe CRUD & URL/PDF parsing
│   │       ├── shopping/      # Shopping list management
│   │       └── telegram/      # Telegram webhook
│   ├── components/            # React components
│   │   ├── mealplan/         # Meal planner components
│   │   ├── LandingPage.tsx   # First-visit landing page
│   │   ├── Navigation.tsx    # App navigation
│   │   ├── RecipeCard.tsx    # Recipe card display
│   │   ├── RecipeDetailModal.tsx
│   │   ├── AddRecipeModal.tsx
│   │   └── Toast.tsx         # Notification toasts
│   ├── bot/                   # Telegram bot (can run standalone)
│   │   └── index.ts          # Bot implementation
│   ├── lib/                   # Core services
│   │   ├── gemini.ts         # Gemini AI integration
│   │   └── firebase.ts       # Database operations
│   └── types/                 # TypeScript definitions
├── netlify.toml              # Netlify deployment config
├── package.json
└── README.md
```

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, Framer Motion
- **AI**: Google Gemini 2.5 Flash (with native PDF support)
- **Database**: Firebase Firestore (optional - app works with mock data)
- **Messaging**: Telegram Bot API
- **Deployment**: Netlify with serverless functions

## Deployment (Netlify)

1. **Push to GitHub**

2. **Connect to Netlify**
   - Go to netlify.com → "Add new site" → "Import an existing project"
   - Select your GitHub repo

3. **Set environment variables** in Netlify dashboard:
   ```
   GEMINI_API_KEY=your_key
   TELEGRAM_BOT_TOKEN=your_token
   FIREBASE_API_KEY=your_key
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_id
   FIREBASE_APP_ID=your_app_id
   ```

4. **Deploy** - Netlify auto-detects Next.js

5. **Set Telegram webhook** (after deploy):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-site.netlify.app/api/telegram/webhook
   ```

## How It Works

### AI Components (Gemini 2.5 Flash)
- **Meal plan generation**: Creates 1-7 day plans respecting dietary restrictions
- **Single meal regeneration**: Suggests alternatives for specific meals you don't like
- **Recipe parsing**: Extracts structured data from URLs, PDFs (up to 5MB), and pasted text
- **PDF cookbook processing**: Uses Gemini's native PDF support to extract multiple recipes
- **Dietary safety evaluation**: Validates recipes against user restrictions
- **Telegram Q&A**: Answers natural language questions about meals and ingredients

### Deterministic Components
- Shopping list aggregation and categorization
- Calendar (ICS) export formatting
- Week date calculations
- Ingredient combination logic

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/mealplans` | GET | Get meal plan for a week |
| `/api/mealplans` | PUT | Update meal plan status or meal |
| `/api/mealplans/generate` | POST | Generate AI meal plan |
| `/api/mealplans/export` | GET | Export to ICS calendar |
| `/api/recipes` | GET/POST/DELETE | Recipe CRUD |
| `/api/recipes/parse` | POST | Parse recipe from URL/PDF/text |
| `/api/shopping` | GET/POST/PUT | Shopping list operations |
| `/api/shopping/telegram` | POST | Send list to Telegram |
| `/api/telegram/webhook` | POST | Telegram bot webhook |
| `/api/settings` | GET/PUT | User preferences |

## License

MIT License

## Evaluation & Quality (Opik Integration - Planned)

MealMind includes plans for comprehensive LLM evaluation using Opik:

1. **Recipe Extraction Quality**: Dual LLM-as-judge validates parsing accuracy
2. **Shopping List Completeness**: Ensures no missing ingredients
3. **Dietary Compliance**: Validates all recipes respect restrictions
4. **Ingredient Substitution**: Evaluates quality of dietary swaps
5. **Recipe Versatility**: Measures meal plan diversity and "wow factor"
6. **Nutritional Balance**: Tracks macro/micronutrient distribution

See [REPOSITORY_REVIEW.md](REPOSITORY_REVIEW.md) for full evaluation implementation plan.

---

**Made for families who want to eat better without the stress**
