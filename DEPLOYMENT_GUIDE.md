# 🚀 TravelAgent Deployment Guide

Your app is ready to deploy! This guide covers multiple deployment options for your full-stack React + Express application.

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ GitHub account (to push your code)
- ✅ BrowserBase API key and Project ID
- ✅ Gemini API key
- ✅ Git repository initialized

## 🎯 Recommended: Deploy to Render (Easiest)

Render is perfect for full-stack Node.js apps and offers a free tier.

### **Step 1: Prepare Your Code**

Your app is already configured! The build process will:
1. Build the React frontend with Vite
2. Serve static files from Express
3. Handle API routes

### **Step 2: Push to GitHub**

```bash
# If you haven't already initialized git
git init
git add .
git commit -m "Initial commit - TravelAgent app"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/travelagent.git
git branch -M main
git push -u origin main
```

### **Step 3: Deploy on Render**

1. **Go to [render.com](https://render.com)** and sign up/login
2. **Click "New +"** → **"Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `travelagent` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`
   - **Plan**: Free (or paid for better performance)

5. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   BROWSERBASE_API_KEY=your_browserbase_api_key
   BROWSERBASE_PROJECT_ID=your_browserbase_project_id
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3001
   NODE_ENV=production
   ```

6. **Click "Create Web Service"**

7. **Wait for deployment** (5-10 minutes)

8. **Your app will be live at**: `https://travelagent-XXXX.onrender.com`

### **Step 4: Update Server to Serve Frontend**

The server needs to serve the built frontend files. I'll update this for you.

---

## 🔧 Alternative: Deploy to Railway

Railway is another excellent option with automatic deployments.

### **Steps:**

1. **Go to [railway.app](https://railway.app)** and sign up
2. **Click "New Project"** → **"Deploy from GitHub repo"**
3. **Select your repository**
4. **Railway auto-detects Node.js** and configures build
5. **Add Environment Variables** in the Railway dashboard:
   ```
   BROWSERBASE_API_KEY=your_key
   BROWSERBASE_PROJECT_ID=your_project_id
   GEMINI_API_KEY=your_key
   ```
6. **Deploy!** Railway handles the rest

---

## 🌐 Alternative: Deploy Frontend & Backend Separately

### **Frontend (Netlify/Vercel):**
- Deploy React app to Netlify or Vercel
- Set API URL as environment variable

### **Backend (Render/Railway/Heroku):**
- Deploy Express server separately
- Update CORS to allow frontend domain

---

## 📝 Environment Variables Reference

Make sure to set these in your deployment platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `BROWSERBASE_API_KEY` | Your BrowserBase API key | `bb_live_...` |
| `BROWSERBASE_PROJECT_ID` | Your BrowserBase project ID | `cbeee7fb-...` |
| `GEMINI_API_KEY` | Your Google Gemini API key | `AIza...` |
| `PORT` | Server port (usually auto-set) | `3001` |
| `NODE_ENV` | Environment mode | `production` |

---

## ⚠️ Important Notes

### **1. API Keys Security:**
- ✅ Never commit `.env` file to Git (already in `.gitignore`)
- ✅ Use environment variables in deployment platform
- ✅ Keep `.env.example` for reference only

### **2. CORS Configuration:**
If deploying frontend and backend separately, update CORS in `server/index.js`:
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
```

### **3. Build Command:**
The build process runs:
```bash
npm install && npm run build
```
This creates a `dist/` folder with your React app.

### **4. Start Command:**
```bash
node server/index.js
```

---

## 🧪 Testing Your Deployment

After deployment:

1. **Check Health Endpoint:**
   ```
   https://your-app.onrender.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Test Frontend:**
   ```
   https://your-app.onrender.com
   ```
   Should load the TravelAgent UI

3. **Test API:**
   Try a search to ensure BrowserBase and Gemini are working

---

## 🔍 Troubleshooting

### **Build Fails:**
- Check that all dependencies are in `package.json`
- Verify build command is correct
- Check build logs for errors

### **Server Won't Start:**
- Verify environment variables are set
- Check that PORT is configured correctly
- Review server logs

### **API Calls Fail:**
- Verify BrowserBase and Gemini API keys
- Check CORS configuration
- Review network logs

### **Minions Don't Spawn:**
- Ensure BrowserBase API key has correct permissions
- Check BrowserBase dashboard for session limits
- Verify project ID is correct

---

## 💰 Cost Considerations

### **Free Tier Limits:**

**Render Free:**
- ✅ 750 hours/month
- ⚠️ Spins down after 15 min inactivity
- ⚠️ Cold starts (10-30 seconds)

**Railway Free:**
- ✅ $5 free credit/month
- ✅ No sleep/cold starts
- ⚠️ Limited to credit amount

**BrowserBase:**
- Check your plan limits
- Monitor session usage
- Proxy bandwidth costs

**Gemini API:**
- Free tier available
- Monitor token usage

### **Recommended for Production:**
- Render: $7/month (no cold starts)
- Railway: Pay-as-you-go
- Or use a VPS (DigitalOcean, Linode)

---

## 🚀 Quick Deploy Checklist

- [ ] Push code to GitHub
- [ ] Sign up for Render/Railway
- [ ] Connect GitHub repository
- [ ] Set environment variables
- [ ] Configure build & start commands
- [ ] Deploy!
- [ ] Test health endpoint
- [ ] Test full search flow
- [ ] Monitor logs for errors

---

## 📚 Resources

- **Render Docs**: https://render.com/docs
- **Railway Docs**: https://docs.railway.app
- **BrowserBase**: https://docs.browserbase.com
- **Gemini API**: https://ai.google.dev/docs

---

## 🎉 Next Steps

After successful deployment:

1. **Share your app!** Get the public URL
2. **Monitor usage** in BrowserBase dashboard
3. **Set up analytics** (optional)
4. **Add custom domain** (optional)
5. **Enable HTTPS** (automatic on Render/Railway)

Your TravelAgent app will be live and ready to search flights! 🛫
