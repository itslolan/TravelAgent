# 🚀 Render.com Deployment Guide

Complete guide to deploy both the Node.js backend and Python CAPTCHA solver to Render.com with automatic deployments from the master branch.

---

## 📋 Prerequisites

### 1. GitHub Repository
- ✅ Code pushed to GitHub
- ✅ Repository is public or you have Render connected to your GitHub

### 2. API Keys Ready
- ✅ **BROWSERBASE_API_KEY** - From BrowserBase dashboard
- ✅ **BROWSERBASE_PROJECT_ID** - From BrowserBase dashboard
- ✅ **GEMINI_API_KEY** - From Google AI Studio

### 3. Render Account
- ✅ Free account at [render.com](https://render.com)
- ✅ GitHub connected to Render

---

## 🎯 Option 1: Blueprint Deployment (Recommended)

**Best for**: Deploying both services at once with auto-configuration

### Step 1: Push render.yaml to GitHub

The `render.yaml` file is already configured. Just commit and push:

```bash
git add render.yaml python-captcha-solver/requirements.txt
git commit -m "Add Render deployment configuration"
git push origin master
```

### Step 2: Create Blueprint in Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Select your GitHub repository
4. Render will detect `render.yaml` automatically
5. Click **"Apply"**

### Step 3: Set Environment Variables

After blueprint is applied, set these secrets:

**For travelagent-backend:**
- `BROWSERBASE_API_KEY` = `your_browserbase_api_key`
- `BROWSERBASE_PROJECT_ID` = `your_browserbase_project_id`
- `GEMINI_API_KEY` = `your_gemini_api_key`

**For travelagent-captcha-solver:**
- `GEMINI_API_KEY` = `your_gemini_api_key`

### Step 4: Trigger Deploy

1. Both services will deploy automatically
2. Wait for builds to complete (~5-10 minutes)
3. Python service URL will be auto-injected into Node.js service

---

## 🎯 Option 2: Manual Service Creation

**Best for**: Step-by-step control or troubleshooting

### Part A: Deploy Python CAPTCHA Solver

#### 1. Create Web Service

1. Go to Render Dashboard
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `travelagent-captcha-solver`
   - **Region**: Oregon (or nearest to you)
   - **Branch**: `master`
   - **Root Directory**: `python-captcha-solver`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 captcha_solver:app`

#### 2. Set Environment Variables

Add these in the "Environment" tab:
```
GEMINI_API_KEY=your_gemini_api_key_here
FLASK_ENV=production
PORT=5000
```

#### 3. Advanced Settings

- **Health Check Path**: `/health`
- **Auto-Deploy**: ✅ Enabled (deploys on push to master)
- **Plan**: Free (or Starter for no cold starts)

#### 4. Deploy

Click **"Create Web Service"** and wait for deployment.

**Copy the service URL** (e.g., `https://travelagent-captcha-solver.onrender.com`)

---

### Part B: Deploy Node.js Backend

#### 1. Create Web Service

1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `travelagent-backend`
   - **Region**: Oregon (same as Python service)
   - **Branch**: `master`
   - **Root Directory**: (leave empty - uses repo root)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`

#### 2. Set Environment Variables

```
NODE_ENV=production
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
GEMINI_API_KEY=your_gemini_api_key
USE_GEMINI_FOR_CAPTCHA=true
PYTHON_CAPTCHA_SOLVER_URL=https://travelagent-captcha-solver.onrender.com
```

**Important**: Replace the Python service URL with your actual URL from Part A!

#### 3. Advanced Settings

- **Health Check Path**: `/health`
- **Auto-Deploy**: ✅ Enabled
- **Plan**: Free (or Starter for no cold starts)

#### 4. Deploy

Click **"Create Web Service"** and wait for deployment.

---

## ✅ Verify Deployment

### 1. Check Python Service Health

Visit: `https://your-captcha-solver.onrender.com/health`

**Expected response**:
```json
{
  "status": "healthy",
  "service": "gemini-captcha-solver",
  "model": "gemini-2.0-flash-exp",
  "method": "function_calling_with_computer_use_patterns"
}
```

### 2. Check Node.js Backend Health

Visit: `https://your-backend.onrender.com/health`

**Expected response**:
```json
{
  "status": "ok"
}
```

### 3. Test Full App

Visit your backend URL and try a flight search!

---

## 🔄 Auto-Deploy on Push

Both services are now configured for **automatic deployment**!

### How It Works

1. You push code to `master` branch
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin master
   ```

2. Render detects the push automatically

3. Both services rebuild and redeploy

4. No manual intervention needed! 🎉

### Monitor Deploys

- Go to Render Dashboard
- Click on service name
- See "Events" tab for deployment history
- View "Logs" tab for real-time logs

---

## 📊 Service Configuration Summary

### Python CAPTCHA Solver Service

```yaml
Name: travelagent-captcha-solver
Runtime: Python 3
Root Directory: python-captcha-solver
Build Command: pip install -r requirements.txt
Start Command: gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 captcha_solver:app
Health Check: /health
Auto-Deploy: ✅ Enabled
Region: Oregon
Plan: Free (or Starter)
```

**Environment Variables**:
- `GEMINI_API_KEY`
- `FLASK_ENV=production`
- `PORT=5000`

### Node.js Backend Service

```yaml
Name: travelagent-backend
Runtime: Node
Build Command: npm install && npm run build
Start Command: node server/index.js
Health Check: /health
Auto-Deploy: ✅ Enabled
Region: Oregon
Plan: Free (or Starter)
```

**Environment Variables**:
- `NODE_ENV=production`
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `GEMINI_API_KEY`
- `USE_GEMINI_FOR_CAPTCHA=true`
- `PYTHON_CAPTCHA_SOLVER_URL=https://your-captcha-solver.onrender.com`

---

## 🐛 Troubleshooting

### Python Service Won't Start

**Check these**:
1. **Logs**: Look for Python errors in Render logs
2. **Requirements**: All dependencies in `requirements.txt`?
3. **Gemini API Key**: Set correctly in environment?
4. **Gunicorn**: Make sure it's in `requirements.txt`

**Common fixes**:
```bash
# Update requirements.txt to include gunicorn
echo "gunicorn==21.2.0" >> python-captcha-solver/requirements.txt
git commit -am "Add gunicorn"
git push origin master
```

### Backend Can't Connect to Python Service

**Check**:
1. **URL**: `PYTHON_CAPTCHA_SOLVER_URL` set correctly?
2. **Health**: Python service `/health` endpoint working?
3. **Network**: Both services in same region?

**Fix**:
```bash
# In Render Dashboard -> Backend Service -> Environment
# Update PYTHON_CAPTCHA_SOLVER_URL to correct URL
PYTHON_CAPTCHA_SOLVER_URL=https://travelagent-captcha-solver.onrender.com
```

### Build Failures

**Python build fails**:
- Check Python version compatibility (Render uses Python 3.11+)
- Verify all packages in `requirements.txt` are compatible

**Node build fails**:
- Check Node version in `package.json`
- Verify all dependencies install correctly

### Cold Starts (Free Plan)

**Issue**: Services sleep after 15 min inactivity

**Solutions**:
1. **Upgrade to Starter plan** ($7/month, no cold starts)
2. **Keep-alive ping**: Use service like [UptimeRobot](https://uptimerobot.com/) to ping every 10 min
3. **Accept delay**: First request takes 30-60s to wake up

---

## 🔐 Security Best Practices

### Environment Variables

- ✅ **Never commit API keys** to Git
- ✅ Use Render's environment variable UI
- ✅ Mark sensitive variables as "secret"
- ✅ Rotate keys periodically

### Access Control

- ✅ Keep GitHub repo private (or use Render's deploy keys)
- ✅ Restrict API keys to specific services
- ✅ Monitor Render access logs

---

## 💰 Cost Estimation

### Free Plan (Both Services)

- **Cost**: $0/month
- **Limitations**:
  - Services sleep after 15 min inactivity
  - 750 hours/month free (shared across services)
  - Cold start delay (30-60s)

### Starter Plan ($7/month per service)

- **Cost**: $14/month (both services)
- **Benefits**:
  - No cold starts
  - Always responsive
  - Better for production

### Recommended Setup

- **Development**: Free plan
- **Production**: Starter plan for both services

---

## 📈 Monitoring & Logs

### View Logs

```bash
# In Render Dashboard
Services → [Service Name] → Logs
```

**What to monitor**:
- ✅ Service startup messages
- ✅ CAPTCHA solving attempts
- ✅ API errors
- ✅ Request/response times

### Set Up Alerts

1. Go to Service → Settings
2. Enable "Failure Notifications"
3. Add email or Slack webhook
4. Get notified on:
   - Deployment failures
   - Service crashes
   - Health check failures

---

## 🚀 Deployment Workflow

### Standard Workflow

```bash
# 1. Make changes locally
vim server/index.js

# 2. Test locally
npm run dev

# 3. Commit changes
git add .
git commit -m "Add new feature"

# 4. Push to master (triggers auto-deploy)
git push origin master

# 5. Monitor in Render Dashboard
# Both services will rebuild automatically

# 6. Verify deployment
curl https://your-backend.onrender.com/health
curl https://your-captcha-solver.onrender.com/health
```

### Rollback if Needed

```bash
# In Render Dashboard
Service → Manual Deploy → Select previous commit → Deploy
```

---

## ✅ Success Checklist

- [ ] `render.yaml` pushed to GitHub
- [ ] Both services created in Render
- [ ] All environment variables set
- [ ] Auto-deploy enabled for both services
- [ ] Python service `/health` returns 200
- [ ] Backend `/health` returns 200
- [ ] Can perform a flight search
- [ ] CAPTCHA solving works
- [ ] Logs show no errors
- [ ] Test push to master triggers redeploy

---

## 🎉 You're Deployed!

Your TravelAgent app is now live with:

✅ **Automatic deployments** on push to master  
✅ **Python CAPTCHA solver** running independently  
✅ **Node.js backend** connected to Python service  
✅ **Health monitoring** for both services  
✅ **Zero-downtime deploys** (on Starter plan)  

**Next steps**:
1. Share your live URL
2. Monitor usage in Render dashboard
3. Upgrade to Starter plan when ready for production
4. Set up custom domain (optional)

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [Flask Deployment](https://flask.palletsprojects.com/en/2.3.x/deploying/)
