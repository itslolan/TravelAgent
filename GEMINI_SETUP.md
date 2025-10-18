# Gemini Computer Use Setup

## Overview

The TravelAgent app now uses **Gemini 2.0 Flash with Computer Use** to intelligently interact with Expedia.com. Instead of hardcoded selectors, Gemini analyzes screenshots and decides what actions to take.

## How It Works

1. **Initial Navigation**: Playwright navigates to Expedia with search parameters
2. **Gemini Takes Over**: The AI agent analyzes the page screenshot
3. **Agent Loop** (max 10 iterations):
   - Gemini looks at the screenshot
   - Decides what action to take (click, scroll, type, etc.)
   - Action is executed via Playwright
   - New screenshot is captured
   - Process repeats until task is complete
4. **Data Extraction**: Final flight data is extracted and returned

## Getting Your Gemini API Key

### Step 1: Go to Google AI Studio
Visit: https://aistudio.google.com/apikey

### Step 2: Create API Key
1. Click "Get API Key" or "Create API Key"
2. Select or create a Google Cloud project
3. Copy the generated API key

### Step 3: Add to Environment Variables

Add your API key to the `.env` file:

```bash
GEMINI_API_KEY=your_actual_api_key_here
```

**Example `.env` file:**
```
BROWSERBASE_API_KEY=bb_live_IIsNiTsND9hXYs1KMMMmO77U88M
BROWSERBASE_PROJECT_ID=cbeee7fb-3b7d-4704-9efd-1e420e36fe24
GEMINI_API_KEY=AIzaSyD...your_key_here
PORT=3001
```

## Install Dependencies

After adding the Gemini API key, install the new dependency:

```bash
npm install
```

This will install `@google/generative-ai` package.

## What Gemini Can Do

The Gemini Computer Use model can perform these actions:

- **click_at**: Click at specific coordinates
- **type_text_at**: Type text at a location
- **scroll_document**: Scroll up or down
- **wait_5_seconds**: Wait for page to load
- **navigate**: Go to a URL
- **hover_at**: Hover over elements
- **key_combination**: Press keyboard shortcuts
- **drag_and_drop**: Drag and drop elements

## Monitoring Gemini Actions

When you run a flight search, you'll see real-time updates:

```
✅ Session created
🤖 Starting Gemini Computer Use agent loop...
🧠 Gemini is analyzing the screen (iteration 1/10)...
⚡ Executing: wait_5_seconds
⚡ Executing: scroll_document
🧠 Gemini is analyzing the screen (iteration 2/10)...
⚡ Executing: click_at
✅ Gemini Agent Loop Complete
```

## Configuration

You can modify the Gemini behavior in `server/services/geminiComputerUse.js`:

- **MAX_ITERATIONS**: Maximum number of agent loops (default: 10)
- **GEMINI_MODEL**: Model to use (default: 'gemini-2.0-flash-exp')
- **Task prompt**: Customize what you want Gemini to do

## Troubleshooting

### "GEMINI_API_KEY not set"
- Make sure you've added the API key to `.env` file
- Restart the server after adding the key

### "Model not found"
- Ensure you're using a supported model
- Check Google AI Studio for available models

### Agent loop times out
- Increase MAX_ITERATIONS if needed
- Simplify the task prompt
- Check if the page is loading correctly

## Cost Considerations

- Gemini 2.0 Flash is free for limited usage
- Each iteration sends a screenshot (~100KB)
- Monitor your usage at: https://aistudio.google.com/

## Benefits Over Traditional Scraping

✅ **Adaptive**: Works even when Expedia changes their HTML  
✅ **Intelligent**: Can handle popups, cookie banners, etc.  
✅ **Visual**: Understands the page like a human would  
✅ **Flexible**: Easy to modify behavior with natural language  

## Example Task Prompts

You can customize the Gemini task in `browserbaseService.js`:

```javascript
// Simple extraction
const geminiTask = `Find the 3 cheapest flights and list their prices.`;

// Detailed interaction
const geminiTask = `
1. Wait for the page to load
2. Close any popups or cookie banners
3. Scroll through all flight options
4. Click on "Show more" if available
5. Extract the top 5 cheapest flights with full details
`;

// Specific requirements
const geminiTask = `
Find direct flights only (no layovers) under $500.
Sort by departure time and select morning flights.
`;
```

## Documentation

- Gemini Computer Use: https://ai.google.dev/gemini-api/docs/computer-use
- Google AI Studio: https://aistudio.google.com
- BrowserBase: https://docs.browserbase.com
