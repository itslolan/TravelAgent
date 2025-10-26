const axios = require('axios');
const crypto = require('crypto');
const { retryWithBackoff, browserbaseCircuitBreaker } = require('./proxyHealthCheck');

/**
 * Generate a valid UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate or retrieve a consistent UUID for a user
 * This allows session persistence across multiple searches
 */
const userContextCache = new Map();

function getUserContextId(userId) {
  if (!userId) {
    // Generate random UUID for anonymous users
    return generateUUID();
  }
  
  // Check cache first
  if (userContextCache.has(userId)) {
    return userContextCache.get(userId);
  }
  
  // Generate new UUID and cache it
  const contextId = generateUUID();
  userContextCache.set(userId, contextId);
  
  // Auto-cleanup after 24 hours
  setTimeout(() => userContextCache.delete(userId), 24 * 60 * 60 * 1000);
  
  return contextId;
}

/**
 * Create BrowserBase session with enhanced features:
 * - Session context persistence (prevents CAPTCHA re-triggers)
 * - Geolocation control
 * - Retry logic with exponential backoff
 * - Circuit breaker protection
 * 
 * Based on: https://roundproxies.com/blog/browserbase-proxies/
 */
async function createEnhancedSession(options = {}) {
  const {
    projectId = process.env.BROWSERBASE_PROJECT_ID,
    apiKey = process.env.BROWSERBASE_API_KEY,
    userId = null,
    countryCode = 'US',
    persistContext = true,
    enableProxies = true
  } = options;

  // Check circuit breaker
  if (!browserbaseCircuitBreaker.allow()) {
    const state = browserbaseCircuitBreaker.getState();
    throw new Error(`Circuit breaker is OPEN. Too many BrowserBase failures. Retry after ${new Date(state.openUntil).toISOString()}`);
  }

  // Configure external proxy if credentials are provided
  let proxyConfig = enableProxies;
  
  if (enableProxies && process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
    // Use external proxy (e.g., RoundProxies.com)
    proxyConfig = [
      {
        type: "external",
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      }
    ];
    console.log('🔒 Using external proxy:', process.env.PROXY_SERVER);
  } else if (enableProxies) {
    // Use BrowserBase's built-in proxies
    console.log('🌐 Using BrowserBase built-in proxies');
  }

  try {
    // Create session with retry logic
    const session = await retryWithBackoff(async () => {
      console.log('🌐 Creating BrowserBase session with enhanced features...');
      
      const response = await axios.post(
        'https://www.browserbase.com/v1/sessions',
        {
          projectId,
          proxies: proxyConfig,
          browserSettings: {
            // Disable BrowserBase's built-in CAPTCHA solver to use our custom human/AI solver
            solveCaptchas: false,
            
            // Note: Context persistence disabled for now
            // BrowserBase requires pre-existing context IDs from their API
            // To enable: First create context, save ID, then reuse it
            // context: persistContext ? {
            //   id: getUserContextId(userId),
            //   persist: true
            // } : undefined,
            
            // Fingerprint settings for geolocation
            fingerprint: {
              locales: [`en-${countryCode}`],
              screen: {
                maxWidth: 1920,
                maxHeight: 1080
              }
            },
            
            // Viewport settings
            viewport: {
              width: 1440,
              height: 900
            },
            
            // Optional: Timezone alignment (if supported by plan)
            // timezoneId: countryCode === 'US' ? 'America/New_York' : undefined
          }
        },
        {
          headers: {
            'x-bb-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30s timeout for proxy connection
        }
      );

      console.log('✅ Session created:', response.data.id);
      console.log(`   Context: ${persistContext ? 'Persistent' : 'Temporary'}`);
      console.log(`   Location: ${countryCode}`);
      
      // Log proxy configuration
      if (Array.isArray(proxyConfig) && proxyConfig.length > 0) {
        console.log(`   Proxies: External (${proxyConfig[0].server})`);
      } else if (enableProxies) {
        console.log(`   Proxies: BrowserBase Built-in`);
      } else {
        console.log(`   Proxies: Disabled`);
      }
      
      // Record success in circuit breaker
      browserbaseCircuitBreaker.record(true);
      
      return response.data;
    }, {
      maxRetries: 3,
      baseDelay: 2000
    });

    return session;
    
  } catch (error) {
    console.error('❌ Failed to create BrowserBase session:', error.message);
    
    // Record failure in circuit breaker
    browserbaseCircuitBreaker.record(false);
    
    throw error;
  }
}

/**
 * Setup request interception for a page
 * - Block unnecessary resources (faster loads)
 * - Log requests for debugging
 * - Monitor network activity
 */
async function setupRequestInterception(page, options = {}) {
  const {
    blockAds = false,
    blockAnalytics = false,
    blockImages = false,
    logRequests = false
  } = options;

  const blockedDomains = [
    ...(blockAds ? [
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'facebook.com/tr',
      'connect.facebook.net'
    ] : []),
    ...(blockAnalytics ? [
      'google-analytics.com',
      'googletagmanager.com',
      'analytics.google.com',
      'hotjar.com',
      'mouseflow.com'
    ] : [])
  ];

  const blockedTypes = [
    ...(blockImages ? ['image'] : [])
  ];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const resourceType = request.resourceType();

    // Check if domain should be blocked
    const shouldBlockDomain = blockedDomains.some(domain => url.includes(domain));
    
    // Check if resource type should be blocked
    const shouldBlockType = blockedTypes.includes(resourceType);

    if (shouldBlockDomain || shouldBlockType) {
      if (logRequests) {
        console.log(`🚫 Blocked: ${resourceType} - ${url.substring(0, 100)}`);
      }
      await route.abort();
      return;
    }

    // Log if enabled
    if (logRequests && resourceType === 'document') {
      console.log(`📄 Loading: ${url}`);
    }

    // Continue with request
    await route.continue();
  });

  console.log('🛡️  Request interception enabled');
  console.log(`   Blocking ads: ${blockAds}`);
  console.log(`   Blocking analytics: ${blockAnalytics}`);
  console.log(`   Blocking images: ${blockImages}`);
}

/**
 * Get session debug information
 */
async function getSessionInfo(sessionId) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  
  try {
    const response = await axios.get(
      `https://www.browserbase.com/v1/sessions/${sessionId}`,
      {
        headers: {
          'x-bb-api-key': apiKey
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to get session info:', error.message);
    return null;
  }
}

module.exports = {
  createEnhancedSession,
  setupRequestInterception,
  getSessionInfo
};
