# TravelAgent 🛫

An AI-powered flight booking assistant that uses **Gemini 2.0 Computer Use** and **BrowserBase** for intelligent, cloud-based browser automation to find the cheapest flight tickets on Expedia.com.

## Features

- 🤖 **AI-Powered**: Uses Gemini 2.0 Flash with Computer Use to intelligently interact with websites
- 🎯 **Smart Flight Search**: AI agent analyzes screenshots and takes actions autonomously
- ☁️ **Cloud-Based**: Uses BrowserBase for reliable, scalable browser automation
- 📺 **Live View**: Watch the AI agent work in real-time through embedded browser session
- 🎨 **Modern UI**: Beautiful, responsive interface built with React and TailwindCSS
- ⚡ **Real-time Updates**: See each action the AI takes as it happens
- 🔒 **Secure**: API keys stored in environment variables

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- Lucide React (icons)

### Backend
- Node.js
- Express
- Playwright (for browser automation)
- BrowserBase (cloud headless browser)
- **Gemini 2.0 Flash** (Computer Use model for AI agent)

## Prerequisites

1. **Node.js**: Version 16 or higher
2. **BrowserBase Account**: Sign up at [browserbase.com](https://browserbase.com)
   - Get your API Key
   - Get your Project ID
3. **Google Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/apikey)
   - Free tier available
   - See [GEMINI_SETUP.md](./GEMINI_SETUP.md) for detailed instructions

## Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/sreejithr/CascadeProjects/TravelAgent
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file and add your BrowserBase credentials:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here
PORT=3001
```

**How to get BrowserBase credentials:**
1. Go to [browserbase.com](https://browserbase.com)
2. Sign up or log in
3. Create a new project
4. Copy your API Key from the dashboard
5. Copy your Project ID

### 3. Run the Application

Start both the frontend and backend:

```bash
npm run dev
```

This will start:
- Frontend (React): http://localhost:3000
- Backend (Express): http://localhost:3001

Alternatively, you can run them separately:

```bash
# Terminal 1 - Frontend
npm run dev:client

# Terminal 2 - Backend
npm run dev:server
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Fill in the flight search form:
   - **Departure Airport**: Enter airport code (e.g., SFO, LAX)
   - **Arrival Airport**: Enter airport code (e.g., JFK, ORD)
   - **Departure Date**: Select your departure date
   - **Return Date**: Select your return date
3. Click "Search Flights"
4. Wait for the AI agent to browse Expedia and retrieve results
5. View the flight options with prices

## How It Works

1. **User Input**: User enters flight search criteria on the frontend
2. **API Request**: Frontend sends request to Express backend
3. **BrowserBase Session**: Backend creates a BrowserBase session
4. **Browser Automation**: Playwright connects to BrowserBase cloud browser
5. **Expedia Search**: Automated browser navigates to Expedia.com with search parameters
6. **Data Extraction**: Flight information is extracted from the page
7. **Results Display**: Data is sent back to frontend and displayed to user

## Project Structure

```
TravelAgent/
├── server/
│   ├── index.js                 # Express server
│   ├── routes/
│   │   └── flightSearch.js      # Flight search API routes
│   └── services/
│       └── browserbaseService.js # BrowserBase integration
├── src/
│   ├── App.jsx                  # Main React component
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html                   # HTML template
├── package.json                 # Dependencies
├── vite.config.js               # Vite configuration
├── tailwind.config.js           # TailwindCSS configuration
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

## API Endpoints

### POST `/api/search-flights`

Search for flights on Expedia.

**Request Body:**
```json
{
  "departureAirport": "SFO",
  "arrivalAirport": "JFK",
  "departureDate": "2024-01-15",
  "returnDate": "2024-01-22"
}
```

**Response:**
```json
{
  "flights": [
    {
      "airline": "United Airlines",
      "price": "$350",
      "duration": "5h 30m",
      "route": "SFO to JFK",
      "type": "Round trip"
    }
  ],
  "message": "Found 5 flight options",
  "searchParams": {
    "from": "SFO",
    "to": "JFK",
    "departureDate": "01/15/2024",
    "returnDate": "01/22/2024"
  }
}
```

## Troubleshooting

### BrowserBase Connection Issues
- Verify your API key and Project ID in `.env`
- Check that you have an active BrowserBase subscription
- Ensure your network allows WebSocket connections

### No Results Found
- Verify airport codes are correct (3-letter IATA codes)
- Check that dates are in the future
- Expedia's page structure may have changed - check console logs

### Port Already in Use
- Change the PORT in `.env` file
- Kill any processes using ports 3000 or 3001

## Development

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Important Notes

- **Rate Limiting**: Be mindful of making too many requests to avoid being blocked
- **Page Structure**: Expedia may update their website structure, requiring updates to selectors
- **BrowserBase Limits**: Check your BrowserBase plan for session limits and usage
- **Legal**: Ensure compliance with Expedia's Terms of Service when using automation

## License

MIT

## Support

For issues related to:
- **BrowserBase**: Visit [browserbase.com/docs](https://docs.browserbase.com)
- **This Application**: Open an issue in the repository

## 🚀 Deployment

Ready to deploy your app? Check out these guides:

- **Quick Deploy (5 min)**: See `QUICK_DEPLOY.md` for step-by-step Render deployment
- **Full Guide**: See `DEPLOYMENT_GUIDE.md` for multiple deployment options
- **Summary**: See `DEPLOYMENT_SUMMARY.md` for what's configured

**Recommended Platform**: [Render](https://render.com) - Free tier available!

### Quick Deploy Steps:
1. Push to GitHub
2. Connect to Render
3. Set environment variables
4. Deploy!

Your app will be live at: `https://your-app.onrender.com` 🎉

---

Built with ❤️ using React, Express, BrowserBase, and Gemini 2.0
