# MealMind - AI-Powered Family Meal Planning

MealMind is an AI-powered meal planning assistant that eliminates daily "what's for dinner?" decision fatigue for families. It uses LLMs to generate personalized meal plans, extract recipes from URLs/PDFs, and create smart shopping lists — all while maintaining comprehensive observability via Opik.

## Features

- **AI Meal Planning**: Generate personalized weekly meal plans based on dietary restrictions, preferences, and favorite cuisines
- **Recipe Import**: Extract recipes from URLs or pasted text using AI
- **Smart Shopping Lists**: Automatically aggregate ingredients from meal plans with smart quantity combining
- **Dietary Compliance**: Multi-layer verification ensures 100% compliance with dietary restrictions (critical for allergies)
- **Telegram Integration**: Send shopping lists directly to Telegram for easy access while shopping
- **AI Quality Analytics**: Full observability via Opik with evaluation metrics for every AI operation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS |
| Backend | Python Serverless Functions on Vercel |
| Database | Firebase Firestore |
| LLM | Google Gemini 2.5 Flash |
| Observability | Opik by Comet |
| Bot | Telegram Bot API |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- npm or yarn
- A Google Cloud account (for Firebase and Gemini)
- An Opik account (free tier available)
- (Optional) A Telegram bot for shopping list integration

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd feed-me
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies (for local development)
pip install -r requirements.txt
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then fill in each variable as described below.

---

## Environment Variables Setup

### Firebase Configuration

Firebase provides the database (Firestore) for storing recipes, meal plans, and user preferences.

#### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or use an existing one)
3. Give your project a name (e.g., "mealmind")
4. Disable Google Analytics if you don't need it
5. Click "Create project"

#### Step 2: Enable Firestore

1. In your Firebase project, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" for development (you can add security rules later)
4. Select a location closest to your users
5. Click "Enable"

#### Step 3: Get Client-Side Config (NEXT_PUBLIC_FIREBASE_*)

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register the app with a nickname (e.g., "mealmind-web")
5. Copy the config values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

#### Step 4: Get Server-Side Credentials (FIREBASE_SERVICE_ACCOUNT)

1. In Firebase Console, go to Project Settings → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Convert the entire JSON to a single line and set it as the environment variable:

```bash
# The value should be the entire JSON on one line
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**Tip**: Use this command to convert the JSON file to a single line:
```bash
cat /Users/katasik/Downloads/feed-me-995a9-firebase-adminsdk-fbsvc-29e989248b.json | jq -c .
```

---

### Google Gemini API Key

Gemini powers all AI features (meal generation, recipe parsing, evaluations).

#### Get Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select your Google Cloud project (or create one)
5. Copy the API key

```bash
GOOGLE_API_KEY=AIzaSy...your-gemini-api-key
```

**Free Tier**: Gemini 2.5 Flash offers a generous free tier with improved performance over 1.5 Flash.

---

### Opik Configuration

Opik provides observability, tracing, and evaluation for all AI operations.

#### Step 1: Create an Opik Account

1. Go to [Opik by Comet](https://www.comet.com/opik)
2. Sign up for a free account
3. Create a new workspace or use the default

#### Step 2: Get Your API Key

1. Click on your profile icon → "Settings"
2. Go to "API Keys"
3. Click "Generate New API Key"
4. Copy the key

```bash
OPIK_API_KEY=your-opik-api-key
OPIK_WORKSPACE=your-workspace-name
OPIK_PROJECT_NAME=mealmind
```

**Free Tier**: 1,000 traces/month included.

---

### Telegram Bot (Optional)

The Telegram bot allows users to receive shopping lists and interact with their meal plans via chat.

#### Step 1: Create a Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow the prompts to name your bot
4. Copy the bot token provided

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

#### Step 2: Set Up Webhook (After Deployment)

After deploying to Vercel, set up the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"
```

---

### App URL

Set your application URL (used for generating links):

```bash
# For local development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For production (update after deployment)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Running Locally

### Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Testing Python APIs Locally

The Python serverless functions run on Vercel, but you can test them locally using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally with serverless functions
vercel dev
```

---

## Project Structure

```
mealmind/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout with navigation
│   ├── page.tsx                  # Home (Meal Planner + Shopping)
│   ├── globals.css               # Global styles
│   ├── recipes/page.tsx          # Recipe library
│   ├── shopping/page.tsx         # Shopping list page
│   ├── settings/page.tsx         # Family preferences
│   └── evaluation/page.tsx       # AI quality analytics
│
├── components/                   # React components
│   ├── Navigation.tsx            # Top navigation
│   ├── MealPlanner.tsx           # Main meal planning UI
│   ├── MealCard.tsx              # Individual meal display
│   ├── RecipeCard.tsx            # Recipe card
│   ├── RecipeModal.tsx           # Recipe details modal
│   ├── AddRecipeModal.tsx        # Import recipe modal
│   ├── ShoppingList.tsx          # Shopping list with checkboxes
│   └── EvaluationScores.tsx      # Opik metrics display
│
├── lib/                          # Shared TypeScript utilities
│   ├── firebase.ts               # Firebase client
│   ├── types.ts                  # TypeScript interfaces
│   ├── api.ts                    # API client helpers
│   └── utils.ts                  # Utility functions
│
├── api/                          # Python Serverless Functions
│   ├── mealplans/
│   │   ├── generate.py           # POST - Generate meal plan
│   │   ├── regenerate.py         # POST - Regenerate single meal
│   │   └── index.py              # GET/PUT - Meal plan CRUD
│   ├── recipes/
│   │   ├── parse.py              # POST - Parse recipe from URL/text
│   │   └── index.py              # GET/DELETE - Recipe CRUD
│   ├── shopping/
│   │   ├── index.py              # GET/POST/PUT - Shopping lists
│   │   └── telegram.py           # POST - Send to Telegram
│   ├── evaluation/
│   │   └── index.py              # GET - Evaluation metrics
│   ├── telegram/
│   │   └── webhook.py            # POST - Telegram bot webhook
│   └── _lib/                     # Shared Python modules
│       ├── firebase_admin_client.py
│       ├── gemini_client.py
│       ├── opik_client.py
│       └── evaluation/
│           ├── metrics/          # Opik evaluation metrics
│           │   ├── dietary_compliance.py
│           │   ├── recipe_extraction.py
│           │   ├── shopping_completeness.py
│           │   ├── variety.py
│           │   └── nutrition.py
│           └── datasets/
│               └── test_cases.json
│
├── public/                       # Static assets
├── package.json                  # Node dependencies
├── requirements.txt              # Python dependencies
├── vercel.json                   # Vercel configuration
├── tailwind.config.ts            # Tailwind configuration
└── tsconfig.json                 # TypeScript configuration
```

---

## Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `next build`
   - Output Directory: `.next`

### Step 3: Add Environment Variables

In Vercel project settings, go to "Environment Variables" and add all variables from your `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (single line) |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `OPIK_API_KEY` | Opik API key |
| `OPIK_WORKSPACE` | Opik workspace name |
| `OPIK_PROJECT_NAME` | Opik project name (e.g., "mealmind") |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |

### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

### Step 5: Set Up Telegram Webhook (Optional)

After deployment, configure the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"
```

---

## Usage Guide

### 1. Set Up Your Family

Go to **Settings** and:
- Add family members with their dietary restrictions
- Select cuisine preferences
- Add favorite and disliked ingredients
- Choose cooking time preference

### 2. Generate a Meal Plan

On the **Home** page:
- Click "Generate Meal Plan"
- The AI will create a personalized weekly plan
- Review the quality score (dietary compliance, variety, nutrition)
- Click on any meal to see details
- Use the refresh button to regenerate individual meals

### 3. Import Recipes

Go to **Recipes** and:
- Click "Add Recipe"
- Paste a recipe URL or text
- The AI extracts ingredients, instructions, and metadata
- Saved recipes are prioritized in future meal plans

### 4. Create Shopping Lists

On the **Home** or **Shopping** page:
- Click "Generate Shopping List"
- Items are automatically grouped by category
- Check off items as you shop
- Send the list to Telegram for mobile access

### 5. Monitor AI Quality

Go to **Analytics** to:
- View pass rates for all AI operations
- See detailed scores by operation type
- Track dietary compliance, variety, and nutrition metrics
- Access Opik dashboard for deep-dive analysis

---

## API Reference

### Meal Plans

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mealplans/generate` | POST | Generate a new meal plan |
| `/api/mealplans/regenerate` | POST | Regenerate a single meal |
| `/api/mealplans` | GET | Get meal plan by ID or week |
| `/api/mealplans` | PUT | Update meal plan status |

### Recipes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recipes/parse` | POST | Parse recipe from URL/text |
| `/api/recipes` | GET | Get recipes for a family |
| `/api/recipes` | DELETE | Delete a recipe |

### Shopping

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shopping` | GET | Get shopping list for meal plan |
| `/api/shopping` | POST | Create shopping list from meal plan |
| `/api/shopping` | PUT | Update item checked status |
| `/api/shopping/telegram` | POST | Send list to Telegram |

### Evaluation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evaluation` | GET | Get recent evaluation results |

---

## Opik Evaluation Metrics

MealMind uses five key evaluation metrics:

| Metric | Description | Threshold |
|--------|-------------|-----------|
| **Dietary Compliance** | Ensures no allergens or restricted ingredients | 100% required |
| **Recipe Extraction** | Validates accuracy of parsed recipes (dual LLM-as-judge) | 70% minimum |
| **Shopping Completeness** | Verifies all ingredients are in shopping list | 80% minimum |
| **Variety** | Measures cuisine and ingredient diversity | 60% minimum |
| **Nutrition** | Estimates nutritional balance | 60% minimum |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- [Opik by Comet](https://www.comet.com/opik) for AI observability
- [Google Gemini](https://ai.google.dev/) for LLM capabilities
- [Firebase](https://firebase.google.com/) for database services
- [Vercel](https://vercel.com/) for deployment platform
