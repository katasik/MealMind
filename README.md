# 🍽️ MealMind - AI Meal Planning for Families

**Stop stressing about what's for dinner.** MealMind is an AI-powered meal planning assistant that eliminates decision fatigue for families with dietary restrictions.

Independent project focused on Health, Fitness & Wellness.

## 🎯 The Problem

- **Decision fatigue**: Average Americans make 226 food decisions daily
- **Dietary coordination**: 32M Americans have food allergies, making family meal planning complex
- **Expensive defaults**: Decision fatigue leads to costly takeout orders
- **Safety concerns**: Managing multiple dietary restrictions is stressful and risky

## ✨ The Solution

MealMind provides:
- **AI-powered recipe suggestions** that meet everyone's dietary needs
- **Automatic safety checks** with allergen detection
- **Learning from feedback** - gets better with every ❤️ or 👎
- **Automatic shopping lists** organized by category
- **Comprehensive evaluation** using Opik for quality assurance

## 🏆 Key Features

### Health, Fitness & Wellness Track
- **Safety-first approach**: Every recipe passes through dietary compliance checks
- **Stress reduction**: Eliminates meal planning decision fatigue
- **Healthy eating**: Promotes home cooking over fast food
- **Family wellness**: Coordinates dietary needs for entire household

### Opik Prize Integration
- **LLM-as-Judge evaluations** for 4 key metrics:
  - Dietary Compliance (0-1)
  - Feasibility (0-1)
  - Variety (0-1)
  - Nutritional Balance (0-1)
- **Safety guardrails** with allergen detection logging
- **User feedback tracking** (emoji reactions → Opik metrics)
- **A/B testing framework** for prompt optimization
- **Regression test suite** for quality assurance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Gemini API key (free at https://aistudio.google.com/)
- Firebase project (optional, for data persistence)
- Telegram Bot Token (optional, for bot interface)

### Installation

1. **Clone and install dependencies**
```bash
git clone <repo-url>
cd mealmind
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_telegram_token (optional)
OPIK_API_KEY=your_opik_key (optional)
FIREBASE_API_KEY=your_firebase_key (optional)
```

3. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

### Optional: Run Telegram Bot
```bash
npm run bot
```

## 📱 Features

### Web App
- **Beautiful onboarding flow** - Set up family profile in 3 steps
- **Chat interface** - Natural conversation with AI
- **Recipe cards** - Detailed instructions with evaluation scores
- **Shopping lists** - Auto-generated and categorized
- **Feedback system** - React with emojis to improve suggestions

### Telegram Bot
- **/start** - Get started
- **/setup** - Configure family profile
- **/suggest** - Get meal suggestions
- **Natural chat** - Just talk about what you want to eat
- **Emoji reactions** - ❤️ 👍 👎 for feedback

## 🎨 Architecture

```
mealmind/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── page.tsx           # Landing page
│   │   ├── onboarding/        # Family setup flow
│   │   ├── chat/              # Chat interface
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                   # Core services
│   │   ├── gemini.ts         # Gemini API integration
│   │   ├── opik.ts           # Opik evaluation service
│   │   └── firebase.ts       # Database operations
│   ├── telegram/              # Telegram bot
│   │   └── bot.js            # Bot implementation
│   └── types/                 # TypeScript types
├── package.json
└── README.md
```

## 🧪 Evaluation Framework (Opik Integration)

### LLM-as-Judge Evaluators

**1. Dietary Compliance Evaluator**
- Checks if recipe contains restricted ingredients
- Detects hidden allergen sources (e.g., gluten in soy sauce)
- Scores 0.0-1.0 with reasoning
- Logs violations to Opik

**2. Feasibility Evaluator**
- Assesses ingredient availability
- Validates cooking time realism
- Evaluates required skill level
- Scores practicality for home cooks

**3. Variety Evaluator**
- Compares to recent recipe history
- Ensures diverse suggestions
- Prevents repetitive meals

**4. Nutritional Balance Evaluator**
- Checks calorie ranges (200-800 per serving)
- Validates protein content (>10g)
- Ensures adequate fiber (>3g)
- Flags high fat content (>30g)

### Safety Guardrails

**Allergen Detection System**
- Pre-generation safety check
- LLM-based allergen scanning
- Confidence scoring (0.0-1.0)
- Automatic rejection of unsafe recipes
- All checks logged to Opik

### User Feedback Loop

Emoji reactions are converted to scores:
- ❤️ Love: 1.0
- 👍 Like: 0.75
- 👎 Dislike: 0.25
- ❌ Reject: 0.0

Logged to Opik for continuous improvement.

### A/B Testing

Built-in experiment framework for testing:
- Different prompt strategies
- Model versions
- Response formats

## 📊 Demo Dashboard

The evaluation dashboard shows:
- Real-time recipe quality scores
- Safety check pass/fail rates
- User satisfaction trends
- A/B test results
- Allergen detection accuracy

## 🎯 Use Cases

### Family Dinner Planning
"What should we cook for dinner tonight?"
→ AI suggests recipe meeting all dietary needs
→ Generates shopping list
→ Family reacts with feedback
→ System learns preferences

### Meal Prep Sunday
"Give me 5 dinner ideas for the week"
→ Varied recipes with dietary compliance
→ Consolidated shopping list
→ Nutrition balance across week

### Quick Lunch Ideas
"I need something quick for lunch, under 20 minutes"
→ Fast, feasible recipes
→ Uses ingredients on hand
→ Suitable for dietary restrictions

## 🔒 Privacy & Safety

- **Dietary data is sensitive**: All restrictions are checked before showing recipes
- **No false negatives**: System defaults to "unsafe" on evaluation errors
- **Transparent evaluation**: Users see quality scores
- **Data privacy**: Firebase security rules protect family data

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, Framer Motion
- **AI**: Google Gemini API
- **Evaluation**: Opik (LLM-as-judge framework)
- **Database**: Firebase Firestore
- **Messaging**: Telegram Bot API
- **Deployment**: Vercel (recommended)

## 📈 Metrics for Success

### User Metrics
- Family profiles created
- Recipes generated
- Safety checks passed
- User satisfaction (emoji feedback)
- Fast food orders avoided

### Evaluation Metrics  
- Average dietary compliance score
- Feasibility score
- Variety across suggestions
- Nutritional balance score
- False negative rate (allergen detection)

## 🚢 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel deploy
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

This project welcomes contributions!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Anthropic** - Claude API for development assistance
- **Google** - Gemini API for AI capabilities
- **Comet** - Opik evaluation framework
-- Project Organizers

## 📧 Contact

Built by [Your Name]

- GitHub: [your-github]
- Email: [your-email]
- Demo: [deployed-url]

---

**Made with ❤️ for families who want to eat better without the stress**
