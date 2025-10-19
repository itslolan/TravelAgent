const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const MAX_ITERATIONS = 10;
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

/**
 * Use Gemini to check if the flight results page is ready
 * Returns structured JSON with page state
 */
async function checkPageReadiness(page) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          isReady: {
            type: 'boolean',
            description: 'Whether the flight results page is fully loaded and ready'
          },
          pageState: {
            type: 'string',
            enum: ['loading', 'captcha', 'error', 'results_ready', 'no_results', 'unknown'],
            description: 'Current state of the page'
          },
          confidence: {
            type: 'number',
            description: 'Confidence level from 0 to 1'
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of the assessment'
          }
        },
        required: ['isReady', 'pageState', 'confidence', 'reasoning']
      }
    }
  });

  // Take screenshot as Buffer
  const screenshotBuffer = await page.screenshot({ type: 'png' });

  const prompt = `You are analyzing a flight search results page on Expedia.com.

Your task is to determine if the page is ready for data extraction.

Page States:
- "loading": Page is still loading, showing spinners or loading indicators
- "captcha": CAPTCHA or bot verification challenge is present (e.g., "Verify you are human", reCAPTCHA, security check)
- "error": Error message displayed (e.g., "No flights found", "Something went wrong")
- "results_ready": Flight results are fully loaded and visible with prices, airlines, and times
- "no_results": Page loaded but shows "No flights available" or similar message
- "unknown": Cannot determine the state

Criteria for "results_ready" (isReady: true):
1. Multiple flight options are visible (at least 2-3 flight cards)
2. Each flight shows: airline name, price, departure/arrival times
3. No loading spinners or "Loading..." text
4. No CAPTCHA or verification challenges
5. Page appears stable and complete

Analyze the screenshot and return your assessment.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'image/png',
        data: screenshotBuffer.toString('base64')
      }
    }
  ]);

  const response = result.response;
  const jsonResponse = JSON.parse(response.text());
  
  return jsonResponse;
}

/**
 * Execute a Gemini Computer Use action using Playwright
 */
async function executeAction(page, functionCall) {
  const { name, args } = functionCall;
  
  console.log(`Executing action: ${name}`, args);
  
  try {
    switch (name) {
      case 'wait_5_seconds':
        await page.waitForTimeout(5000);
        break;
        
      case 'go_back':
        await page.goBack();
        break;
        
      case 'go_forward':
        await page.goForward();
        break;
        
      case 'navigate':
        await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
        break;
        
      case 'click_at':
        await page.mouse.click(args.x, args.y);
        break;
        
      case 'hover_at':
        await page.mouse.move(args.x, args.y);
        break;
        
      case 'type_text_at':
        // Click at position first
        await page.mouse.click(args.x, args.y);
        await page.waitForTimeout(500);
        
        // Clear if needed
        if (args.clear_before_typing) {
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
        }
        
        // Type the text
        await page.keyboard.type(args.text);
        
        // Press enter if needed
        if (args.press_enter) {
          await page.keyboard.press('Enter');
        }
        break;
        
      case 'key_combination':
        const keys = args.keys.split('+');
        for (const key of keys) {
          await page.keyboard.down(key);
        }
        for (const key of keys.reverse()) {
          await page.keyboard.up(key);
        }
        break;
        
      case 'scroll_document':
        const scrollAmount = args.direction === 'down' ? 500 : -500;
        await page.evaluate((amount) => {
          window.scrollBy(0, amount);
        }, scrollAmount);
        break;
        
      case 'scroll_at':
        await page.mouse.move(args.x, args.y);
        const wheelDelta = args.direction === 'down' ? args.magnitude : -args.magnitude;
        await page.mouse.wheel(0, wheelDelta);
        break;
        
      case 'drag_and_drop':
        await page.mouse.move(args.x, args.y);
        await page.mouse.down();
        await page.mouse.move(args.destination_x, args.destination_y);
        await page.mouse.up();
        break;
        
      default:
        console.warn(`Unknown action: ${name}`);
        return { success: false, error: `Unknown action: ${name}` };
    }
    
    // Wait a bit for the action to take effect
    await page.waitForTimeout(1000);
    
    return { success: true };
  } catch (error) {
    console.error(`Error executing action ${name}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Capture screenshot and URL from the page
 */
async function captureState(page) {
  try {
    // Capture full page screenshot to avoid needing multiple scroll actions
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });
    const url = page.url();
    
    return {
      screenshot,
      url,
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT
    };
  } catch (error) {
    console.error('Error capturing state:', error);
    throw error;
  }
}

/**
 * Run Gemini Computer Use agent loop
 */
async function runGeminiAgentLoop({ page, task, onProgress }) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in environment variables');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          flights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                airline: { type: "string", description: "Airline name" },
                price: { type: "string", description: "Price in dollars (e.g., '$1,177')" },
                duration: { type: "string", description: "Flight duration (e.g., '20h 10m')" },
                route: { type: "string", description: "Route description including stops" },
                stops: { type: "string", description: "Number of stops (e.g., '1 stop', 'nonstop')" }
              },
              required: ["airline", "price", "duration", "route"]
            }
          },
          summary: { type: "string", description: "Brief summary of findings" }
        },
        required: ["flights"]
      }
    }
  });
  
  // Add initial user message
  const initialState = await captureState(page);
  
  onProgress({
    status: 'gemini_started',
    message: 'Starting Gemini Computer Use agent loop...',
    iteration: 0
  });
  
  // Create chat session once with tools
  const chat = model.startChat({
    tools: [{
          functionDeclarations: [
            {
              name: 'click_at',
              description: 'Click at specific coordinates',
              parameters: {
                type: 'object',
                properties: {
                  x: { type: 'number', description: 'X coordinate' },
                  y: { type: 'number', description: 'Y coordinate' }
                },
                required: ['x', 'y']
              }
            },
            {
              name: 'type_text_at',
              description: 'Type text at specific coordinates',
              parameters: {
                type: 'object',
                properties: {
                  x: { type: 'number', description: 'X coordinate' },
                  y: { type: 'number', description: 'Y coordinate' },
                  text: { type: 'string', description: 'Text to type' },
                  press_enter: { type: 'boolean', description: 'Press enter after typing' },
                  clear_before_typing: { type: 'boolean', description: 'Clear field before typing' }
                },
                required: ['x', 'y', 'text']
              }
            },
            {
              name: 'scroll_document',
              description: 'Scroll the document',
              parameters: {
                type: 'object',
                properties: {
                  direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' }
                },
                required: ['direction']
              }
            },
            {
              name: 'wait_5_seconds',
              description: 'Wait for 5 seconds',
              parameters: { type: 'object', properties: {} }
            },
            {
              name: 'navigate',
              description: 'Navigate to a URL',
              parameters: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'URL to navigate to' }
                },
                required: ['url']
              }
            }
          ]
        }]
  });
  
  // Send initial message with task and screenshot
  let result = await chat.sendMessage([
    { text: task },
    { 
      inlineData: {
        mimeType: 'image/png',
        data: initialState.screenshot.toString('base64')
      }
    }
  ]);
  
  // Agent loop
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    console.log(`\n=== Gemini Iteration ${iteration + 1}/${MAX_ITERATIONS} ===`);
    
    onProgress({
      status: 'gemini_thinking',
      message: `Gemini is analyzing the screen (iteration ${iteration + 1}/${MAX_ITERATIONS})...`,
      iteration: iteration + 1
    });
    
    try {
      const response = result.response;
      
      console.log('Gemini response:', JSON.stringify(response, null, 2));
      
      // Check for function calls
      const functionCalls = response.candidates[0].content.parts.filter(part => part.functionCall);
      
      if (functionCalls.length === 0) {
        // No more actions, task complete
        const textPart = response.candidates[0].content.parts.find(part => part.text);
        const responseText = textPart ? textPart.text : '{}';
        
        // Parse JSON response
        let flightData;
        try {
          flightData = JSON.parse(responseText);
          console.log('Gemini extracted flights:', JSON.stringify(flightData, null, 2));
        } catch (err) {
          console.error('Failed to parse Gemini JSON response:', err);
          flightData = { flights: [], summary: 'Failed to parse response' };
        }
        
        const summary = flightData.summary || `Found ${flightData.flights?.length || 0} flights`;
        
        onProgress({
          status: 'gemini_complete',
          message: summary,
          iteration: iteration + 1,
          flightData // Pass the structured data to the caller
        });
        
        // Return the structured data
        return {
          success: true,
          finalUrl: page.url(),
          flightData
        };
      }
      
      // Execute each function call
      for (const part of functionCalls) {
        const functionCall = part.functionCall;
        
        onProgress({
          status: 'gemini_action',
          message: `Executing: ${functionCall.name}`,
          action: functionCall,
          iteration: iteration + 1
        });
        
        // Execute the action
        const actionResult = await executeAction(page, functionCall);
        
        // Capture new state
        const newState = await captureState(page);
        
        // Send function response back to Gemini
        result = await chat.sendMessage([
          {
            functionResponse: {
              name: functionCall.name,
              response: {
                success: actionResult.success,
                error: actionResult.error,
                url: newState.url
              }
            }
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: newState.screenshot.toString('base64')
            }
          }
        ]);
        
        onProgress({
          status: 'gemini_action_complete',
          message: `Completed: ${functionCall.name}`,
          iteration: iteration + 1,
          url: newState.url
        });
      }
      
    } catch (error) {
      console.error('Error in Gemini iteration:', error);
      
      onProgress({
        status: 'gemini_error',
        message: `Error: ${error.message}`,
        iteration: iteration + 1
      });
      
      // Continue to next iteration
      continue;
    }
  }
  
  console.log('\n=== Gemini Agent Loop Complete ===');
  
  return {
    success: true,
    finalUrl: page.url()
  };
}

module.exports = {
  runGeminiAgentLoop,
  executeAction,
  captureState,
  checkPageReadiness
};
