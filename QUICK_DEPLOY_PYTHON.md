# 🚀 Quick Deploy: Python CAPTCHA Solver to Render.com

## TL;DR - 5 Minute Setup

### Step 1: Push to GitHub (1 min)

```bash
git add .
git commit -m "Add Python CAPTCHA solver deployment config"
git push origin master
```

### Step 2: Deploy with Blueprint (2 min)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Select your GitHub repository
4. Click **"Apply"**

### Step 3: Set Environment Variables (2 min)

In Render dashboard, add these secrets:

**For `travelagent-backend`:**
- `BROWSERBASE_API_KEY` = your key
- `BROWSERBASE_PROJECT_ID` = your project ID
- `GEMINI_API_KEY` = your Gemini key

**For `travelagent-captcha-solver`:**
- `GEMINI_API_KEY` = your Gemini key

### Done! ✅

Both services will deploy automatically. The Python service URL is auto-injected into the backend.

---

## 🔄 Auto-Deploy is Now Active

Every time you push to `master`, both services redeploy automatically:

```bash
git add .
git commit -m "Update feature"
git push origin master
# 🎉 Auto-deploys!
```

---

## ✅ Verify It's Working

**Python CAPTCHA Solver:**
```bash
curl https://your-captcha-solver.onrender.com/health
```

**Expected**:
```json
{
  "status": "healthy",
  "service": "gemini-captcha-solver",
  "model": "gemini-2.0-flash-exp"
}
```

**Backend:**
```bash
curl https://your-backend.onrender.com/health
```

**Expected**:
```json
{
  "status": "ok"
}
```

---

## 📋 What Was Set Up

### 1. `render.yaml` Blueprint
- Defines both services
- Configures auto-deploy
- Links Python service URL to backend
- Sets up health checks

### 2. Python Service Configuration
- **Runtime**: Python 3
- **Build**: `pip install -r requirements.txt`
- **Start**: `gunicorn` (production WSGI server)
- **Workers**: 2 processes
- **Timeout**: 120 seconds (for slow CAPTCHA solving)
- **Root Directory**: `python-captcha-solver/`

### 3. Auto-Deploy Triggers
- ✅ Enabled for both services
- ✅ Watches `master` branch
- ✅ Rebuilds on every push
- ✅ Zero configuration needed

---

## 💰 Cost

**Free Plan**: $0/month
- Both services included
- 750 hours total (shared)
- Services sleep after 15 min inactivity
- 30-60s cold start delay

**Starter Plan**: $7/month per service ($14 total)
- No cold starts
- Always responsive
- Recommended for production

---

## 🐛 Troubleshooting

### "Build failed"
Check Render logs for Python errors. Usually means:
- Missing package in `requirements.txt`
- Python version incompatibility

**Fix**: Ensure `gunicorn==21.2.0` is in `requirements.txt`

### "Service can't connect"
Backend can't reach Python service. Check:
- `PYTHON_CAPTCHA_SOLVER_URL` set correctly in backend
- Python service is running (check health endpoint)

**Fix**: If using manual deploy, update backend env var to Python service URL

### "Cold start delay"
First request takes 30-60 seconds on free plan.

**Fix**: Upgrade to Starter plan or accept the delay

---

## 📚 Full Documentation

For complete details, see:
- **`RENDER_DEPLOYMENT.md`** - Full deployment guide
- **`.deployment-checklist.md`** - Deployment checklist
- **`render.yaml`** - Blueprint configuration

---

## 🎉 You're Live!

Your setup now has:
- ✅ Python CAPTCHA solver running independently
- ✅ Node.js backend connected to Python service
- ✅ Auto-deploy on every push to master
- ✅ Health monitoring for both services
- ✅ Production-ready configuration

**Next push to master will trigger automatic redeployment of both services!** 🚀
