# Timeout & Retry System for Minions

## ✅ Feature Complete!

I've implemented a robust timeout and retry system that prevents minions from hanging indefinitely and ensures the UI always gets final results.

## 🎯 Problem Solved

### **Before:**
- Minions could hang forever on "Debugging connection was closed"
- UI stuck at "Updating results... (4/6)" indefinitely
- No way to recover from failed sessions
- User has to manually refresh the page

### **After:**
- **1-minute timeout** per minion
- **Automatic retry** (1 retry per failed minion)
- **Visual feedback** for retry and failure states
- **Final results** shown even if some minions fail
- **No hanging** - system always completes

## 📊 How It Works

### **Timeout System:**

```javascript
// Configuration
MINION_TIMEOUT_MS = 60000  // 1 minute
MAX_RETRIES = 1            // 1 retry per minion

// Wrapper with timeout
async function searchWithTimeout(searchParams, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Minion timed out after 60 seconds'));
    }, timeoutMs);

    searchFlightsWithProgress(searchParams)
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}
```

### **Retry Logic:**

```javascript
async function searchWithRetry({...params, maxRetries = 1}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Notify UI of retry
        onProgress({
          status: 'retrying',
          message: `Retrying search (attempt ${attempt + 1}/2)...`,
          minionId,
          attempt
        });
      }

      // Try with timeout
      const result = await searchWithTimeout(params, 60000);
      return result; // Success!
      
    } catch (error) {
      if (attempt < maxRetries) {
        continue; // Retry
      } else {
        // Final failure
        onProgress({
          status: 'minion_failed_final',
          minionId,
          error: error.message
        });
        throw error;
      }
    }
  }
}
```

### **Failure Handling:**

```javascript
// Use Promise.allSettled instead of Promise.all
const results = await Promise.allSettled(
  batch.map(({combo, minionId, handler}) =>
    searchWithRetry({...params, minionId, onProgress: handler})
  )
);

// Track failures
results.forEach((result, index) => {
  if (result.status === 'rejected') {
    failedMinions.push({
      minionId,
      combo,
      error: result.reason.message
    });
    
    processedMinions++; // Count as processed
    
    // Send final results if this was the last minion
    if (processedMinions === totalCombinations) {
      sendFinalResults();
    }
  }
});
```

## 🎨 Visual States

### **1. Normal State (Blue)**
```
┌─────────────────┐
│  Minion #2      │  ← Blue border
│  Nov 2-27       │
│   [LIVE] 🔵     │
│  ┌───────────┐  │
│  │  Browser  │  │
│  └───────────┘  │
└─────────────────┘
```

### **2. Retrying State (Yellow)**
```
┌─────────────────┐
│  Minion #2      │  ← Yellow border
│  (Retrying...)  │  ← Yellow text
│   [RETRY] 🟡    │
│  ┌───────────┐  │
│  │  Browser  │  │  ← New session
│  └───────────┘  │
│       🔄        │  ← Spinning icon
└─────────────────┘
```

### **3. Failed State (Red)**
```
┌─────────────────┐
│  Minion #2   ✗  │  ← Red border + X icon
│  Nov 2-27       │
│                 │
│       ✗         │  ← Large X icon
│  Search Failed  │
│  Timeout after  │
│     retries     │
└─────────────────┘
(Disappears after 5 seconds)
```

### **4. Success State (Green)**
```
┌─────────────────┐
│  Minion #2   ✓  │  ← Green border + checkmark
│  Nov 2-27       │
│                 │
│       ✓         │  ← Large checkmark
│   Complete!     │
│                 │
└─────────────────┘
(Disappears after 3 seconds)
```

## 🔄 Timeline Example

### **Scenario: 6 minions, 2 timeout and retry**

```
0:00 - Start search
0:02 - Minions 1, 2, 3 spawn

0:15 - Minion 1 completes ✓
       → Results appear

0:20 - Minion 2 completes ✓
       → Results update

1:02 - Minion 3 TIMEOUT (after 60s)
       → Card turns YELLOW
       → Shows "RETRY" badge
       → Spawns new session for Minion 3

1:05 - Minions 4, 5, 6 spawn

1:20 - Minion 4 completes ✓
       → Results update

1:35 - Minion 5 completes ✓
       → Results update

2:02 - Minion 3 TIMEOUT AGAIN (retry failed)
       → Card turns RED
       → Shows "Search Failed"
       → Disappears after 5s
       → processedMinions = 5

2:05 - Minion 6 TIMEOUT
       → Card turns YELLOW
       → Retrying...

2:20 - Minion 6 completes ✓ (retry succeeded!)
       → Results update
       → processedMinions = 6

2:20 - ALL PROCESSED
       → Final results shown
       → "5 successful • 1 failed"
       → Warning: "1 search failed due to timeout"
```

## 📈 State Tracking

### **Backend:**
```javascript
let completedMinions = 0;    // Successful only
let processedMinions = 0;    // Successful + Failed
let failedMinions = [];      // Failed minion details

// Success
completedMinions++;
processedMinions++;

// Failure
processedMinions++;
failedMinions.push({...});

// Check if done
if (processedMinions === totalCombinations) {
  sendFinalResults();
}
```

### **Frontend:**
```javascript
// Minion states
activeMinions: [
  {
    minionId: 2,
    sessionId: '...',
    debuggerUrl: '...',
    isRetrying: false,  // Yellow state
    isFailed: false,    // Red state
    error: null
  }
]

completedMinions: [1, 3, 5]  // Green state

// Update on retry
if (data.status === 'retrying') {
  setActiveMinions(prev => prev.map(m =>
    m.minionId === data.minionId
      ? { ...m, isRetrying: true, retryAttempt: data.attempt }
      : m
  ));
}

// Update on failure
if (data.status === 'minion_failed_final') {
  setActiveMinions(prev => prev.map(m =>
    m.minionId === data.minionId
      ? { ...m, isFailed: true, error: data.error }
      : m
  ));
  
  setTimeout(() => {
    setActiveMinions(prev => prev.filter(m => m.minionId !== data.minionId));
  }, 5000); // Remove after 5s
}
```

## 🎯 Key Features

### **1. Automatic Timeout**
- ✅ 60-second limit per minion
- ✅ Prevents infinite hanging
- ✅ Triggers retry automatically

### **2. Smart Retry**
- ✅ 1 automatic retry per failed minion
- ✅ New BrowserBase session spawned
- ✅ Visual "RETRY" indicator
- ✅ Spinning refresh icon

### **3. Graceful Failure**
- ✅ Final failure after 2 attempts
- ✅ Red "Failed" state shown
- ✅ Error message displayed
- ✅ Doesn't block other minions

### **4. Always Complete**
- ✅ Final results shown even with failures
- ✅ Warning message if some failed
- ✅ Count: "5 successful • 1 failed"
- ✅ UI never stuck waiting

### **5. Visual Feedback**
- ✅ Blue: Normal operation
- ✅ Yellow: Retrying
- ✅ Green: Success
- ✅ Red: Failed
- ✅ Icons: ✓, ✗, 🔄

## 🔧 Configuration

### **Adjust Timeout:**
```javascript
// In flexibleSearchService.js
const MINION_TIMEOUT_MS = 90000; // Change to 90 seconds
```

### **Adjust Retries:**
```javascript
// In flexibleSearchService.js
const MAX_RETRIES = 2; // Change to 2 retries (3 total attempts)
```

### **Adjust Display Time:**
```javascript
// In App.jsx

// Failed minion display time
setTimeout(() => {
  setActiveMinions(prev => prev.filter(m => m.minionId !== data.minionId));
}, 5000); // Change to 10000 for 10 seconds

// Success minion display time
setTimeout(() => {
  setActiveMinions(prev => prev.filter(m => m.minionId !== data.minionId));
  setCompletedMinions(prev => prev.filter(id => id !== data.minionId));
}, 3000); // Change to 5000 for 5 seconds
```

## 📊 Benefits

### **For Users:**
- ✅ **No more hanging**: Always get results
- ✅ **Transparency**: See retries happening
- ✅ **Confidence**: Know what failed and why
- ✅ **Faster**: Don't wait forever for stuck minions

### **For System:**
- ✅ **Reliability**: Handles BrowserBase issues
- ✅ **Resilience**: Retries recover from transient errors
- ✅ **Completeness**: Always sends final results
- ✅ **Debugging**: Clear error messages

## 🚨 Edge Cases Handled

### **1. All Minions Fail**
```
Result: Shows error message
Action: "All searches failed. Please try again."
```

### **2. Some Minions Fail**
```
Result: Shows results from successful ones
Warning: "2 searches failed due to timeout"
```

### **3. Retry Succeeds**
```
Result: Counts as success
Display: Green checkmark
```

### **4. Retry Fails**
```
Result: Counts as failure
Display: Red X, then disappears
```

### **5. Last Minion Fails**
```
Result: Triggers final results
Display: Shows results from others
```

## 🎉 Summary

The timeout & retry system ensures:

1. ✅ **No infinite waiting** - 60s timeout per minion
2. ✅ **Automatic recovery** - 1 retry per failure
3. ✅ **Visual feedback** - Yellow (retry), Red (failed), Green (success)
4. ✅ **Always completes** - Final results even with failures
5. ✅ **Clear messaging** - Users know what happened

**Your app is now production-ready with robust error handling!** 🚀
