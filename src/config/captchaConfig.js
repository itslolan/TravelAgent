/**
 * CAPTCHA Solving Configuration
 * 
 * This configuration allows switching between different CAPTCHA solving modes:
 * - HUMAN: Shows modal for human to solve CAPTCHAs manually
 * - AI: Uses Python Gemini Computer Use model for automatic solving
 */

export const CAPTCHA_SOLVING_MODES = {
  HUMAN: 'human',
  AI: 'ai'
};

export const captchaConfig = {
  // Current mode - change this to switch between human and AI solving
  mode: CAPTCHA_SOLVING_MODES.HUMAN, // Change to CAPTCHA_SOLVING_MODES.AI to revert to Python AI
  
  // Human solving settings
  human: {
    // Maximum time to wait for human to solve CAPTCHA (in seconds)
    maxWaitTime: 300, // 5 minutes
    
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
    showAiProgress: true
  },
  
  // Simulation settings (for testing multiple minions)
  simulation: {
    // Delay between creating multiple minions with CAPTCHAs (in milliseconds)
    // Set to 0 for no delay (all minions created simultaneously)
    minionCreationDelay: 5000, // 5 seconds default
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
    enableLogging: true
  }
};

/**
 * Get current CAPTCHA solving mode
 */
export const getCaptchaMode = () => captchaConfig.mode;

/**
 * Check if human solving is enabled
 */
export const isHumanSolvingEnabled = () => captchaConfig.mode === CAPTCHA_SOLVING_MODES.HUMAN;

/**
 * Check if AI solving is enabled
 */
export const isAiSolvingEnabled = () => captchaConfig.mode === CAPTCHA_SOLVING_MODES.AI;

/**
 * Get configuration for current mode
 */
export const getCurrentModeConfig = () => {
  return captchaConfig[captchaConfig.mode] || {};
};

/**
 * Update CAPTCHA solving mode (for runtime switching)
 */
export const setCaptchaMode = (mode) => {
  if (Object.values(CAPTCHA_SOLVING_MODES).includes(mode)) {
    captchaConfig.mode = mode;
    console.log(`🔄 CAPTCHA solving mode changed to: ${mode.toUpperCase()}`);
  } else {
    console.error(`❌ Invalid CAPTCHA mode: ${mode}`);
  }
};

// Export default config
export default captchaConfig;
