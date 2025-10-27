const { chromium } = require('playwright');
const axios = require('axios');
const { runGeminiAgentLoop, checkPageReadiness, solveCaptchaWithGemini } = require('./geminiComputerUse');
const { solveCaptchaWithPythonService } = require('./geminiPythonService');
const { searchMonitor } = require('./searchMonitor');
const { validateProxyHealth, retryWithBackoff, browserbaseCircuitBreaker } = require('./proxyHealthCheck');
const { createEnhancedSession, setupRequestInterception } = require('./sessionManager');
const { isHumanSolvingEnabled, logCaptchaEvent, captchaConfig } = require('../config/captchaConfig');
const { createHyperBrowserSession, stopHyperBrowserSession } = require('./hyperBrowserService');

/**
 * Get the configured browser provider
 * @returns {string} 'browserbase' or 'hyperbrowser'
 */
function getBrowserProvider() {
  const provider = process.env.BROWSER_PROVIDER || 'browserbase';
  if (!['browserbase', 'hyperbrowser'].includes(provider)) {
    console.warn(`⚠️  Invalid BROWSER_PROVIDER: ${provider}, defaulting to 'browserbase'`);
    return 'browserbase';
  }
  return provider;
}

/**
 * Detect if current page contains a CAPTCHA
 */
async function detectCaptcha(page) {
  try {
    // Common CAPTCHA selectors and text patterns
    const captchaSelectors = [
      '[data-testid*="captcha"]',
      '[class*="captcha"]',
      '[id*="captcha"]',
      '.recaptcha-checkbox',
      '#recaptcha',
      '.g-recaptcha',
      '.h-captcha',
      '.cf-turnstile',
      '[aria-label*="captcha"]',
      '[title*="captcha"]'
    ];

    const captchaTextPatterns = [
      /verify.*human/i,
      /prove.*human/i,
      /captcha/i,
      /security.*check/i,
      /robot.*verification/i,
      /automated.*traffic/i,
      /suspicious.*activity/i
    ];

    // Check for CAPTCHA elements
    for (const selector of captchaSelectors) {
      const element = await page.$(selector).catch(() => null);
      if (element) {
        logCaptchaEvent('detected_by_selector', { selector });
        return {
          detected: true,
          type: 'element_based',
          selector,
          method: 'dom_selector'
        };
      }
    }

    // Check page text for CAPTCHA patterns
    const pageText = await page.textContent('body').catch(() => '');
    for (const pattern of captchaTextPatterns) {
      if (pattern.test(pageText)) {
        logCaptchaEvent('detected_by_text', { pattern: pattern.toString() });
        return {
          detected: true,
          type: 'text_based',
          pattern: pattern.toString(),
          method: 'text_analysis'
        };
      }
    }

    // Check for common CAPTCHA iframe patterns
    const iframes = await page.$$('iframe').catch(() => []);
    for (const iframe of iframes) {
      const src = await iframe.getAttribute('src').catch(() => '');
      if (src && (src.includes('recaptcha') || src.includes('hcaptcha') || src.includes('captcha'))) {
        logCaptchaEvent('detected_by_iframe', { src });
        return {
          detected: true,
          type: 'iframe_based',
          src,
          method: 'iframe_analysis'
        };
      }
    }

    return { detected: false };
  } catch (error) {
    console.error('Error detecting CAPTCHA:', error);
    return { detected: false, error: error.message };
  }
}

/**
 * Handle CAPTCHA based on current configuration
 */
async function handleCaptcha(page, captchaInfo, sessionId, debuggerUrl, onProgress, minionId = 'main', totalCaptchas = 1, currentCaptcha = 1, departureRoute = '', returnRoute = '') {
  logCaptchaEvent('handling_captcha', { 
    type: captchaInfo.type, 
    method: captchaInfo.method,
    minionId,
    totalCaptchas,
    currentCaptcha,
    route: `${departureRoute} → ${returnRoute}`,
    mode: isHumanSolvingEnabled() ? 'human' : 'ai'
  });

  if (isHumanSolvingEnabled()) {
    // Human solving mode - emit event for frontend modal
    const message = `CAPTCHA detected for ${departureRoute} → ${returnRoute} - waiting for human to solve...`;
      
    onProgress({
      status: 'captcha_detected',
      message,
      minionId,
      sessionId,
      debuggerUrl,
      captchaType: captchaInfo.type,
      captchaCount: totalCaptchas,
      currentCaptcha: currentCaptcha,
      departureDate: departureRoute,
      returnDate: returnRoute
    });

    // Wait for human to solve CAPTCHA, then analyze with Gemini
    return await waitForHumanCaptchaSolution(page, minionId, sessionId, onProgress, 300000, currentCaptcha);
  } else {
    // AI solving mode - use Python service
    const message = `CAPTCHA detected for ${departureRoute} → ${returnRoute} - AI is solving...`;
      
    onProgress({
      status: 'captcha_solving',
      message,
      minionId,
      departureDate: departureRoute,
      returnDate: returnRoute
    });

    return await solveCaptchaWithPythonService(page, onProgress);
  }
}

/**
 * Wait for human to solve CAPTCHA, then analyze page with Gemini
 */
async function waitForHumanCaptchaSolution(page, minionId, sessionId, onProgress, maxWaitTime = 300000, currentCaptcha = 1) {
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(async () => {
      try {
        // Check if CAPTCHA has been solved via API
        const response = await axios.get(`http://localhost:${process.env.PORT || 3001}/api/captcha-status/${minionId}`);
        
        if (response.data.solved) {
          clearInterval(checkInterval);
          logCaptchaEvent('human_solved', { minionId, sessionId, duration: Date.now() - startTime });
          
          onProgress({
            status: 'captcha_solved',
            message: 'CAPTCHA solved by human - waiting for page to load...',
            minionId
          });
          
          resolve({ success: true, method: 'human' });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > maxWaitTime) {
          clearInterval(checkInterval);
          logCaptchaEvent('human_timeout', { minionId, sessionId, duration: Date.now() - startTime });
          
          onProgress({
            status: 'captcha_timeout',
            message: 'CAPTCHA solving timed out',
            minionId
          });
          
          reject(new Error('CAPTCHA solving timed out'));
          return;
        }

        // Update progress with remaining time
        const remainingTime = Math.max(0, maxWaitTime - (Date.now() - startTime));
        const remainingMinutes = Math.ceil(remainingTime / 60000);
        
        onProgress({
          status: 'captcha_waiting',
          message: `Waiting for human to solve CAPTCHA (${remainingMinutes}m remaining)...`,
          minionId
        });

      } catch (error) {
        console.error('Error checking CAPTCHA status:', error);
        // Continue waiting on API errors
      }
    }, pollInterval);
  });
}

/**
 * Get live view URL for a session using BrowserBase Live View API
 * Documentation: https://docs.browserbase.com/features/session-live-view
 */
async function getLiveViewUrl(sessionId) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  
  try {
    // Use the Live View API endpoint to get debug URLs
    const response = await axios.get(
      `https://www.browserbase.com/v1/sessions/${sessionId}/debug`,
      {
        headers: {
          'X-BB-API-Key': apiKey,
        },
      }
    );
    
    const debugData = response.data;
    console.log('Live View API response:', JSON.stringify(debugData, null, 2));
    
    // Return the debuggerFullscreenUrl for embedding
    if (debugData.debuggerFullscreenUrl) {
      console.log('✅ Found Live View URL:', debugData.debuggerFullscreenUrl);
      return debugData.debuggerFullscreenUrl;
    }
    
    // Fallback to debuggerUrl
    if (debugData.debuggerUrl) {
      console.log('Using debugger URL:', debugData.debuggerUrl);
      return debugData.debuggerUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching live view URL:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Creates a BrowserBase session and returns the connection URL
 * Now uses enhanced session with context persistence and geolocation
 */
async function createBrowserBaseSession(options = {}) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set in environment variables');
  }

  try {
    // Use enhanced session creation with retry logic and circuit breaker
    const sessionData = await createEnhancedSession({
      projectId,
      apiKey,
      userId: options.userId || null,
      countryCode: options.countryCode || 'US',
      persistContext: options.persistContext !== false, // Default true
      enableProxies: options.enableProxies !== false   // Default true
    });

    const sessionId = sessionData.id;
    const connectUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;
    
    // Use the Live View API to get the embeddable URL
    // This is the proper way according to BrowserBase documentation
    const liveViewUrl = await getLiveViewUrl(sessionId);
    
    if (!liveViewUrl) {
      console.warn('⚠️  Could not get live view URL from API');
    }
    
    return { 
      sessionId, 
      connectUrl, 
      debuggerUrl: liveViewUrl,
      liveViewUrl: liveViewUrl,
      sessionData 
    };
  } catch (error) {
    console.error('❌ Failed to create BrowserBase session:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    // Re-throw the original error for better debugging
    throw error;
  }
}

/**
 * Create a browser session using the configured provider
 * Unified function that works with both BrowserBase and HyperBrowser
 * @param {Object} options - Session configuration options
 * @returns {Promise<Object>} Session details with connectUrl, sessionId, debuggerUrl
 */
async function createBrowserSession(options = {}) {
  const provider = getBrowserProvider();
  
  console.log(`🌐 Using browser provider: ${provider.toUpperCase()}`);
  
  if (provider === 'hyperbrowser') {
    return await createHyperBrowserSession(options);
  } else {
    return await createBrowserBaseSession(options);
  }
}

/**
 * Stop a browser session using the configured provider
 * @param {string} sessionId - The session ID to stop
 */
async function stopBrowserSession(sessionId) {
  const provider = getBrowserProvider();
  
  if (provider === 'hyperbrowser') {
    await stopHyperBrowserSession(sessionId);
  } else {
    // BrowserBase sessions auto-close when browser disconnects
    console.log('✅ BrowserBase session will auto-close on disconnect');
  }
}

/**
 * Formats date from YYYY-MM-DD to MM/DD/YYYY for Expedia
 */
function formatDateForExpedia(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Run computer use agent to search for flights and extract data
 * Uses AI (OpenAI, Gemini, Claude, etc.) to navigate and extract flight information
 * @param {Object} params - Parameters
 * @param {Object} params.page - Playwright page object
 * @param {string} params.departureAirport - Departure airport code
 * @param {string} params.arrivalAirport - Arrival airport code
 * @param {string} params.departureDate - Departure date (YYYY-MM-DD)
 * @param {string} params.returnDate - Return date (YYYY-MM-DD)
 * @param {Function} params.onProgress - Progress callback
 * @param {string} params.sessionId - Browser session ID
 * @param {string} params.publicLiveUrl - Live view URL
 * @param {Object} params.website - Website configuration (optional)
 * @param {string} params.website.name - Website name (e.g., "Skyscanner")
 * @param {string} params.website.url - Website URL (e.g., "https://www.skyscanner.com")
 */
async function runFlightSearchWithComputerUse({ 
  page, 
  departureAirport, 
  arrivalAirport, 
  departureDate, 
  returnDate, 
  onProgress, 
  sessionId, 
  publicLiveUrl,
  website = { name: "Skyscanner", url: "https://www.skyscanner.com" }
}) {
  const { runComputerUse } = require('./computerUse');
  console.log(`Starting computer use agent for flight search navigation on ${website.name}...`);
  
  const navigationTask = `Task Description
----
You need to browse the ${website.name} website and search for flights. 

**IMPORTANT**
----
1. YOU NEED TO KEEP TRYING TILL YOU GET THE FLIGHT DETAILS
2. Before clicking on the search button, take a pause to ensure that all the input fields are filled correctly.
3. After typing in airport fields, wait for dropdowns to appear and select the correct option from the dropdown
4. When filling dates, click on the field, select the date from the calendar, then move to the next field
5. Ensure all fields are filled correctly before clicking search

---

You need to get the following information from the search page -
**Flight Search Details:**
- From: ${departureAirport}
- To: ${arrivalAirport}
- Departure Date: ${departureDate}
- Return Date: ${returnDate}
- Trip Type: Round trip
- Passengers: 1 adult
- Class: Economy

**Step-by-step instructions:**

1. **Navigate to Flights Section:**
   - Look for and click on the "Flights" tab or button on the homepage
   - This is usually near the top of the page

2. **Select Round Trip:**
   - Make sure "Round trip" is selected (not one-way or multi-city)

3. **Fill in Departure Airport:**
   - Click on the "Leaving from" or "From" field
   - Type: ${departureAirport}
   - Select the correct airport from the dropdown

4. **Fill in Arrival Airport:**
   - Click on the "Going to" or "To" field
   - Type: ${arrivalAirport}
   - Select the correct airport from the dropdown

5. **Select Departure Date:**
   - Click on the departure date field
   - Navigate to the correct month if needed
   - Click on the date: ${departureDate}

6. **Select Return Date:**
   - Click on the return date field
   - Navigate to the correct month if needed
   - Click on the date: ${returnDate}

7. **Set Passengers (if needed):**
   - Make sure it's set to 1 adult
   - Economy class

8. **Click Search:**
   - Click the "Search" button to search for flights

9. **Wait for Results:**
   - Wait for the search results page to load
   - The page should show flight options with prices

10. **Extract Flight Information:**
    - Once results are loaded, extract all visible flights
    - Include: airline, price, duration, route, stops

**Important:**
- Look at the page and if any of your previous actions haven't registered, you can try them again.
- Wait for dropdowns and date pickers to appear before interacting
- Make sure dates are in the correct format
- After clicking search, wait for the results page to fully load
- Extract ALL flights visible on the results page

Return the extracted flight data in the structured JSON format with this schema:
{
  "flights": [
    {
      "airline": "Airline name",
      "price": "$XXX",
      "duration": "XXh XXm",
      "stops": "nonstop" or "1 stop" or "2 stops",
      "departureTime": "HH:MM AM/PM",
      "arrivalTime": "HH:MM AM/PM",
      "route": "XXX - YYY"
    }
  ],
  "summary": "Found X flights from XXX to YYY"
}`;

  // Run computer use agent to navigate and extract pricing information
  const result = await runComputerUse({
    page,
    task: navigationTask,
    onProgress: (update) => {
      // Forward all progress updates, adding session info for CAPTCHA detection
      onProgress({
        ...update,
        sessionId,
        debuggerUrl: publicLiveUrl,
        departureDate,
        returnDate
      });
    }
  });
  
  console.log('Computer use navigation complete:', result);
  
  // Check if AI detected a CAPTCHA
  if (result.captcha_detected) {
    console.log('🤖 AI detected CAPTCHA, waiting for human to solve...');
    
    // The captcha_detected event was already sent via onProgress
    // Now we need to wait for the human to solve it
    // For now, return an error - the frontend will show the modal
    throw new Error('CAPTCHA detected - human intervention required');
  }
  
  if (result.success && result.data) {
    // AI successfully extracted flight data
    const flights = result.data.flights || [];
    
    // Ensure all flights have the 'type' field
    flights.forEach(flight => {
      flight.type = 'Round trip';
    });
    
    onProgress({
      status: 'completed',
      message: `Found ${flights.length} flights`,
      flights: flights
    });
    
    return {
      flights: flights,
      message: result.summary || result.data.summary || `Found ${flights.length} flights`,
      searchParams: {
        from: departureAirport,
        to: arrivalAirport,
        departureDate,
        returnDate
      },
      sessionId,
      debuggerUrl: publicLiveUrl
    };
  }
  
  throw new Error('Computer use agent did not return flight data');
}

/**
 * Search for flights using BrowserBase browser automation
 * @param {Object} params - Search parameters
 * @param {string} params.departureAirport - Departure airport code (e.g., 'SFO')
 * @param {string} params.arrivalAirport - Arrival airport code (e.g., 'LAX')
 * @param {string} params.departureDate - Departure date (YYYY-MM-DD)
 * @param {string} params.returnDate - Return date (YYYY-MM-DD)
 * @param {Function} [params.onProgress] - Optional callback for progress updates
 * @param {Object} [params.website] - Website configuration (optional)
 * @param {string} [params.website.name] - Website name (e.g., "Skyscanner")
 * @param {string} [params.website.url] - Website URL (e.g., "https://www.skyscanner.com")
 * @returns {Promise<Object>} Flight search results
 */
async function searchFlights({ 
  departureAirport, 
  arrivalAirport, 
  departureDate, 
  returnDate, 
  onProgress = () => {},
  website = { name: "Skyscanner", url: "https://www.skyscanner.com" }
}) {
  let browser = null;
  
  try {
    // Create browser session (BrowserBase or HyperBrowser)
    onProgress({ status: 'creating_session', message: 'Creating browser session...', minionId: 1 });
    console.log('Creating browser session...');
    
    const { sessionId, connectUrl, debuggerUrl, liveViewUrl } = await createBrowserSession();
    console.log('Browser session created:', sessionId);
    console.log('Live session view:', debuggerUrl);
    
    // Try to get live view URL if not already available
    let publicLiveUrl = liveViewUrl || debuggerUrl;
    if (!publicLiveUrl || publicLiveUrl.includes('/sessions/')) {
      const fetchedLiveUrl = await getLiveViewUrl(sessionId);
      if (fetchedLiveUrl) {
        publicLiveUrl = fetchedLiveUrl;
        console.log('Fetched public live URL:', publicLiveUrl);
      }
    }
    
    // Send session info immediately
    onProgress({ 
      status: 'session_created', 
      message: 'Browser session created',
      minionId: 1,
      sessionId,
      debuggerUrl: publicLiveUrl,
      departureDate,
      returnDate
    });

    // Connect to browser using Playwright
    onProgress({ status: 'connecting', message: 'Connecting to browser...', minionId: 1 });
    browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    // Prevent new tabs from opening - redirect to current tab instead
    console.log('Setting up new tab prevention...');
    
    // 1️⃣ Intercept new pages (tabs) - only redirect if same domain, ignore cross-domain popups
    context.on('page', async (newPage) => {
      try {
        // Wait for the new page to finish its initial navigation
        await newPage.waitForLoadState('domcontentloaded').catch(() => {});

        const targetUrl = newPage.url();
        const currentUrl = page.url();
        
        // Extract domains for comparison
        const getCurrentDomain = (url) => {
          try {
            return new URL(url).hostname;
          } catch {
            return '';
          }
        };
        
        const targetDomain = getCurrentDomain(targetUrl);
        const currentDomain = getCurrentDomain(currentUrl);
        
        // Only redirect if same domain (likely legitimate navigation)
        if (targetDomain === currentDomain) {
          console.log(`🔄 Same-domain new tab detected (${targetDomain}), redirecting current tab to:`, targetUrl);
          
          // Navigate the *original page* to that URL
          await page.goto(targetUrl).catch(err => {
            console.error('Error redirecting to new tab URL:', err.message);
          });
        } else {
          // Different domain - likely popup ad, silently ignore
          console.log(`🚫 Cross-domain popup blocked: ${targetDomain} (current: ${currentDomain})`);
        }

        // Always close the unwanted new tab
        await newPage.close().catch(err => {
          console.error('Error closing new tab:', err.message);
        });
      } catch (error) {
        console.error('Error handling new page:', error.message);
      }
    });

    // 2️⃣ Override window.open to prevent new tabs at the JavaScript level
    await context.addInitScript(() => {
      const origOpen = window.open;
      window.open = function (url, name, specs) {
        if (url) {
          // Check if same domain
          const getCurrentDomain = (urlString) => {
            try {
              return new URL(urlString, window.location.href).hostname;
            } catch {
              return '';
            }
          };
          
          const targetDomain = getCurrentDomain(url);
          const currentDomain = window.location.hostname;
          
          if (targetDomain === currentDomain) {
            console.warn('🔄 window.open intercepted (same domain), navigating current tab to:', url);
            window.location.href = url;
          } else {
            console.warn('🚫 window.open blocked (cross-domain):', url);
          }
        }
        return null;
      };
    });
    
    console.log('✅ New tab prevention configured');
    
    // Store search parameters on page object for use in CAPTCHA handler
    page._searchParams = {
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate
    };

    onProgress({ status: 'connected', message: 'Connected to browser, preparing search...', minionId: 1 });

    // Setup request interception for faster page loads
    await setupRequestInterception(page, {
      blockAds: true,
      blockAnalytics: false,
      blockImages: false,
      logRequests: false
    });

    // Navigate to flight search website
    const websiteUrl = website.url;

    console.log(`Navigating to ${website.name} homepage:`, websiteUrl);
    onProgress({ status: 'navigating', message: `Navigating to ${website.name} homepage...`, minionId: 1 });

    // Navigate to website homepage with timeout and fallback
    try {
      await page.goto(websiteUrl, { 
        waitUntil: 'networkidle',
        timeout: 8000  // 8 seconds
      });
      console.log('✅ Page navigation successful');
      
      // Wait a bit for page to stabilize
      // await page.waitForTimeout(3000);
    } catch (navError) {
      console.log('⚠️  Navigation warning:', navError.message);
      
      // If navigation fails, try to continue anyway - the page might have partially loaded
      if (navError.message.includes('Timeout') || navError.message.includes('ERR_TUNNEL')) {
        console.log('Attempting to continue despite navigation error...');
        await page.waitForTimeout(3000);  // Give it more time
        
        // Check if page has any content
        const hasContent = await page.evaluate(() => document.body && document.body.children.length > 0);
        if (!hasContent) {
          throw new Error('Page failed to load - no content detected');
        }
        console.log('✅ Page has content, continuing...');
      } else {
        throw navError;  // Re-throw if it's a different error
      }
    }

    // Start AI agent - it will detect CAPTCHAs automatically
    console.log('✅ Page loaded, starting AI agent...');
    
    onProgress({
      status: 'navigating_with_ai',
      message: 'AI agent is navigating through the website...',
      minionId: 1
    });
    
    try {
      return await runFlightSearchWithComputerUse({
        page,
        departureAirport,
        arrivalAirport,
        departureDate,
        returnDate,
        onProgress,
        sessionId,
        publicLiveUrl,
        website
      });
    } catch (error) {
      console.error('Error during AI navigation:', error);
      onProgress({
        status: 'error',
        message: 'AI navigation failed'
      });
      
      await browser.close();
      await stopBrowserSession(sessionId);
      
      throw error;
    }
    
    // If we reach here, something went wrong - both CAPTCHA and no-CAPTCHA paths should return
    console.error('❌ Unexpected: reached end of function without returning');
    await browser.close();
    await stopBrowserSession(sessionId);
    
    throw new Error('Flight search failed: no data extracted');

  } catch (error) {
    console.error('Error searching flights:', error);
    if (browser) {
      await browser.close().catch(err => console.error('Error closing browser:', err));
    }

    // Provide helpful error messages
    if (error.message.includes('BROWSERBASE_API_KEY')) {
      throw new Error('BrowserBase API credentials not configured. Please check your .env file.');
    }
    
    throw new Error(`Flight search failed: ${error.message}`);
  }
}

// searchFlightsWithProgress has been merged into searchFlights
// searchFlights now accepts an optional onProgress parameter
// For backwards compatibility, create an alias:
const searchFlightsWithProgress = searchFlights;

module.exports = {
  searchFlights,
  searchFlightsWithProgress,
  createBrowserBaseSession,
  getLiveViewUrl
};
