const { searchFlightsWithProgress } = require('./browserbaseService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Timeout configuration
const MINION_TIMEOUT_MS = 60000; // 1 minute timeout
const MAX_RETRIES = 1; // 1 retry per failed minion

/**
 * Run a search with timeout protection
 */
async function searchWithTimeout(searchParams, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Minion timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    searchFlightsWithProgress(searchParams)
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/**
 * Run a search with retry logic
 */
async function searchWithRetry({ 
  departureAirport, 
  arrivalAirport, 
  departureDate, 
  returnDate,
  minionId,
  onProgress,
  maxRetries = MAX_RETRIES
}) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const isRetry = attempt > 0;
      
      if (isRetry) {
        console.log(`[Minion ${minionId}] Retry attempt ${attempt}/${maxRetries}`);
        onProgress({
          status: 'retrying',
          message: `Retrying search (attempt ${attempt + 1}/${maxRetries + 1})...`,
          minionId,
          departureDate,
          returnDate,
          attempt
        });
      }

      const result = await searchWithTimeout({
        departureAirport,
        arrivalAirport,
        departureDate,
        returnDate,
        onProgress
      }, MINION_TIMEOUT_MS);

      return result; // Success!
      
    } catch (error) {
      lastError = error;
      console.error(`[Minion ${minionId}] Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Will retry
        continue;
      } else {
        // Final failure
        onProgress({
          status: 'minion_failed',
          message: `Search failed after ${maxRetries + 1} attempts`,
          minionId,
          departureDate,
          returnDate,
          error: error.message
        });
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate all date combinations for a flexible search
 */
function generateDateCombinations(month, year, tripDuration) {
  const combinations = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxStartDay = daysInMonth - tripDuration + 1;

  for (let startDay = 1; startDay <= maxStartDay; startDay++) {
    const departureDate = new Date(year, month, startDay);
    const returnDate = new Date(year, month, startDay + tripDuration);
    
    combinations.push({
      departureDate: departureDate.toISOString().split('T')[0],
      returnDate: returnDate.toISOString().split('T')[0],
      startDay
    });
  }

  return combinations;
}

/**
 * Search flights for a single date combination (a "minion")
 */
async function searchSingleCombination({ 
  departureAirport, 
  arrivalAirport, 
  departureDate, 
  returnDate,
  minionId,
  onProgress 
}) {
  console.log(`[Minion ${minionId}] Starting search for ${departureDate} - ${returnDate}`);
  
  const results = {
    minionId,
    departureDate,
    returnDate,
    flights: [],
    error: null
  };

  try {
    // Use the existing flight search logic
    await searchFlightsWithProgress({
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate,
      onProgress: (update) => {
        // Forward progress updates with minion ID
        onProgress({
          ...update,
          minionId,
          departureDate,
          returnDate
        });
      }
    });

    // Note: We need to capture the results from the progress callback
    // For now, we'll return a placeholder
    console.log(`[Minion ${minionId}] Search completed`);
    
  } catch (error) {
    console.error(`[Minion ${minionId}] Error:`, error.message);
    results.error = error.message;
  }

  return results;
}

/**
 * Run flexible date search with parallel minions
 */
async function runFlexibleSearch({
  departureAirport,
  arrivalAirport,
  month,
  year,
  tripDuration,
  onProgress
}) {
  console.log(`\n=== Starting Flexible Search ===`);
  console.log(`Month: ${month + 1}/${year}, Duration: ${tripDuration} days`);
  console.log(`Route: ${departureAirport} → ${arrivalAirport}`);

  // Generate all date combinations
  const combinations = generateDateCombinations(month, year, tripDuration);
  console.log(`Generated ${combinations.length} date combinations`);

  onProgress({
    status: 'combinations_generated',
    message: `Searching ${combinations.length} date combinations...`,
    totalCombinations: combinations.length
  });

  // Store all results from minions
  const allResults = [];
  let completedMinions = 0;
  let processedMinions = 0; // Includes both successful and failed

  // Create a modified progress handler that captures flight data
  const minionProgressHandlers = combinations.map((combo, index) => {
    let minionFlights = [];
    
    return {
      combo,
      minionId: index + 1,
      handler: async (update) => {
        // Capture completed flight data
        if (update.status === 'completed' && update.flights) {
          minionFlights = update.flights;
          
          allResults.push({
            minionId: index + 1,
            departureDate: combo.departureDate,
            returnDate: combo.returnDate,
            flights: update.flights,
            cheapestPrice: update.flights.length > 0 
              ? update.flights[0].price 
              : null
          });

          completedMinions++;
          processedMinions++;
          
          onProgress({
            status: 'minion_completed',
            message: `Completed ${completedMinions}/${combinations.length} searches`,
            minionId: index + 1,
            departureDate: combo.departureDate,
            returnDate: combo.returnDate,
            completedMinions,
            totalCombinations: combinations.length
          });

          // PROGRESSIVE ANALYSIS: Analyze results so far after each minion completes
          console.log(`\n--- Analyzing results from ${completedMinions} completed minions ---`);
          
          onProgress({
            status: 'analyzing',
            message: `Analyzing results from ${completedMinions}/${combinations.length} searches...`,
            completedMinions,
            totalCombinations: combinations.length
          });

          const progressiveAnalysis = await analyzeFlexibleResults(allResults, {
            departureAirport,
            arrivalAirport,
            month,
            year,
            tripDuration
          });

          // Send progressive results to UI
          onProgress({
            status: 'progressive_results',
            message: `Updated with results from ${completedMinions}/${combinations.length} searches`,
            searchMode: 'flexible',
            totalCombinations: combinations.length,
            resultsCollected: allResults.length,
            completedMinions,
            allResults: [...allResults], // Send copy of current results
            analysis: progressiveAnalysis,
            isComplete: completedMinions === combinations.length
          });

        } else {
          // Forward other progress updates
          onProgress({
            ...update,
            minionId: index + 1,
            departureDate: combo.departureDate,
            returnDate: combo.returnDate
          });
        }
      }
    };
  });

  // Track failed minions for retry
  const failedMinions = [];
  let totalAttempts = 0;

  // Run all searches in parallel (with concurrency limit)
  const CONCURRENCY_LIMIT = 3; // Run 3 minions at a time to avoid overwhelming BrowserBase
  
  for (let i = 0; i < combinations.length; i += CONCURRENCY_LIMIT) {
    const batch = minionProgressHandlers.slice(i, i + CONCURRENCY_LIMIT);
    
    console.log(`\n--- Running batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} (Minions ${i + 1}-${Math.min(i + CONCURRENCY_LIMIT, combinations.length)}) ---`);
    
    const results = await Promise.allSettled(
      batch.map(({ combo, minionId, handler }) =>
        searchWithRetry({
          departureAirport,
          arrivalAirport,
          departureDate: combo.departureDate,
          returnDate: combo.returnDate,
          minionId,
          onProgress: handler
        })
      )
    );

    // Track failures and send final update for failed minions
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const { minionId, combo, handler } = batch[index];
      totalAttempts++;
      
      if (result.status === 'rejected') {
        console.error(`[Minion ${minionId}] FINAL FAILURE after retries:`, result.reason.message);
        failedMinions.push({
          minionId,
          combo,
          error: result.reason.message
        });
        
        // Increment processedMinions to unblock the UI
        processedMinions++;
        
        // Send failure notification
        onProgress({
          status: 'minion_failed_final',
          message: `Minion ${minionId} failed after retries`,
          minionId,
          departureDate: combo.departureDate,
          returnDate: combo.returnDate,
          error: result.reason.message
        });

        // If this was the last minion, send final results
        if (processedMinions === combinations.length && allResults.length > 0) {
          console.log('All minions processed (some failed), sending final results...');
          
          const finalAnalysis = await analyzeFlexibleResults(allResults, {
            departureAirport,
            arrivalAirport,
            month,
            year,
            tripDuration
          });

          onProgress({
            status: 'progressive_results',
            message: `Final results (${allResults.length}/${combinations.length} successful)`,
            searchMode: 'flexible',
            totalCombinations: combinations.length,
            resultsCollected: allResults.length,
            completedMinions: allResults.length,
            failedMinions: failedMinions.length,
            allResults: [...allResults],
            analysis: finalAnalysis,
            isComplete: true
          });
        }
      }
    }
  }

  // Log summary
  console.log(`\n=== All Minions Completed ===`);
  console.log(`Total combinations: ${combinations.length}`);
  console.log(`Successful: ${allResults.length}`);
  console.log(`Failed: ${failedMinions.length}`);
  
  if (failedMinions.length > 0) {
    console.log('\nFailed minions:');
    failedMinions.forEach(f => {
      console.log(`  - Minion ${f.minionId} (${f.combo.departureDate} - ${f.combo.returnDate}): ${f.error}`);
    });
  }

  // IMPORTANT: Send final update to ensure UI knows we're complete
  // This handles edge cases where the last minion's progressive update might not have been received
  if (allResults.length > 0) {
    console.log('\n--- Sending final completion update to UI ---');
    
    const finalAnalysis = await analyzeFlexibleResults(allResults, {
      departureAirport,
      arrivalAirport,
      month,
      year,
      tripDuration
    });

    onProgress({
      status: 'progressive_results',
      message: `Search complete! Analyzed ${allResults.length} date combinations`,
      searchMode: 'flexible',
      totalCombinations: combinations.length,
      resultsCollected: allResults.length,
      completedMinions: allResults.length,
      failedMinions: failedMinions.length,
      allResults: [...allResults],
      analysis: finalAnalysis,
      isComplete: true
    });
  }

  return {
    success: true,
    totalCombinations: combinations.length,
    resultsCollected: allResults.length,
    allResults
  };
}

/**
 * Use Gemini to analyze all flexible search results
 */
async function analyzeFlexibleResults(results, searchParams) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, skipping analysis');
    return {
      cheapestOption: results[0] || null,
      summary: 'Analysis unavailable - API key not configured'
    };
  }

  // Prepare data for Gemini
  const resultsData = results.map(r => ({
    dates: `${r.departureDate} to ${r.returnDate}`,
    cheapestPrice: r.cheapestPrice,
    flightCount: r.flights.length,
    topFlight: r.flights[0] || null
  }));

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          cheapestOption: {
            type: "object",
            properties: {
              departureDate: { type: "string" },
              returnDate: { type: "string" },
              price: { type: "string" },
              airline: { type: "string" },
              reasoning: { type: "string" }
            }
          },
          trends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                observation: { type: "string" },
                impact: { type: "string" }
              }
            }
          },
          recommendations: {
            type: "array",
            items: { type: "string" }
          },
          summary: { type: "string" }
        },
        required: ["cheapestOption", "summary"]
      }
    }
  });

  // Determine if this is a partial or complete analysis
  const totalExpected = Math.max(30 - searchParams.tripDuration + 1, 1); // Rough estimate
  const isPartial = results.length < totalExpected;
  
  const prompt = `You are analyzing flight search results for flexible dates.

Search Parameters:
- Route: ${searchParams.departureAirport} → ${searchParams.arrivalAirport}
- Month: ${new Date(searchParams.year, searchParams.month).toLocaleString('default', { month: 'long', year: 'numeric' })}
- Trip Duration: ${searchParams.tripDuration} days
- Results Available: ${results.length} searches completed ${isPartial ? '(MORE DATA COMING - This is a PROGRESSIVE update)' : '(COMPLETE)'}

${isPartial ? `IMPORTANT: This is a PROGRESSIVE analysis. More search results are still coming in. 
Your analysis should reflect that this is based on PARTIAL data and may change as more results arrive.
Use phrases like "so far", "based on current data", "preliminary findings", etc.` : ''}

Results Data:
${JSON.stringify(resultsData, null, 2)}

Your task:
1. Identify the CHEAPEST option ${isPartial ? 'SO FAR' : ''} with exact dates, price, and airline
2. Identify pricing TRENDS ${isPartial ? '(preliminary patterns)' : ''} (e.g., "Prices increase on weekends", "Mid-month is cheaper")
3. Provide RECOMMENDATIONS for the user ${isPartial ? '(may update as more data arrives)' : ''}
4. Write a brief SUMMARY ${isPartial ? 'acknowledging this is based on partial data' : ''}

Return structured JSON with your analysis.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const analysis = JSON.parse(text);
    
    console.log('Gemini Analysis:', JSON.stringify(analysis, null, 2));
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    
    // Fallback: Find cheapest manually
    const cheapest = results.reduce((min, curr) => {
      if (!min || (curr.cheapestPrice && curr.cheapestPrice < min.cheapestPrice)) {
        return curr;
      }
      return min;
    }, null);

    return {
      cheapestOption: cheapest ? {
        departureDate: cheapest.departureDate,
        returnDate: cheapest.returnDate,
        price: cheapest.cheapestPrice,
        airline: cheapest.flights[0]?.airline || 'Unknown',
        reasoning: 'Lowest price found across all date combinations'
      } : null,
      summary: `Searched ${results.length} date combinations. ${cheapest ? `Cheapest found: ${cheapest.cheapestPrice}` : 'No results found'}`
    };
  }
}

module.exports = {
  runFlexibleSearch,
  generateDateCombinations
};
