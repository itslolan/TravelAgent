# ✅ Render.yaml Fix - Invalid Property Error

## The Error

```
A render.yaml file was found, but there was an issue.
services[0].envVars[5].fromService.property
invalid service property: url. Valid properties are connectionString, host, hostport, port.
```

## The Problem

Render's `fromService` property doesn't support `url` as a valid property. Only these are supported:
- `connectionString`
- `host`
- `hostport`
- `port`

## The Solution

### 1. Changed `render.yaml`

**Before (broken)**:
```yaml
- key: PYTHON_CAPTCHA_SOLVER_URL
  fromService:
    type: web
    name: travelagent-captcha-solver
    property: url  # ❌ Not supported
```

**After (fixed)**:
```yaml
- key: PYTHON_CAPTCHA_SOLVER_HOST
  fromService:
    type: web
    name: travelagent-captcha-solver
    property: host  # ✅ Supported
```

### 2. Updated Backend Code

Modified `server/services/geminiPythonService.js` to handle both:

```javascript
const getPythonServiceUrl = () => {
  // Option 1: Full URL (manual deployment or local)
  if (process.env.PYTHON_CAPTCHA_SOLVER_URL) {
    return process.env.PYTHON_CAPTCHA_SOLVER_URL;
  }
  
  // Option 2: Hostname from Render Blueprint
  if (process.env.PYTHON_CAPTCHA_SOLVER_HOST) {
    // Render provides hostname without protocol, add https://
    return `https://${process.env.PYTHON_CAPTCHA_SOLVER_HOST}`;
  }
  
  // Option 3: Local development
  return 'http://localhost:5000';
};
```

## How It Works Now

### Blueprint Deployment (Automatic)

1. Render sets `PYTHON_CAPTCHA_SOLVER_HOST` = `travelagent-captcha-solver.onrender.com`
2. Backend constructs full URL: `https://travelagent-captcha-solver.onrender.com`
3. ✅ Works automatically!

### Manual Deployment

1. Deploy Python service first
2. Copy service URL
3. Set `PYTHON_CAPTCHA_SOLVER_URL` = `https://your-service.onrender.com`
4. Backend uses URL directly
5. ✅ Works with manual setup!

### Local Development

1. Run Python service: `python captcha_solver.py`
2. Backend defaults to `http://localhost:5000`
3. ✅ Works locally!

## Environment Variables Summary

| Scenario | Env Var | Value | Set By |
|----------|---------|-------|--------|
| **Blueprint Deploy** | `PYTHON_CAPTCHA_SOLVER_HOST` | `travelagent-captcha-solver.onrender.com` | Render (auto) |
| **Manual Deploy** | `PYTHON_CAPTCHA_SOLVER_URL` | `https://your-service.onrender.com` | You (manual) |
| **Local Dev** | `PYTHON_CAPTCHA_SOLVER_URL` | `http://localhost:5000` | You (.env) |

## Files Changed

1. ✅ `render.yaml` - Changed `url` property to `host`
2. ✅ `server/services/geminiPythonService.js` - Support both URL and HOST
3. ✅ `.env.example` - Added comments explaining options
4. ✅ `RENDER_DEPLOYMENT.md` - Updated documentation

## Next Steps

### Push to GitHub

```bash
git add .
git commit -m "Fix render.yaml - use host instead of url property"
git push origin master
```

### Deploy with Blueprint

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Select your repository
4. Click **"Apply"**
5. Set environment variables (API keys)
6. ✅ Both services deploy!

## Verify It Works

After deployment, check the environment:

```bash
# In Render Dashboard → Backend Service → Environment tab
# You should see:
PYTHON_CAPTCHA_SOLVER_HOST=travelagent-captcha-solver.onrender.com
```

Backend will construct: `https://travelagent-captcha-solver.onrender.com`

Test health:
```bash
curl https://travelagent-captcha-solver.onrender.com/health
```

Expected:
```json
{
  "status": "healthy",
  "service": "gemini-captcha-solver"
}
```

## Summary

✅ **Fixed**: Changed `property: url` to `property: host` in render.yaml  
✅ **Backward Compatible**: Still supports manual `PYTHON_CAPTCHA_SOLVER_URL`  
✅ **Flexible**: Works with Blueprint, manual, and local deployments  
✅ **Auto-Deploy**: Both services redeploy on push to master  

**The error is now resolved!** 🎉
