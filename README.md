# MealMind - AI-Powered Weekly Meal Planning

**Stop stressing about what's for dinner.** MealMind is an AI-powered meal planning assistant that creates personalized weekly meal plans for families with dietary restrictions.

## The Problem

- **Decision fatigue**: Average Americans make 226 food decisions daily
- **Dietary coordination**: 32M Americans have food allergies, making family meal planning complex
- **Expensive defaults**: Decision fatigue leads to costly takeout orders
- **Safety concerns**: Managing multiple dietary restrictions is stressful and risky

## The Solution

MealMind provides:
- **AI-generated weekly meal plans** tailored to your dietary needs
- **Smart recipe management** - save recipes from URLs or PDFs
- **Automatic shopping lists** organized by category
- **Calendar export** with full recipe details
- **Telegram integration** for on-the-go access

## Key Features

### Weekly Meal Planner
- Generate a full 7-day meal plan with one click
- AI respects all dietary restrictions and preferences
- Regenerate individual meals you don't like
- Select from your saved recipes library
- Approve plan to generate shopping list

### Recipe Knowledge Base
- Import recipes from any URL
- Upload PDF cookbooks
- Add recipes manually
- View recipe images, ingredients, and instructions

### Smart Shopping List
- Auto-generated from approved meal plans
- Grouped by category (Produce, Dairy, Meat, etc.)
- Check off items you already have
- Send to Telegram for mobile access
- Auto-clears when the week ends

### Telegram Bot
- Ask "What's for dinner tonight?"
- View your shopping list
- Get AI-powered answers about ingredients
- Commands: `/today`, `/week`, `/list`

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
│   │   ├── page.tsx           # Meal Planner (home)
│   │   ├── recipes/           # Recipe library
│   │   ├── settings/          # User preferences
│   │   └── api/               # API routes
│   │       ├── mealplans/     # Meal plan CRUD & generation
│   │       ├── recipes/       # Recipe CRUD & URL parsing
│   │       ├── shopping/      # Shopping list management
│   │       └── telegram/      # Telegram webhook
│   ├── components/            # React components
│   │   ├── mealplan/         # Meal planner components
│   │   ├── Navigation.tsx    # App navigation
│   │   ├── RecipeCard.tsx    # Recipe card display
│   │   ├── RecipeDetailModal.tsx
│   │   ├── AddRecipeModal.tsx
│   │   └── Toast.tsx         # Notification toasts
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
- **AI**: Google Gemini 2.5 Flash Lite
- **Database**: Firebase Firestore
- **Messaging**: Telegram Bot API
- **Deployment**: Netlify

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

### AI Components (Gemini)
- **Meal plan generation**: Creates 7-day plans respecting dietary restrictions
- **Single meal regeneration**: Suggests alternatives for specific meals
- **Recipe parsing**: Extracts structured data from recipe URLs
- **Telegram Q&A**: Answers natural language questions about meals

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
| `/api/recipes/parse` | POST | Parse recipe from URL |
| `/api/shopping` | GET/POST/PUT | Shopping list operations |
| `/api/shopping/telegram` | POST | Send list to Telegram |
| `/api/telegram/webhook` | POST | Telegram bot webhook |
| `/api/settings` | GET/PUT | User preferences |

## License

MIT License

---

**Made for families who want to eat better without the stress**
