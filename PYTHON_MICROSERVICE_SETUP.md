# 🐍 Python Microservice for Gemini 2.5 Computer Use

## Overview

This setup allows you to use the **official Gemini 2.5 Computer Use API** (`gemini-2.5-computer-use-preview-10-2025`) for solving CAPTCHAs, even though it's only available in Python.

## Architecture

```
┌──────────────────┐         HTTP API          ┌─────────────────────┐
│                  │  ──────────────────────>   │                     │
│   Node.js App    │                            │  Python Service     │
│  (TravelAgent)   │                            │  (Port 5000)        │
│                  │  <──────────────────────   │                     │
└──────────────────┘    Screenshots + Actions   └─────────────────────┘
                                                 │
                                                 │ Uses Official API
                                                 ▼
                                          ┌─────────────────┐
                                          │  Gemini 2.5     │
                                          │  Computer Use   │
                                          └─────────────────┘
```

## Quick Start

### Step 1: Setup Python Environment

```bash
cd python-captcha-solver

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Python Service

```bash
# Create .env file
cp .env.example .env

# Edit .env and add your Gemini API key
nano .env  # or use your preferred editor
```

Add:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

### Step 3: Start Python Service

```bash
python captcha_solver.py
```

You should see:
```
🚀 Starting Gemini CAPTCHA Solver on port 5000
📊 Using model: gemini-2.5-computer-use-preview-10-2025
🔑 API Key: AIzaSyBxxxxxxxx...
 * Running on http://0.0.0.0:5000
```

### Step 4: Configure Node.js App

In your main `.env` file (TravelAgent root):

```bash
USE_GEMINI_FOR_CAPTCHA=true
PYTHON_CAPTCHA_SOLVER_URL=http://localhost:5000
```

### Step 5: Start Node.js App

```bash
# In another terminal, from TravelAgent root
npm run dev
```

### Step 6: Test!

Run a flight search. When a CAPTCHA is detected, you'll see:

**Node.js logs:**
```
⚠️  CAPTCHA detected! Using Gemini 2.5 Computer Use (Python) to solve it...
🤖 Attempting to solve CAPTCHA with Gemini 2.5 Computer Use (via Python)...
✅ Python service is available
📤 Sending screenshot to Python service...
```

**Python logs:**
```
[Gemini] Analyzing CAPTCHA...
[Gemini] Action: click_at at (720, 450)
[Gemini] Response: Clicking the verification checkbox
```

**Node.js logs:**
```
✅ Gemini 2.5 successfully solved the CAPTCHA! Checking page again...
```

## How It Works

### 1. CAPTCHA Detection
- Node.js detects CAPTCHA using Gemini vision (separate check)
- Triggers Python microservice if `USE_GEMINI_FOR_CAPTCHA=true`

### 2. Screenshot → Python
- Node.js captures screenshot (PNG, base64)
- Sends to Python service via HTTP POST
- Includes: task description, screen dimensions, current URL

### 3. Python → Gemini 2.5 Computer Use API
- Python service calls official Gemini API
- Uses `computer_use` tool configuration (Python SDK only)
- Model: `gemini-2.5-computer-use-preview-10-2025`

### 4. Gemini Returns Actions
- Actions with normalized coordinates (0-999)
- Python denormalizes to actual pixels
- Returns JSON with actions to execute

### 5. Node.js Executes Actions
- Receives actions from Python
- Executes with Playwright (click, type, scroll, etc.)
- Captures new screenshot
- Sends back to Python for analysis

### 6. Repeat Until Solved
- Loop continues for up to 10 iterations
- Python confirms when CAPTCHA is solved
- Node.js proceeds with flight search

## API Endpoints

### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "gemini-captcha-solver",
  "model": "gemini-2.5-computer-use-preview-10-2025"
}
```

### Solve CAPTCHA
```bash
curl -X POST http://localhost:5000/solve-captcha \
  -H "Content-Type: application/json" \
  -d '{
    "screenshot": "base64_encoded_png",
    "task": "Solve the CAPTCHA",
    "screen_width": 1440,
    "screen_height": 900
  }'
```

### Analyze State
```bash
curl -X POST http://localhost:5000/analyze-state \
  -H "Content-Type: application/json" \
  -d '{
    "screenshot": "base64_encoded_png",
    "previous_action": "click_at"
  }'
```

## Files Structure

```
TravelAgent/
├── python-captcha-solver/           # Python microservice
│   ├── captcha_solver.py           # Main Flask app
│   ├── requirements.txt            # Python dependencies
│   ├── .env.example               # Environment template
│   ├── .env                       # Your config (gitignored)
│   └── README.md                  # Python service docs
│
├── server/services/
│   ├── geminiPythonService.js     # Node.js → Python client
│   └── browserbaseService.js      # Integrated CAPTCHA solving
│
└── .env                           # Main app config
```

## Troubleshooting

### Python Service Won't Start

**Error: ModuleNotFoundError**
```bash
# Make sure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Error: GEMINI_API_KEY not found**
```bash
# Check .env file in python-captcha-solver/
cd python-captcha-solver
cat .env
# Should show: GEMINI_API_KEY=...
```

### Node.js Can't Connect to Python

**Error: Python CAPTCHA solver service is not available**

1. Check Python service is running:
```bash
curl http://localhost:5000/health
```

2. Check correct URL in Node.js `.env`:
```bash
PYTHON_CAPTCHA_SOLVER_URL=http://localhost:5000
```

3. Check firewall isn't blocking port 5000

### CAPTCHA Not Solving

**Check logs in both terminals:**

Python should show:
```
[Gemini] Analyzing CAPTCHA...
[Gemini] Action: click_at at (...)
```

Node.js should show:
```
📤 Sending screenshot to Python service...
📨 Received: 1 actions to execute
  -> Executing: click_at
```

If not, check:
- Screenshot is being captured properly
- Gemini API key is valid and has quota
- Model `gemini-2.5-computer-use-preview-10-2025` is accessible

## Development Tips

### Running Python Service in Background

```bash
# Using nohup
cd python-captcha-solver
nohup python captcha_solver.py > captcha-solver.log 2>&1 &

# Check if running
ps aux | grep captcha_solver

# View logs
tail -f captcha-solver.log
```

### Using Docker (Optional)

```bash
cd python-captcha-solver

# Build
docker build -t gemini-captcha-solver .

# Run
docker run -d \
  --name captcha-solver \
  -p 5000:5000 \
  -e GEMINI_API_KEY=your_key_here \
  gemini-captcha-solver

# View logs
docker logs -f captcha-solver
```

### Different Port

If port 5000 is in use:

Python `.env`:
```bash
PORT=5001
```

Node.js `.env`:
```bash
PYTHON_CAPTCHA_SOLVER_URL=http://localhost:5001
```

## Cost Considerations

Using Gemini 2.5 Computer Use incurs API costs:

- **Per CAPTCHA attempt**: ~10-20 API calls
- **Cost**: ~$0.05-0.15 per CAPTCHA
- **Includes**: Vision analysis + multiple actions

Compare with:
- **BrowserBase**: Free (included in proxies)
- **Gemini (JavaScript workaround)**: ~$0.01-0.03 per CAPTCHA

**Recommendation**: Use Gemini 2.5 only when BrowserBase fails, or for high-value searches.

## Benefits of This Approach

✅ **Official API**: Uses real `gemini-2.5-computer-use-preview-10-2025`  
✅ **Best Quality**: Most advanced CAPTCHA solving  
✅ **Separation**: Python microservice can be deployed separately  
✅ **Scalable**: Can handle multiple Node.js instances  
✅ **Maintainable**: Easy to update when API changes  

## Alternative: Direct Python Integration

If you prefer not to use a microservice, you could:

1. Rewrite entire app in Python
2. Use Python subprocess from Node.js
3. Use Python AWS Lambda for CAPTCHA solving

The microservice approach is recommended for production.

---

**Need Help?** Check logs in both terminals and ensure all API keys are correct.
