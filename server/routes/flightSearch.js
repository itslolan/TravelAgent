const express = require('express');
const router = express.Router();
const { searchFlightsWithProgress } = require('../services/browserbaseService');
const { runFlexibleSearch } = require('../services/flexibleSearchService');

router.post('/search-flights', async (req, res) => {
  try {
    console.log('📨 Received search request:', req.body);
    const { searchMode } = req.body;

    // Set up SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log('✅ SSE headers set, mode:', searchMode);

    // Callback to send progress updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (searchMode === 'flexible') {
      // Flexible date search
      const { departureAirport, arrivalAirport, month, year, tripDuration, proxyProvider } = req.body;

      // Validate input
      if (!departureAirport || !arrivalAirport || month === undefined || !year || !tripDuration) {
        return res.status(400).json({
          error: 'Missing required fields for flexible search'
        });
      }

      console.log('Flexible search:', { departureAirport, arrivalAirport, month, year, tripDuration });
      console.log('🔌 Proxy provider:', proxyProvider);

      const results = await runFlexibleSearch({
        departureAirport,
        arrivalAirport,
        month,
        year,
        tripDuration,
        proxyProvider,
        onProgress: sendUpdate
      });

      // Send final results
      sendUpdate({
        status: 'completed',
        searchMode: 'flexible',
        ...results
      });

    } else {
      // Fixed date search - search 3 websites in parallel
      const { departureAirport, arrivalAirport, departureDate, returnDate, proxyProvider } = req.body;

      // Validate input
      if (!departureAirport || !arrivalAirport || !departureDate || !returnDate) {
        return res.status(400).json({
          error: 'Missing required fields: departureAirport, arrivalAirport, departureDate, returnDate'
        });
      }

      console.log('Fixed date search - launching 2 minions:', { departureAirport, arrivalAirport, departureDate, returnDate });
      console.log('🔌 Proxy provider:', proxyProvider);

      // Define 2 websites to search in parallel
      const websites = [
        { name: 'Skyscanner', url: 'https://www.skyscanner.com', minionId: 1 },
        { name: 'Google Flights', url: 'https://www.google.com/travel/flights', minionId: 2 }
      ];

      // Launch all searches in parallel
      const searchPromises = websites.map(website =>
        searchFlightsWithProgress({
          departureAirport,
          arrivalAirport,
          departureDate,
          returnDate,
          proxyProvider,
          website: { name: website.name, url: website.url },
          onProgress: (update) => {
            // Add minionId to all progress updates
            sendUpdate({
              ...update,
              minionId: website.minionId,
              websiteName: website.name
            });
          }
        }).catch(error => {
          console.error(`Error searching ${website.name}:`, error);
          sendUpdate({
            status: 'error',
            message: `${website.name} search failed: ${error.message}`,
            minionId: website.minionId,
            websiteName: website.name,
            error: error.message
          });
          return { success: false, website: website.name, error: error.message };
        })
      );

      // Wait for all searches to complete
      const results = await Promise.allSettled(searchPromises);

      // Collect successful results
      const allFlights = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.flights) {
          allFlights.push(...result.value.flights.map(flight => ({
            ...flight,
            source: websites[index].name
          })));
        }
      });

      // Send final combined results
      sendUpdate({
        status: 'completed',
        message: `Search complete! Found ${allFlights.length} total flights across all websites`,
        flights: allFlights,
        searchMode: 'fixed'
      });
    }

    res.end();
  } catch (error) {
    console.error('Flight search error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to search flights' })}\n\n`);
    res.end();
  }
});

router.post('/test-captcha', async (req, res) => {
  try {
    console.log('🧪 Received CAPTCHA test request');
    const { proxyProvider } = req.body;
    console.log('🔌 Proxy provider:', proxyProvider);

    // Set up SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log('✅ SSE headers set for test mode');

    // Callback to send progress updates
    const sendUpdate = (data) => {
      try {
        const jsonStr = JSON.stringify(data);
        const sizeKB = Math.round(jsonStr.length / 1024);
        if (data.action && data.action.screenshot) {
          console.log(`📡 SSE sending ${data.action.type} with screenshot (total: ${sizeKB}KB)`);
        }
        res.write(`data: ${jsonStr}\n\n`);
      } catch (error) {
        console.error('❌ Error sending SSE update:', error.message);
        console.error('   Data keys:', Object.keys(data));
      }
    };

    // Generate random search parameters for testing
    const airports = ['SFO', 'LAX', 'JFK', 'ORD', 'DEN', 'ATL', 'SEA', 'MIA'];
    const randomDepartureAirport = airports[Math.floor(Math.random() * airports.length)];
    let randomArrivalAirport = airports[Math.floor(Math.random() * airports.length)];

    // Ensure arrival is different from departure
    while (randomArrivalAirport === randomDepartureAirport) {
      randomArrivalAirport = airports[Math.floor(Math.random() * airports.length)];
    }

    // Random dates within next 30-60 days
    const daysOffset = 30 + Math.floor(Math.random() * 30);
    const departureDate = new Date();
    departureDate.setDate(departureDate.getDate() + daysOffset);

    const returnDate = new Date(departureDate);
    returnDate.setDate(returnDate.getDate() + 7); // 7 day trip

    const testParams = {
      departureAirport: randomDepartureAirport,
      arrivalAirport: randomArrivalAirport,
      departureDate: departureDate.toISOString().split('T')[0],
      returnDate: returnDate.toISOString().split('T')[0]
    };

    console.log('🎲 Random test parameters:', testParams);

    sendUpdate({
      status: 'test_started',
      message: `Testing CAPTCHA solver with random search: ${testParams.departureAirport} → ${testParams.arrivalAirport}`,
      minionId: 1,
      departureDate: testParams.departureDate,
      returnDate: testParams.returnDate
    });

    // Call BrowserBase service with progress updates
    await searchFlightsWithProgress({
      ...testParams,
      proxyProvider,
      onProgress: (update) => {
        // Add test mode flag and forward all updates
        sendUpdate({
          ...update,
          testMode: true,
          minionId: 1,
          departureDate: testParams.departureDate,
          returnDate: testParams.returnDate
        });
      }
    });

    sendUpdate({
      status: 'completed',
      message: 'CAPTCHA test completed',
      testMode: true
    });

    res.end();
  } catch (error) {
    console.error('CAPTCHA test error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to test CAPTCHA solver' })}\n\n`);
    res.end();
  }
});

module.exports = router;
