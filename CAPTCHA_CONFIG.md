# CAPTCHA Configuration Guide

## Minion Creation Delay

The system supports configurable delays between creating multiple minions with CAPTCHAs. This is useful for testing the CAPTCHA solving modal with multiple minions appearing sequentially.

### Configuration Options

#### Backend Configuration
Edit `/server/config/captchaConfig.js`:

```javascript
simulation: {
  // Delay between creating multiple minions with CAPTCHAs (in milliseconds)
  // Set to 0 for no delay (all minions created simultaneously)
  minionCreationDelay: 5000, // 5 seconds default
  
  // Probability of simulating multiple minions (0.0 to 1.0)
  multiMinionProbability: 0.4, // 40% chance
  
  // Range of minions to create when simulating multiple
  minMinions: 2,
  maxMinions: 4
}
```

#### Environment Variable
You can also set the delay via environment variable:

```bash
# Set 5 second delay
MINION_CREATION_DELAY=5000 npm start

# No delay (simultaneous creation)
MINION_CREATION_DELAY=0 npm start

# 10 second delay
MINION_CREATION_DELAY=10000 npm start
```

### Examples

#### No Delay (Simultaneous)
```javascript
minionCreationDelay: 0
```
All minions with CAPTCHAs appear in the queue immediately.

#### 5 Second Delay (Default)
```javascript
minionCreationDelay: 5000
```
Each minion appears 5 seconds after the previous one.

#### 10 Second Delay
```javascript
minionCreationDelay: 10000
```
Each minion appears 10 seconds after the previous one.

### Behavior

When multiple minions are simulated:
1. First minion CAPTCHA appears immediately
2. System waits `minionCreationDelay` milliseconds
3. Second minion CAPTCHA appears
4. System waits `minionCreationDelay` milliseconds
5. Third minion CAPTCHA appears
6. And so on...

If `minionCreationDelay` is set to `0`, all minions are created without any delay between them.

### Frontend Configuration

The frontend config at `/src/config/captchaConfig.js` mirrors these settings for consistency:

```javascript
simulation: {
  minionCreationDelay: 5000, // 5 seconds default
  multiMinionProbability: 0.4,
  minMinions: 2,
  maxMinions: 4
}
```

### Testing

To test different delay configurations:

1. **No delay**: Set `minionCreationDelay: 0` - all CAPTCHAs appear instantly
2. **Short delay**: Set `minionCreationDelay: 2000` - 2 seconds between each
3. **Normal delay**: Set `minionCreationDelay: 5000` - 5 seconds between each (default)
4. **Long delay**: Set `minionCreationDelay: 10000` - 10 seconds between each

### Console Output

The system logs the delay configuration:

```
🎭 Simulating 3 minions with CAPTCHAs
⏱️  Minion creation delay: 5000ms between each minion
🤖 Minion 1/3: minion_123_abc (YVR-DEL → DEL-YVR)
⏳ Waiting 5000ms before creating next minion...
🤖 Minion 2/3: minion_456_def (LAX-LHR → LHR-LAX)
⏳ Waiting 5000ms before creating next minion...
🤖 Minion 3/3: minion_789_ghi (JFK-CDG → CDG-JFK)
```

Or with no delay:

```
🎭 Simulating 3 minions with CAPTCHAs
⚡ No delay - creating all minions simultaneously
🤖 Minion 1/3: minion_123_abc (YVR-DEL → DEL-YVR)
🤖 Minion 2/3: minion_456_def (LAX-LHR → LHR-LAX)
🤖 Minion 3/3: minion_789_ghi (JFK-CDG → CDG-JFK)
```
