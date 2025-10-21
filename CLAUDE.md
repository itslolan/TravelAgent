# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TravelAgent is an AI-powered flight booking assistant that uses **Gemini 2.0 Computer Use** and **BrowserBase** for cloud-based browser automation to find the cheapest flight tickets on Expedia.com. The system features a sophisticated CAPTCHA-solving capability using a multi-phase strategic approach.

## Architecture

### System Components

1. **Frontend (React + Vite)**
   - Single-page app in `src/App.jsx`
   - Real-time updates via Server-Sent Events (SSE)
   - Progress tracking UI with minion history for parallel searches
   - TailwindCSS for styling

2. **Backend (Node.js + Express)**
   - Main server in `server/index.js`
   - Routes in `server/routes/`
   - Services in `server/services/`

3. **Python CAPTCHA Solver Microservice**
   - Separate Flask service in `python-captcha-solver/`
   - Uses Gemini 2.0 with function calling for CAPTCHA solving
   - Three-phase approach: Strategy → Action → Observe & Assess
   - Runs on port 5000 by default

### Key Services

**`browserbaseService.js`**: Core browser automation
- Creates BrowserBase sessions with enhanced configuration
- Handles proxy management and session monitoring
- Coordinates with Gemini for page analysis
- Live view URL generation for real-time debugging

**`geminiComputerUse.js`**: Gemini Computer Use integration
- Uses `gemini-2.5-computer-use-preview-10-2025` model
- Handles page readiness checks
- CAPTCHA detection and solving coordination
- Screen size: 1440x900 (recommended by Gemini docs)

**`geminiPythonService.js`**: Python microservice integration
- Communicates with Python CAPTCHA solver via HTTP
- Executes Playwright actions from Gemini function calls
- Implements 15-iteration loop for complex CAPTCHAs
- Action types: `click_at`, `type_text_at`, `drag_and_drop`, `scroll_at`, etc.

**`flexibleSearchService.js`**: Parallel date search
- Spawns multiple "minion" search sessions
- Searches different departure dates in parallel
- Aggregates and compares results

**`sessionManager.js`**: BrowserBase session management
- Enhanced session creation with proxies and fingerprinting
- Request interception for performance optimization

**`searchMonitor.js`**: Search progress tracking
- Real-time monitoring of search progress
- Manages active and completed minions

**`proxyHealthCheck.js`**: Reliability layer
- Circuit breaker pattern for BrowserBase
- Retry logic with exponential backoff
- Proxy health validation

### CAPTCHA Solving Strategy

The system uses a sophisticated **three-phase workflow** for CAPTCHA solving:

1. **Phase 1: Strategy Planning**
   - AI analyzes CAPTCHA type (carousel, image selection, slider, checkbox)
   - Identifies navigation elements (arrows, buttons)
   - Creates step-by-step solving plan
   - Endpoint: `/analyze-strategy` in Python service

2. **Phase 2: Action**
   - Executes ONE action at a time
   - Waits 2 seconds for page response
   - Max 15 iterations (allows carousel exploration)

3. **Phase 3: Observe & Assess**
   - AI observes changes after each action
   - Checks for success indicators (checkmarks, highlights)
   - Decides next action or submits when 100% confident

**Critical rule**: Never rush to submit. Always explore all options (especially carousels) and verify selections before submitting.

### Search Modes

1. **Fixed Date Search**: Single search with specific dates
2. **Flexible Search**: Parallel searches across multiple dates in a month
   - Creates "minions" for each date combination
   - Finds cheapest option across all dates

## Development Commands

### Local Development

```bash
# Install dependencies
npm install

# Start both frontend and backend (concurrent)
npm run dev

# Start frontend only (port 3000)
npm run dev:client

# Start backend only (port 3001)
npm run dev:server

# Build for production
npm run build

# Preview production build
npm run preview
```

### Python CAPTCHA Solver Service

```bash
# Navigate to Python service directory
cd python-captcha-solver

# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service (port 5000)
python captcha_solver.py

# Check health
curl http://localhost:5000/health
```

### Testing

```bash
# Test flight search API
curl -X POST http://localhost:3001/api/search-flights \
  -H "Content-Type: application/json" \
  -d '{
    "departureAirport": "SFO",
    "arrivalAirport": "JFK",
    "departureDate": "2025-06-15",
    "returnDate": "2025-06-22"
  }'

# Test Python CAPTCHA solver health
curl http://localhost:5000/health
```

## Environment Configuration

### Required Environment Variables

**.env file** (root directory):
```bash
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
NODE_ENV=development

# CAPTCHA solving strategy
USE_GEMINI_FOR_CAPTCHA=false  # false = BrowserBase auto-solve, true = Gemini active solving
PYTHON_CAPTCHA_SOLVER_URL=http://localhost:5000
```

**python-captcha-solver/.env**:
```bash
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
FLASK_ENV=development
```

### Feature Flags

- `USE_GEMINI_FOR_CAPTCHA`: Toggle between passive BrowserBase CAPTCHA solving (false) and active Gemini Computer Use solving (true)
- When using Gemini solving, Python microservice must be running

## Deployment

### Render.com (Recommended)

The project includes `render.yaml` for automatic deployment of both services:

```bash
# Deploy via Blueprint (automatic)
1. Push to GitHub
2. Create Blueprint in Render Dashboard
3. Connect repository
4. Set environment variables in Render UI
5. Both services deploy automatically

# Manual deploy
git push origin master  # Triggers auto-deploy if configured
```

**Two services created**:
1. `travelagent-backend` - Node.js app
2. `travelagent-captcha-solver` - Python service

**Important**: The Python service URL is auto-injected into the Node.js service via `render.yaml` configuration.

See `RENDER_DEPLOYMENT.md` for complete deployment guide.

## Important Patterns

### Server-Sent Events (SSE)

The backend uses SSE for real-time progress updates to the frontend:

```javascript
// Backend sends updates
res.setHeader('Content-Type', 'text/event-stream');
res.write(`data: ${JSON.stringify(updateData)}\n\n`);

// Frontend receives updates
const eventSource = new EventSource('/api/search-flights');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle update
};
```

### Action Execution Pattern

When working with Gemini Computer Use actions from the Python service:

1. Python service returns normalized coordinates (0-999)
2. Node.js service denormalizes to actual screen coordinates
3. Playwright executes the action
4. Wait for page response (2s)
5. Capture new screenshot
6. Send back to Python service for assessment

### Error Handling

- Circuit breaker pattern in `proxyHealthCheck.js` prevents cascading failures
- Retry logic with exponential backoff for BrowserBase connections
- Graceful degradation when Python service unavailable (falls back to BrowserBase CAPTCHA solving)

## Common Tasks

### Adding New Search Parameters

1. Update form in `src/App.jsx`
2. Add to request body in frontend
3. Update route validation in `server/routes/flightSearch.js`
4. Pass to `browserbaseService.js` or `flexibleSearchService.js`

### Modifying CAPTCHA Solving Logic

The Python service contains the main CAPTCHA solving logic:
- **Strategy planning**: `/analyze-strategy` endpoint in `python-captcha-solver/captcha_solver.py`
- **Action assessment**: `/assess-action` endpoint
- **Configuration**: Adjust `MAX_ITERATIONS` in `geminiPythonService.js`

### Debugging Browser Automation

1. Check BrowserBase Live View URL in console logs (embedded in UI)
2. Monitor Python service logs for CAPTCHA solving steps
3. Review iteration logs showing: Action → Observe → Assess → Decision
4. Check `searchMonitor.js` logs for session state

### Working with Proxies

BrowserBase sessions use proxies by default. Configuration in `sessionManager.js`:
- Residential proxies enabled
- Geolocation set to US
- Browser fingerprinting enabled

## Code Structure Notes

- **Static site serving**: In production (`NODE_ENV=production`), Express serves the built React app from `dist/`
- **Health checks**: Both services expose `/health` endpoints for monitoring
- **Concurrent requests**: Frontend uses SSE to handle long-running searches without blocking
- **Minion pattern**: Flexible search spawns multiple parallel browser sessions ("minions") to search different dates simultaneously

## API Endpoints

### POST `/api/search-flights`

**Fixed Date Search**:
```json
{
  "departureAirport": "SFO",
  "arrivalAirport": "JFK",
  "departureDate": "2025-06-15",
  "returnDate": "2025-06-22"
}
```

**Flexible Search**:
```json
{
  "searchMode": "flexible",
  "departureAirport": "YVR",
  "arrivalAirport": "DEL",
  "month": 10,
  "year": 2025,
  "tripDuration": 25
}
```

Returns: SSE stream with progress updates and final results

### GET `/health`

Health check endpoint for both Node.js and Python services.

## Key Files to Know

- `server/services/browserbaseService.js` - Main search orchestration (~400 lines)
- `server/services/geminiPythonService.js` - Python service integration (~300 lines)
- `python-captcha-solver/captcha_solver.py` - CAPTCHA solving logic (~500 lines)
- `src/App.jsx` - Frontend UI and state management (~1000 lines)
- `render.yaml` - Deployment configuration for both services

## Troubleshooting

**Python service connection issues**: Ensure `PYTHON_CAPTCHA_SOLVER_URL` matches running service URL

**CAPTCHA not solving**: Check logs for which phase failed (Strategy/Action/Assess). May need to increase `MAX_ITERATIONS` or improve prompts.

**BrowserBase session failures**: Check circuit breaker status in logs. May need to reset via `browserbaseCircuitBreaker.reset()`.

**Port conflicts**: Default ports are 3000 (frontend), 3001 (backend), 5000 (Python). Change via PORT env vars.

**Cold starts on Render free tier**: Services sleep after 15 min inactivity. First request takes 30-60s.
