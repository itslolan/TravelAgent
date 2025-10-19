# 🤖 CAPTCHA Solving Feature

## Overview

Your TravelAgent app now supports **two methods** for solving CAPTCHAs:

1. **BrowserBase Auto-Solve** (Default) - Let BrowserBase's stealth mode handle it
2. **Gemini Computer Use** (Experimental) - Use **official Gemini 2.5 Computer Use API** to actively solve CAPTCHAs

## 🎯 Now Using Official Computer Use API

Implemented following [official documentation](https://ai.google.dev/gemini-api/docs/computer-use):
- ✅ Model: `gemini-2.5-computer-use-preview-10-2025`
- ✅ Normalized coordinates (0-999) with proper denormalization
- ✅ Official action names (`click_at`, `type_text_at`, etc.)
- ✅ Recommended screen size: 1440x900
- ✅ Function responses with screenshots and URL per documentation

## 🎯 Feature Flag

Control which method to use via environment variable:

```bash
USE_GEMINI_FOR_CAPTCHA=false  # Use BrowserBase (default)
USE_GEMINI_FOR_CAPTCHA=true   # Use Gemini Computer Use
```

## 🔄 How It Works

### **Method 1: BrowserBase Auto-Solve (Default)**

```
1. Navigate to Expedia
2. Gemini detects CAPTCHA on page
3. App waits passively (30s intervals)
4. BrowserBase's stealth mode + proxies handle CAPTCHA automatically
5. Continue when CAPTCHA is solved
```

**Pros:**
- ✅ No additional AI calls
- ✅ Lower cost
- ✅ Proven technology

**Cons:**
- ⚠️ May take longer
- ⚠️ Success rate depends on BrowserBase

### **Method 2: Gemini Computer Use (Experimental)**

```
1. Navigate to Expedia
2. Gemini detects CAPTCHA on page
3. Gemini Computer Use actively solves it:
   - Analyzes CAPTCHA type (reCAPTCHA, image selection, etc.)
   - Clicks checkboxes
   - Selects images
   - Types text
   - Submits answers
4. Continue when CAPTCHA is solved
```

**Pros:**
- ✅ Active solving approach
- ✅ Can handle complex CAPTCHAs
- ✅ Uses advanced AI vision

**Cons:**
- ⚠️ Experimental feature
- ⚠️ Additional Gemini API calls = higher cost
- ⚠️ May not work for all CAPTCHA types

## 🚀 How to Enable Gemini CAPTCHA Solving

### **Step 1: Update your `.env` file**

```bash
USE_GEMINI_FOR_CAPTCHA=true
```

### **Step 2: Restart your server**

```bash
npm run dev
# or
node server/index.js
```

### **Step 3: Test a search**

Watch the console logs for:
```
⚠️  CAPTCHA detected! Using Gemini Computer Use to solve it...
🤖 Attempting to solve CAPTCHA with Gemini Computer Use...
[Gemini actions: clicking, typing, etc.]
✅ Gemini successfully solved the CAPTCHA!
```

## 📊 Comparison

| Feature | BrowserBase | Gemini Computer Use |
|---------|------------|---------------------|
| **Approach** | Passive (stealth) | Active (AI solving) |
| **Speed** | Slower (wait for auto) | Faster (immediate action) |
| **Success Rate** | Good | Experimental |
| **Cost** | Lower | Higher (more API calls) |
| **Complexity** | Simple | Complex |
| **CAPTCHA Types** | Most common types | Flexible, learns |

## 🧪 Testing & Experimentation

### **To Test:**

1. Enable the feature: `USE_GEMINI_FOR_CAPTCHA=true`
2. Run multiple searches
3. Monitor console logs
4. Check success rate
5. Compare with BrowserBase method

### **What to Watch:**

**Success Indicators:**
```
✅ Gemini successfully solved the CAPTCHA!
✅ Gemini confirmed: Flight results are ready!
```

**Failure Indicators:**
```
⚠️  Gemini could not solve CAPTCHA. Continuing to wait...
❌ Gemini failed to solve CAPTCHA: [error message]
```

### **To Compare:**

Run 10 searches with each method:

**With BrowserBase:**
```bash
USE_GEMINI_FOR_CAPTCHA=false
# Run searches, track:
# - Time to solve CAPTCHA
# - Success rate
# - Total Gemini API calls
```

**With Gemini:**
```bash
USE_GEMINI_FOR_CAPTCHA=true
# Run searches, track:
# - Time to solve CAPTCHA
# - Success rate
# - Total Gemini API calls
```

## 🔧 How to Disable (Revert to BrowserBase)

If the experiment doesn't work well:

### **Step 1: Update `.env`**

```bash
USE_GEMINI_FOR_CAPTCHA=false
```

### **Step 2: Restart server**

```bash
npm run dev
```

That's it! The app will go back to letting BrowserBase handle CAPTCHAs.

## 📝 Implementation Details

### **Code Flow:**

```javascript
// In searchFlightsWithProgress()
while (!pageReady) {
  // Check page state with Gemini
  const readinessCheck = await checkPageReadiness(page);
  
  if (readinessCheck.pageState === 'captcha') {
    // Check flag
    const useGeminiForCaptcha = process.env.USE_GEMINI_FOR_CAPTCHA === 'true';
    
    if (useGeminiForCaptcha) {
      // Use Gemini to solve
      const solved = await solveCaptchaWithGemini(page, onProgress);
      if (solved) {
        // Check page again
      }
    } else {
      // Wait for BrowserBase to solve
      await wait(30000);
    }
  }
}
```

### **Gemini CAPTCHA Solver:**

```javascript
async function solveCaptchaWithGemini(page, onProgress) {
  const task = "Solve the CAPTCHA and get past it...";
  
  // Uses Gemini Computer Use to:
  // 1. Analyze CAPTCHA type
  // 2. Take appropriate actions (click, type, select)
  // 3. Submit answer
  // 4. Wait for page to proceed
  
  return await runGeminiAgentLoop({ page, task, onProgress });
}
```

## 💰 Cost Considerations

### **BrowserBase Method:**
- **Gemini Calls**: 1 check every 30s (vision only)
- **Cost**: ~10-20 checks per CAPTCHA = $0.01-0.02

### **Gemini Computer Use Method:**
- **Gemini Calls**: 1 check + agent loop (10 iterations max)
- **Cost**: ~1 check + 5-10 actions = $0.05-0.10

**Estimated cost increase:** 3-5x when using Gemini Computer Use

## 🎯 Recommendations

### **Use BrowserBase (Default) When:**
- ✅ You want to minimize costs
- ✅ BrowserBase is solving CAPTCHAs reliably
- ✅ You don't mind waiting a bit longer

### **Try Gemini Computer Use When:**
- ✅ BrowserBase is failing to solve CAPTCHAs
- ✅ You need faster CAPTCHA solving
- ✅ You want to experiment with AI-powered solving
- ✅ Cost is less of a concern

## 🐛 Troubleshooting

### **Issue: Gemini can't solve CAPTCHA**

**Check:**
1. Is the CAPTCHA type supported? (reCAPTCHA, image selection work best)
2. Check Gemini logs for specific errors
3. Try increasing MAX_ITERATIONS in geminiComputerUse.js
4. Fall back to BrowserBase method

### **Issue: High costs with Gemini method**

**Solution:**
1. Disable feature: `USE_GEMINI_FOR_CAPTCHA=false`
2. Use BrowserBase method instead
3. Monitor BrowserBase CAPTCHA success rate

### **Issue: Neither method works**

**Possible causes:**
1. Expedia is blocking both methods
2. CAPTCHA type is too complex
3. Network/API issues

**Try:**
1. Check BrowserBase dashboard for session logs
2. Review Gemini API quota
3. Test with different airports/dates

## 📈 Monitoring

### **Key Metrics to Track:**

1. **CAPTCHA Detection Rate**
   - How often are CAPTCHAs encountered?

2. **Solving Success Rate**
   - BrowserBase: % of CAPTCHAs solved
   - Gemini: % of CAPTCHAs solved

3. **Time to Solve**
   - BrowserBase: Average time
   - Gemini: Average time

4. **Cost per Search**
   - BrowserBase method cost
   - Gemini method cost

5. **Overall Success Rate**
   - Searches that complete successfully

## 🎓 Learning & Iteration

This is an **experimental feature**. Based on your results:

1. **If Gemini works better**: Keep it enabled
2. **If BrowserBase works better**: Disable it
3. **If both struggle**: May need to explore other solutions

The beauty of this feature flag is you can easily switch between methods and compare results!

---

**Good luck with your experiment!** 🚀
