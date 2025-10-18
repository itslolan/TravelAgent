const express = require('express');
const router = express.Router();
const { searchFlightsWithProgress } = require('../services/browserbaseService');
const { runFlexibleSearch } = require('../services/flexibleSearchService');

router.post('/search-flights', async (req, res) => {
  try {
    const { searchMode } = req.body;

    // Set up SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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

module.exports = router;
