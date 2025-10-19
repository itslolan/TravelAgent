# Gemini CAPTCHA Solver with Computer Use Patterns (Python Microservice)

This Python microservice uses Gemini with function calling to solve CAPTCHAs, following Computer Use patterns (coordinate normalization, action-based approach).

## Why a Python Microservice?

**Note**: The official `gemini-2.5-computer-use-preview-10-2025` model is not yet available in the public Python SDK. This service uses `gemini-2.0-flash-exp` with **function calling** that mimics Computer Use patterns (normalized coordinates, action-based interface).

## Setup

### 1. Create Python Virtual Environment

```bash
cd python-captcha-solver
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 4. Run the Service

```bash
python captcha_solver.py
```

The service will start on `http://localhost:5000`

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "gemini-captcha-solver",
  "model": "gemini-2.0-flash-exp",
  "method": "function_calling_with_computer_use_patterns"
}
```

### Solve CAPTCHA

```bash
POST /solve-captcha
Content-Type: application/json

{
  "screenshot": "base64_encoded_png",
  "task": "Solve the CAPTCHA to proceed",
  "screen_width": 1440,
  "screen_height": 900,
  "current_url": "https://example.com"
}
```

Response:
```json
{
  "success": true,
  "actions": [
    {
      "type": "click_at",
      "x": 720,
      "y": 450
    }
  ],
  "message": "1 actions to execute",
  "complete": false
}
```

### Analyze State

```bash
POST /analyze-state
Content-Type: application/json

{
  "screenshot": "base64_encoded_png",
  "previous_action": "click_at",
  "current_url": "https://example.com"
}
```

Response:
```json
{
  "complete": true,
  "next_actions": [],
  "message": "CAPTCHA solved successfully"
}
```

## Features

- ✅ Gemini vision with Computer Use patterns
- ✅ Coordinate denormalization (0-999 → actual pixels)
- ✅ All Computer Use actions:
  - `click_at` - Click at coordinates
  - `type_text_at` - Type text at coordinates
  - `drag_and_drop` - **Perfect for CAPTCHA sliders!**
  - `scroll_document` - Scroll the page
  - `wait_5_seconds` - Wait for page to load
- ✅ RESTful HTTP API
- ✅ Easy integration with Node.js app

## Docker Support (Optional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000
CMD ["python", "captcha_solver.py"]
```

Build and run:
```bash
docker build -t gemini-captcha-solver .
docker run -p 5000:5000 --env-file .env gemini-captcha-solver
```

## Development

To test the service:

```bash
# Health check
curl http://localhost:5000/health

# Solve CAPTCHA (with screenshot)
curl -X POST http://localhost:5000/solve-captcha \
  -H "Content-Type: application/json" \
  -d '{"screenshot": "...", "task": "Solve CAPTCHA"}'
```

## Troubleshooting

**Error: GEMINI_API_KEY not found**
- Make sure you have a `.env` file with `GEMINI_API_KEY=your_key`

**Error: Module not found**
- Activate virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

**Port already in use**
- Change port in `.env`: `PORT=5001`
- Or kill existing process: `lsof -ti:5000 | xargs kill`
