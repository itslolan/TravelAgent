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
      const { departureAirport, arrivalAirport, month, year, tripDuration } = req.body;

      // Validate input
      if (!departureAirport || !arrivalAirport || month === undefined || !year || !tripDuration) {
        return res.status(400).json({ 
          error: 'Missing required fields for flexible search' 
        });
      }

      console.log('Flexible search:', { departureAirport, arrivalAirport, month, year, tripDuration });

      const results = await runFlexibleSearch({
        departureAirport,
        arrivalAirport,
        month,
        year,
        tripDuration,
        onProgress: sendUpdate
      });

      // Send final results
      sendUpdate({
        status: 'completed',
        searchMode: 'flexible',
        ...results
      });

    } else {
      // Fixed date search (original behavior)
      const { departureAirport, arrivalAirport, departureDate, returnDate } = req.body;

      // Validate input
      if (!departureAirport || !arrivalAirport || !departureDate || !returnDate) {
        return res.status(400).json({ 
          error: 'Missing required fields: departureAirport, arrivalAirport, departureDate, returnDate' 
        });
      }

      console.log('Fixed date search:', { departureAirport, arrivalAirport, departureDate, returnDate });

      // Call BrowserBase service to search flights with progress updates
      await searchFlightsWithProgress({
        departureAirport,
        arrivalAirport,
        departureDate,
        returnDate,
        onProgress: sendUpdate
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

    // Set up SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log('✅ SSE headers set for test mode');

    // Callback to send progress updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
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
