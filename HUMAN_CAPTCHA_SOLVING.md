# 🤖➡️👤 Human CAPTCHA Solving Feature

## Overview

This experimental feature allows users to manually solve CAPTCHAs when browser sessions encounter them during flight searches. The system can be easily toggled between **Human Solving** and **AI Solving** (Python Gemini Computer Use) modes.

## 🎯 Key Features

### **Human CAPTCHA Solving Mode**
- **Modal Interface**: Large embedded browser for CAPTCHA solving
- **Progress Tracking**: Shows CAPTCHA counter and remaining count
- **Live Session**: Real-time BrowserBase embedded view
- **Timer**: Tracks time spent solving CAPTCHAs
- **Easy Toggle**: Can revert to AI mode with simple config change

### **AI CAPTCHA Solving Mode** (Existing)
- **Python Gemini Computer Use**: Automatic CAPTCHA solving
- **No User Interaction**: Fully automated process
- **Current Implementation**: Uses existing Python service

---

## 🔧 Configuration

### **Toggle Between Modes**

**Frontend Configuration** (`src/config/captchaConfig.js`):
```javascript
export const captchaConfig = {
  mode: CAPTCHA_SOLVING_MODES.HUMAN, // Change to HUMAN or AI
  // ...
};
```

**Backend Configuration** (`server/config/captchaConfig.js`):
```javascript
const captchaConfig = {
  mode: process.env.CAPTCHA_MODE || CAPTCHA_SOLVING_MODES.HUMAN, // Change to 'ai' to revert
  // ...
};
```

**Environment Variable**:
```bash
# Set in .env file
CAPTCHA_MODE=human  # or 'ai' for Python Gemini Computer Use
```

---

## 🏗️ Architecture

### **Frontend Components**

**1. `CaptchaSolvingModal.jsx`**
- Large modal with embedded BrowserBase session
- Progress tracking and timer
- Continue/Cancel buttons
- Mode indicator (Human vs AI)

**2. `SearchPage.jsx` Updates**
- CAPTCHA detection event handling
- Modal state management
- API communication for CAPTCHA completion

**3. Configuration Files**
- `src/config/captchaConfig.js` - Frontend configuration
- Easy mode switching and settings

### **Backend Services**

**1. CAPTCHA Detection** (`browserbaseService.js`)
```javascript
// Detects CAPTCHAs using multiple methods
async function detectCaptcha(page) {
  // DOM selectors, text patterns, iframe analysis
}
```

**2. CAPTCHA Handling** (`browserbaseService.js`)
```javascript
// Routes to human or AI solving based on config
async function handleCaptcha(page, captchaInfo, sessionId, debuggerUrl, onProgress, minionId) {
  if (isHumanSolvingEnabled()) {
    // Show modal, wait for human
  } else {
    // Use Python AI service
  }
}
```

**3. API Endpoints** (`routes/captcha.js`)
- `POST /api/captcha-solved` - Human completion notification
- `GET /api/captcha-status/:minionId` - Check solving status
- `GET /api/captcha-mode` - Get current mode
- `DELETE /api/captcha-session/:minionId` - Clean up session

**4. Configuration** (`config/captchaConfig.js`)
- Server-side mode management
- Environment variable support
- Logging and monitoring

---

## 🔄 Flow Diagram

### **Human Solving Mode**
```
1. Browser navigates to flight search
2. CAPTCHA detected → detectCaptcha()
3. handleCaptcha() → Human mode
4. Frontend receives 'captcha_detected' event
5. CaptchaSolvingModal opens with embedded browser
6. User solves CAPTCHA manually
7. User clicks "Continue" → POST /api/captcha-solved
8. Backend polls for completion → waitForHumanCaptchaSolution()
9. CAPTCHA marked as solved → Continue search
```

### **AI Solving Mode**
```
1. Browser navigates to flight search  
2. CAPTCHA detected → detectCaptcha()
3. handleCaptcha() → AI mode
4. solveCaptchaWithPythonService() called
5. Python Gemini Computer Use solves automatically
6. Continue search
```

---

## 🎮 User Experience

### **When CAPTCHA is Detected**

**Human Mode:**
1. **Modal Appears**: Large overlay with embedded browser
2. **Clear Instructions**: "Please solve the CAPTCHA below"
3. **Progress Indicator**: Shows current CAPTCHA (1 of 3, etc.)
4. **Live Timer**: Tracks solving time
5. **Interactive Browser**: Full BrowserBase session embedded
6. **Continue Button**: Click when CAPTCHA is solved

**AI Mode:**
1. **Status Update**: "CAPTCHA detected - AI is solving..."
2. **Progress Indicator**: Shows AI solving progress
3. **Automatic**: No user interaction required

### **Modal Features**

**Header:**
- Mode indicator (Human/AI)
- Progress counter (1 of 3)
- Close button

**Progress Bar:**
- Visual progress indicator
- Percentage complete
- Timer showing elapsed time
- Minion ID for tracking

**Instructions:**
- Clear guidance for users
- CAPTCHA type information
- Next steps

**Embedded Browser:**
- Full BrowserBase session
- Real-time interaction
- Same session as search process

**Footer:**
- Cancel search option
- Continue button (human mode)
- AI progress indicator (AI mode)

---

## 🔧 Implementation Details

### **CAPTCHA Detection Methods**

**1. DOM Selectors:**
```javascript
const captchaSelectors = [
  '[data-testid*="captcha"]',
  '[class*="captcha"]', 
  '.recaptcha-checkbox',
  '.g-recaptcha',
  '.h-captcha',
  // ... more selectors
];
```

**2. Text Pattern Analysis:**
```javascript
const captchaTextPatterns = [
  /verify.*human/i,
  /prove.*human/i,
  /captcha/i,
  /security.*check/i,
  // ... more patterns
];
```

**3. Iframe Detection:**
```javascript
// Checks for CAPTCHA service iframes
if (src.includes('recaptcha') || src.includes('hcaptcha')) {
  // CAPTCHA detected
}
```

### **State Management**

**Frontend State:**
```javascript
const [showCaptchaModal, setShowCaptchaModal] = useState(false);
const [currentCaptchaMinion, setCurrentCaptchaMinion] = useState(null);
const [captchaCount, setCaptchaCount] = useState(0);
const [currentCaptchaIndex, setCurrentCaptchaIndex] = useState(0);
const [captchaSessions, setCaptchaSessions] = useState(new Map());
```

**Backend State:**
```javascript
// In-memory session tracking
const captchaSessions = new Map();

// Stores: { sessionId, solved, timestamp, method }
```

### **API Communication**

**CAPTCHA Detected Event:**
```javascript
onProgress({
  status: 'captcha_detected',
  message: 'CAPTCHA detected - waiting for human to solve...',
  minionId,
  sessionId,
  debuggerUrl,
  captchaType: captchaInfo.type,
  captchaCount: 1,
  currentCaptcha: 1
});
```

**Human Completion:**
```javascript
await fetch('/api/captcha-solved', {
  method: 'POST',
  body: JSON.stringify({
    minionId: currentCaptchaMinion,
    sessionId: captchaSessions.get(currentCaptchaMinion)?.sessionId,
    solved: true
  })
});
```

---

## 🚀 Getting Started

### **1. Enable Human Solving Mode**

**Option A: Environment Variable**
```bash
# Add to .env file
CAPTCHA_MODE=human
```

**Option B: Config File**
```javascript
// src/config/captchaConfig.js
export const captchaConfig = {
  mode: CAPTCHA_SOLVING_MODES.HUMAN, // ← Change this
  // ...
};
```

### **2. Start the Application**
```bash
# Start backend
npm run dev

# Start frontend  
npm run dev:client
```

### **3. Test CAPTCHA Solving**
1. Perform a flight search
2. If CAPTCHA is encountered, modal will appear
3. Solve CAPTCHA in embedded browser
4. Click "Continue" to proceed

### **4. Revert to AI Mode**
```javascript
// Change config to:
mode: CAPTCHA_SOLVING_MODES.AI
```

---

## 🔄 Easy Reversion to AI Mode

### **Single Line Change**

**Frontend:**
```javascript
// src/config/captchaConfig.js
mode: CAPTCHA_SOLVING_MODES.AI, // ← Change HUMAN to AI
```

**Backend:**
```javascript
// server/config/captchaConfig.js  
mode: CAPTCHA_SOLVING_MODES.AI, // ← Change HUMAN to AI
```

**Or Environment Variable:**
```bash
CAPTCHA_MODE=ai
```

### **No Code Changes Required**
- All Python Gemini Computer Use code remains intact
- Existing AI solving logic is preserved
- Simple configuration toggle
- No breaking changes

---

## 📊 Monitoring & Logging

### **CAPTCHA Events Logged**
- `detected_by_selector` - DOM element detection
- `detected_by_text` - Text pattern detection  
- `detected_by_iframe` - Iframe analysis detection
- `handling_captcha` - Mode selection and processing
- `human_solved` - Human completion with timing
- `human_timeout` - Human solving timeout
- `ai_solved` - AI completion (existing)

### **Progress Events**
- `captcha_detected` - Initial detection
- `captcha_waiting` - Waiting for human (with countdown)
- `captcha_solved` - Completion notification
- `captcha_timeout` - Timeout reached

### **Debug Information**
- Session IDs and minion tracking
- Timing information
- CAPTCHA type and detection method
- Mode configuration status

---

## 🎯 Benefits

### **Human Solving Mode**
✅ **Higher Success Rate** - Humans excel at complex CAPTCHAs  
✅ **Visual Feedback** - User sees exactly what needs to be solved  
✅ **Real-time Control** - User maintains control over the process  
✅ **Debugging** - Easy to see what's happening in browser  
✅ **Flexibility** - Can handle any CAPTCHA type  

### **AI Solving Mode** (Existing)
✅ **Fully Automated** - No user interaction required  
✅ **Fast Processing** - AI attempts solving quickly  
✅ **Scalable** - Can handle multiple sessions simultaneously  
✅ **Consistent** - Same approach every time  

### **Experimental Toggle**
✅ **Risk-Free** - Easy to revert with single config change  
✅ **A/B Testing** - Can compare success rates  
✅ **Gradual Rollout** - Test with subset of users  
✅ **Fallback Option** - Switch modes if one fails  

---

## 🔮 Future Enhancements

### **Potential Improvements**
- **Hybrid Mode**: Try AI first, fallback to human
- **Multiple CAPTCHAs**: Handle sequences of CAPTCHAs  
- **Success Analytics**: Track success rates by mode
- **Auto-Detection**: Smarter CAPTCHA type detection
- **Mobile Support**: Responsive modal for mobile devices
- **Batch Processing**: Handle multiple minions with CAPTCHAs

### **Configuration Options**
- **Timeout Settings**: Configurable wait times
- **Retry Logic**: Automatic retries on failure
- **Notification System**: Email/SMS alerts for CAPTCHAs
- **Priority Queuing**: Handle urgent searches first

---

## 📝 Summary

This experimental human CAPTCHA solving feature provides a **flexible, user-controlled alternative** to the existing AI-based approach. The implementation is designed to be:

- **🔄 Easily Reversible** - Single config change to revert
- **🎯 User-Friendly** - Clear interface and instructions  
- **⚡ Non-Disruptive** - Preserves all existing functionality
- **📊 Monitorable** - Comprehensive logging and tracking
- **🔧 Configurable** - Multiple ways to control behavior

**The system maintains full backward compatibility while providing an enhanced user experience for CAPTCHA challenges.**
