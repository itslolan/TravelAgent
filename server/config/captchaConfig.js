/**
 * Server-side CAPTCHA Solving Configuration
 * 
 * This configuration allows switching between different CAPTCHA solving modes:
 * - HUMAN: Shows modal for human to solve CAPTCHAs manually
 * - AI: Uses Python Gemini Computer Use model for automatic solving
 */

const CAPTCHA_SOLVING_MODES = {
  HUMAN: 'human',
  AI: 'ai'
};

const captchaConfig = {
  // Current mode - change this to switch between human and AI solving
  mode: process.env.CAPTCHA_MODE || CAPTCHA_SOLVING_MODES.HUMAN, // Change to 'ai' to revert to Python AI
  
  // Human solving settings
  human: {
    // Maximum time to wait for human to solve CAPTCHA (in seconds)
    maxWaitTime: parseInt(process.env.CAPTCHA_HUMAN_MAX_WAIT) || 300, // 5 minutes
    
    // Polling interval to check if CAPTCHA is solved (in milliseconds)
    pollInterval: 2000,
    
    // Show progress and timer
    showProgress: true,
    
    // Auto-close modal after successful solve
    autoClose: false
  },
  
  // AI solving settings (Python Gemini Computer Use)
  ai: {
    // Maximum iterations for AI to attempt CAPTCHA solving
    maxIterations: 15,
    
    // Timeout for each AI attempt (in seconds)
    attemptTimeout: 30,
    
    // Show AI progress in modal
    showAiProgress: true,
    
    // Python service URL
    pythonServiceUrl: process.env.PYTHON_CAPTCHA_SERVICE_URL || 'http://localhost:5000'
  },
  
  // Simulation settings
  simulation: {
    // Delay between creating multiple minions with CAPTCHAs (in milliseconds)
    // Set to 0 for no delay (all minions created simultaneously)
    minionCreationDelay: parseInt(process.env.MINION_CREATION_DELAY) || 5000, // 5 seconds default
    multiMinionProbability: 0.4, // 40% chance of multiple minions
    minMinions: 2,
    maxMinions: 4
  },
  
  // General settings
  general: {
    // Maximum number of CAPTCHAs to handle per search session
    maxCaptchasPerSession: 5,
    
    // Retry failed CAPTCHA attempts
    retryFailedAttempts: true,
    
    // Log CAPTCHA solving attempts for debugging
    enableLogging: process.env.NODE_ENV !== 'production'
  }
};

/**
 * Get current CAPTCHA solving mode
 */
const getCaptchaMode = () => captchaConfig.mode;

/**
 * Check if human solving is enabled
 */
const isHumanSolvingEnabled = () => captchaConfig.mode === CAPTCHA_SOLVING_MODES.HUMAN;

/**
 * Check if AI solving is enabled
 */
const isAiSolvingEnabled = () => captchaConfig.mode === CAPTCHA_SOLVING_MODES.AI;

/**
 * Get configuration for current mode
 */
const getCurrentModeConfig = () => {
  return captchaConfig[captchaConfig.mode] || {};
};

/**
 * Update CAPTCHA solving mode (for runtime switching)
 */
const setCaptchaMode = (mode) => {
  if (Object.values(CAPTCHA_SOLVING_MODES).includes(mode)) {
    captchaConfig.mode = mode;
    console.log(`🔄 CAPTCHA solving mode changed to: ${mode.toUpperCase()}`);
    return true;
  } else {
    console.error(`❌ Invalid CAPTCHA mode: ${mode}`);
    return false;
  }
};

/**
 * Log CAPTCHA event if logging is enabled
 */
const logCaptchaEvent = (event, data = {}) => {
  if (captchaConfig.general.enableLogging) {
    console.log(`🤖 CAPTCHA Event [${event}]:`, data);
  }
};

module.exports = {
  CAPTCHA_SOLVING_MODES,
  captchaConfig,
  getCaptchaMode,
  isHumanSolvingEnabled,
  isAiSolvingEnabled,
  getCurrentModeConfig,
  setCaptchaMode,
  logCaptchaEvent
};
