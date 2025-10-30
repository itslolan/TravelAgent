/**
 * BrightData Scraping Browser Service
 * Uses BrightData's remote browser via WebSocket connection
 * Docs: https://docs.brightdata.com/scraping-automation/scraping-browser/
 */

/**
 * Create a BrightData Scraping Browser session
 * @param {Object} options - Session configuration options (not used for BrightData)
 * @returns {Promise<Object>} Session details including connectUrl and debuggerUrl
 */
async function createBrightDataBrowserSession(options = {}) {
  const customerID = process.env.BRIGHTDATA_BROWSER_CUSTOMER;
  const zone = process.env.BRIGHTDATA_BROWSER_ZONE;
  const password = process.env.BRIGHTDATA_BROWSER_PASSWORD;

  if (!customerID || !zone || !password) {
    throw new Error('BrightData browser credentials not set. Required: BRIGHTDATA_BROWSER_CUSTOMER, BRIGHTDATA_BROWSER_ZONE, BRIGHTDATA_BROWSER_PASSWORD');
  }

  console.log('🌐 Creating BrightData Scraping Browser session...');

  // Build WebSocket URL
  // Format: wss://brd-customer-{CUSTOMER_ID}-zone-{ZONE_NAME}:{ZONE_PASSWORD}@brd.superproxy.io:9222
  const wsUrl = `wss://brd-customer-${customerID}-zone-${zone}:${password}@brd.superproxy.io:9222`;

  console.log('✅ BrightData browser configured');
  console.log(`   Customer: ${customerID}`);
  console.log(`   Zone: ${zone}`);
  console.log('   Endpoint: brd.superproxy.io:9222');

  // BrightData doesn't have traditional session IDs - the connection itself is the session
  const sessionId = `brightdata-${Date.now()}`;

  return {
    sessionId,
    connectUrl: wsUrl,
    debuggerUrl: null, // BrightData doesn't provide a live view URL
    liveViewUrl: null,
    sessionData: {
      provider: 'brightdata',
      customerID,
      zone
    }
  };
}

/**
 * Stop a BrightData browser session
 * @param {string} sessionId - The session ID (not used for BrightData)
 */
async function stopBrightDataBrowserSession(sessionId) {
  // BrightData sessions end when the browser connection closes
  // No explicit API call needed
  console.log('✅ BrightData browser session will close on disconnect');
}

/**
 * Get BrightData session details
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Session details
 */
async function getBrightDataBrowserSession(sessionId) {
  // BrightData doesn't have a session details API
  // Return basic info
  return {
    id: sessionId,
    provider: 'brightdata',
    status: 'active'
  };
}

module.exports = {
  createBrightDataBrowserSession,
  stopBrightDataBrowserSession,
  getBrightDataBrowserSession
};
