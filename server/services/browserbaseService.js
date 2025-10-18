const { chromium } = require('playwright');
const axios = require('axios');
const { runGeminiAgentLoop } = require('./geminiComputerUse');

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
 */
async function createBrowserBaseSession() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set in environment variables');
  }

  try {
    const response = await axios.post(
      'https://www.browserbase.com/v1/sessions',
      {
        projectId: projectId,
        proxies: true, // Enable BrowserBase managed residential proxies
        browserSettings: {
          viewport: {
            width: 1280,
            height: 720
          }
        }
      },
      {
        headers: {
          'X-BB-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const sessionData = response.data;
    const sessionId = sessionData.id;
    const connectUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;
    
    // Log the session creation response
    console.log('BrowserBase session created:', sessionId);
    
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
    console.error('Error creating BrowserBase session:', error.response?.data || error.message);
    throw new Error('Failed to create BrowserBase session');
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
 * Search flights on Expedia using BrowserBase
 */
async function searchFlights({ departureAirport, arrivalAirport, departureDate, returnDate }) {
  let browser = null;
  
  try {
    // Create BrowserBase session
    console.log('Creating BrowserBase session...');
    const { sessionId, connectUrl, debuggerUrl } = await createBrowserBaseSession();
    console.log('BrowserBase session created:', sessionId);
    console.log('Live session view:', debuggerUrl);

    // Connect to BrowserBase using Playwright
    browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();

    // Format dates for Expedia
    const formattedDepartureDate = formatDateForExpedia(departureDate);
    const formattedReturnDate = formatDateForExpedia(returnDate);

    // Build Expedia URL
    const expediaUrl = `https://www.expedia.com/Flights-Search?` +
      `flight-type=on&` +
      `mode=search&` +
      `trip=roundtrip&` +
      `leg1=from:${departureAirport},to:${arrivalAirport},departure:${formattedDepartureDate}TANYT&` +
      `leg2=from:${arrivalAirport},to:${departureAirport},departure:${formattedReturnDate}TANYT&` +
      `passengers=adults:1,children:0,infantinlap:N&` +
      `options=cabinclass:economy`;

    console.log('Navigating to Expedia:', expediaUrl);

    // Navigate to Expedia search results
    await page.goto(expediaUrl, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    console.log('Page loaded, waiting for results...');

    // Wait for flight results to load
    await page.waitForSelector('[data-test-id="listing-main"]', { timeout: 30000 }).catch(() => {
      console.log('Main listing container not found, trying alternative selectors...');
    });

    // Extract flight information
    console.log('Extracting flight data...');
    const flights = await page.evaluate(() => {
      const flightCards = [];
      
      // Try multiple selectors to find flight listings
      const listingContainers = document.querySelectorAll('[data-test-id="listing-main"], .uitk-card, [data-test-id="offer-listing"]');
      
      listingContainers.forEach((card, index) => {
        if (index >= 5) return; // Limit to top 5 results
        
        try {
          // Extract price
          const priceElement = card.querySelector('[data-test-id="listing-price-dollars"], .uitk-text-emphasis-theme, [data-test-id="price-total-amount"]');
          const price = priceElement ? priceElement.textContent.trim() : 'Price not available';
          
          // Extract airline
          const airlineElement = card.querySelector('[data-test-id="airline-name"], .uitk-text-default-theme');
          const airline = airlineElement ? airlineElement.textContent.trim() : 'Unknown airline';
          
          // Extract duration
          const durationElement = card.querySelector('[data-test-id="duration"], .duration-text');
          const duration = durationElement ? durationElement.textContent.trim() : 'Duration not available';
          
          // Extract route info
          const routeElement = card.querySelector('[data-test-id="flight-info"]');
          const route = routeElement ? routeElement.textContent.trim() : '';
          
          flightCards.push({
            airline,
            price,
            duration,
            route: route || `${airline} flight`,
            type: 'Round trip'
          });
        } catch (err) {
          console.error('Error parsing flight card:', err);
        }
      });
      
      return flightCards;
    });

    console.log(`Found ${flights.length} flights`);

    // Take screenshot for debugging (optional)
    await page.screenshot({ 
      path: '/tmp/expedia-results.png',
      fullPage: false 
    }).catch(err => console.log('Screenshot failed:', err));

    await browser.close();

    return {
      flights: flights.length > 0 ? flights : [],
      message: flights.length > 0 
        ? `Found ${flights.length} flight options` 
        : 'No flights found. The page structure may have changed or no results are available.',
      searchParams: {
        from: departureAirport,
        to: arrivalAirport,
        departureDate: formattedDepartureDate,
        returnDate: formattedReturnDate
      },
      sessionId,
      debuggerUrl
    };

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

/**
 * Search flights with progress updates via callback
 */
async function searchFlightsWithProgress({ departureAirport, arrivalAirport, departureDate, returnDate, onProgress }) {
  let browser = null;
  
  try {
    // Create BrowserBase session
    onProgress({ status: 'creating_session', message: 'Creating BrowserBase session...' });
    console.log('Creating BrowserBase session...');
    
    const { sessionId, connectUrl, debuggerUrl, liveViewUrl } = await createBrowserBaseSession();
    console.log('BrowserBase session created:', sessionId);
    console.log('Live session view:', debuggerUrl);
    
    // Try to get live view URL if not already available
    let publicLiveUrl = liveViewUrl || debuggerUrl;
    if (!publicLiveUrl || publicLiveUrl.includes('/sessions/')) {
      // Try fetching session details to get public live URL
      const fetchedLiveUrl = await getLiveViewUrl(sessionId);
      if (fetchedLiveUrl) {
        publicLiveUrl = fetchedLiveUrl;
        console.log('Fetched public live URL:', publicLiveUrl);
      }
    }
    
    // Send session info immediately
    onProgress({ 
      status: 'session_created', 
      message: 'Session created, connecting to browser...',
      sessionId,
      debuggerUrl: publicLiveUrl 
    });

    // Connect to BrowserBase using Playwright
    browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();

    onProgress({ status: 'connected', message: 'Connected to browser, preparing search...' });

    // Format dates for Expedia
    const formattedDepartureDate = formatDateForExpedia(departureDate);
    const formattedReturnDate = formatDateForExpedia(returnDate);

    // Build Expedia URL
    const expediaUrl = `https://www.expedia.com/Flights-Search?` +
      `flight-type=on&` +
      `mode=search&` +
      `trip=roundtrip&` +
      `leg1=from:${departureAirport},to:${arrivalAirport},departure:${formattedDepartureDate}TANYT&` +
      `leg2=from:${arrivalAirport},to:${departureAirport},departure:${formattedReturnDate}TANYT&` +
      `passengers=adults:1,children:0,infantinlap:N&` +
      `options=cabinclass:economy`;

    console.log('Navigating to Expedia:', expediaUrl);
    onProgress({ status: 'navigating', message: 'Navigating to Expedia.com...' });

    // Navigate to Expedia search results
    await page.goto(expediaUrl, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    console.log('Page loaded, waiting for flight results to appear...');
    onProgress({ status: 'loading', message: 'Waiting for flight results to load...' });

    // Wait for flight results to fully load
    // Try multiple selectors that Expedia uses for flight listings
    try {
      await Promise.race([
        page.waitForSelector('[data-test-id="listing-main"]', { timeout: 30000 }),
        page.waitForSelector('.uitk-card-content-section', { timeout: 30000 }),
        page.waitForSelector('[data-test-id="offer-listing"]', { timeout: 30000 }),
        page.waitForSelector('.flight-card', { timeout: 30000 })
      ]);
      console.log('✅ Flight results container detected');
    } catch (err) {
      console.log('⚠️ Could not detect flight results container, proceeding anyway...');
    }

    // Additional wait to ensure dynamic content is loaded
    console.log('Waiting for dynamic content to stabilize...');
    await page.waitForTimeout(3000);

    // Wait for any loading spinners to disappear
    try {
      await page.waitForSelector('.loading-spinner, [data-test-id="loading"]', { 
        state: 'hidden', 
        timeout: 10000 
      });
      console.log('✅ Loading indicators cleared');
    } catch (err) {
      console.log('No loading indicators found or already cleared');
    }

    // Verify that flight data is actually visible on the page
    const hasFlightData = await page.evaluate(() => {
      // Check if there are any price elements visible
      const priceElements = document.querySelectorAll('[data-test-id*="price"], .price, [class*="price"]');
      const hasVisiblePrices = Array.from(priceElements).some(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      
      // Check if there are flight cards
      const flightCards = document.querySelectorAll('[data-test-id*="listing"], .flight-card, .uitk-card');
      const hasCards = flightCards.length > 0;
      
      return hasVisiblePrices || hasCards;
    });

    if (hasFlightData) {
      console.log('✅ Flight data verified on page');
    } else {
      console.log('⚠️ Warning: Could not verify flight data on page, but proceeding...');
    }

    console.log('✅ Page fully loaded, starting Gemini Computer Use agent...');
    onProgress({ status: 'loading', message: 'Page fully loaded, starting AI agent to analyze flight data...' });

    // Use Gemini Computer Use to interact with the page
    const geminiTask = `You are looking at an Expedia flight search results page. 
The screenshot shows the FULL PAGE, so you can see all content without scrolling.

Your task is to:
1. Analyze the full page screenshot to identify all visible flight options
2. Find the 5 cheapest flight options
3. For each flight, extract:
   - airline: The airline name (e.g., "Air Canada", "Air India")
   - price: The total price (e.g., "$1,177", "$1,331")
   - duration: Total travel time (e.g., "20h 10m", "23h 35m")
   - route: Full route description including stops (e.g., "Vancouver (YVR) - Delhi (DEL), 1 stop in LHR")
   - stops: Number of stops (e.g., "1 stop", "nonstop", "2 stops")

Return the data in JSON format with a "flights" array containing these flight objects, and a "summary" field with a brief description.

Note: You can see the entire page in the screenshot, so scrolling is not necessary unless you need to interact with specific elements.`;

    const geminiResult = await runGeminiAgentLoop({
      page,
      task: geminiTask,
      onProgress
    });

    // Use Gemini's structured JSON data
    console.log('Gemini agent complete, processing flight data...');
    onProgress({ status: 'extracting', message: 'Processing flight data from AI...' });
    
    const flights = geminiResult.flightData?.flights || [];
    
    // Ensure all flights have the 'type' field
    flights.forEach(flight => {
      flight.type = 'Round trip';
    });

    console.log(`Received ${flights.length} flights from Gemini`);

    // Take screenshot for debugging (optional)
    await page.screenshot({ 
      path: '/tmp/expedia-results.png',
      fullPage: false 
    }).catch(err => console.log('Screenshot failed:', err));

    await browser.close();

    // Send final results
    onProgress({
      status: 'completed',
      flights: flights.length > 0 ? flights : [],
      message: flights.length > 0 
        ? `Found ${flights.length} flight options` 
        : 'No flights found. The page structure may have changed or no results are available.',
      searchParams: {
        from: departureAirport,
        to: arrivalAirport,
        departureDate: formattedDepartureDate,
        returnDate: formattedReturnDate
      },
      sessionId,
      debuggerUrl: publicLiveUrl
    });

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

module.exports = {
  searchFlights,
  searchFlightsWithProgress,
  createBrowserBaseSession,
  getLiveViewUrl
};
