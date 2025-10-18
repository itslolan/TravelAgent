import React, { useState, useEffect } from 'react';
import { Plane, Calendar, MapPin, Loader2, DollarSign, ExternalLink, MonitorPlay, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

function App() {
  const [searchMode, setSearchMode] = useState('flexible'); // 'flexible' or 'fixed'
  const [formData, setFormData] = useState({
    departureAirport: 'YVR',
    arrivalAirport: 'DEL',
    departureDate: '2025-11-05',
    returnDate: '2025-11-10',
  });
  const [flexibleData, setFlexibleData] = useState({
    month: new Date().getMonth(), // 0-11
    year: new Date().getFullYear(),
    tripDuration: 25
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeMinions, setActiveMinions] = useState([]); // Track active minion sessions
  const [completedMinions, setCompletedMinions] = useState([]); // Track completed minions for animation
  const [minionHistory, setMinionHistory] = useState([]); // Track all minions for history
  const [showMinionHistory, setShowMinionHistory] = useState(false); // Toggle minion history panel

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setStatusMessage('Initializing search...');
    setActiveMinions([]);
    setCompletedMinions([]);
    setMinionHistory([]);
    setShowMinionHistory(false);

    try {
      // Prepare request body based on search mode
      const requestBody = searchMode === 'flexible' 
        ? {
            searchMode: 'flexible',
            departureAirport: formData.departureAirport,
            arrivalAirport: formData.arrivalAirport,
            month: flexibleData.month,
            year: flexibleData.year,
            tripDuration: flexibleData.tripDuration
          }
        : {
            searchMode: 'fixed',
            ...formData
          };

      const response = await fetch('/api/search-flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to start search');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setLoading(false);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            
            if (data.error) {
              setError(data.error);
              setLoading(false);
              return;
            }

            // Update status message
            if (data.message) {
              setStatusMessage(data.message);
            }

            // Handle minion session updates
            if (data.minionId && data.sessionId && data.debuggerUrl) {
              setActiveMinions(prev => {
                const existing = prev.find(m => m.minionId === data.minionId);
                if (existing) {
                  return prev.map(m => 
                    m.minionId === data.minionId 
                      ? { ...m, ...data }
                      : m
                  );
                }
                return [...prev, {
                  minionId: data.minionId,
                  sessionId: data.sessionId,
                  debuggerUrl: data.debuggerUrl,
                  departureDate: data.departureDate,
                  returnDate: data.returnDate,
                  status: data.status
                }];
              });
            }

            // Handle minion retry
            if (data.status === 'retrying' && data.minionId) {
              setActiveMinions(prev => prev.map(m => 
                m.minionId === data.minionId 
                  ? { ...m, isRetrying: true, retryAttempt: data.attempt }
                  : m
              ));
            }

            // Handle minion completion
            if (data.status === 'minion_completed' && data.minionId) {
              // Mark as completed
              setCompletedMinions(prev => [...prev, data.minionId]);
              
              // Add to history
              setMinionHistory(prev => {
                const existing = prev.find(m => m.minionId === data.minionId);
                if (!existing) {
                  return [...prev, {
                    minionId: data.minionId,
                    departureDate: data.departureDate,
                    returnDate: data.returnDate,
                    status: 'completed',
                    completedAt: new Date().toISOString()
                  }];
                }
                return prev;
              });
              
              // Remove from active after 3 seconds
              setTimeout(() => {
                setActiveMinions(prev => prev.filter(m => m.minionId !== data.minionId));
                setCompletedMinions(prev => prev.filter(id => id !== data.minionId));
              }, 3000);
            }

            // Handle minion failure
            if (data.status === 'minion_failed_final' && data.minionId) {
              // Mark as failed and remove after 5 seconds
              setActiveMinions(prev => prev.map(m => 
                m.minionId === data.minionId 
                  ? { ...m, isFailed: true, error: data.error }
                  : m
              ));
              
              // Add to history
              setMinionHistory(prev => {
                const existing = prev.find(m => m.minionId === data.minionId);
                if (!existing) {
                  return [...prev, {
                    minionId: data.minionId,
                    departureDate: data.departureDate,
                    returnDate: data.returnDate,
                    status: 'failed',
                    error: data.error,
                    failedAt: new Date().toISOString()
                  }];
                }
                return prev;
              });
              
              setTimeout(() => {
                setActiveMinions(prev => prev.filter(m => m.minionId !== data.minionId));
              }, 5000);
            }

            // Update session info for single (fixed) searches
            if (data.sessionId && data.debuggerUrl && !data.minionId) {
              setResults(prev => ({
                ...prev,
                sessionId: data.sessionId,
                debuggerUrl: data.debuggerUrl,
                status: data.status
              }));
            }

            // Handle progressive results updates (flexible search)
            if (data.status === 'progressive_results') {
              setResults(data);
              // Keep loading state true until all minions complete
              if (data.isComplete) {
                setLoading(false);
              }
            }

            // Update with final results (fixed search)
            if (data.status === 'completed' && data.searchMode !== 'flexible') {
              setResults(data);
              setLoading(false);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <Plane className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-bold text-gray-900">TravelAgent</h1>
              </div>
              <p className="mt-2 text-gray-600">AI-powered flight booking assistant</p>
            </div>
            {(loading || results) && (
              <button
                onClick={() => {
                  setLoading(false);
                  setResults(null);
                  setError(null);
                  setActiveMinions([]);
                  setCompletedMinions([]);
                  setMinionHistory([]);
                  setShowMinionHistory(false);
                }}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <Plane className="w-4 h-4" />
                <span>New Search</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`${loading || results ? 'max-w-full' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-8 py-12 transition-all duration-300`}>
        {/* Search Form - Hidden when loading or results shown */}
        {!loading && !results && (
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Find Your Perfect Flight
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Search Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Search Mode</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchMode"
                    value="flexible"
                    checked={searchMode === 'flexible'}
                    onChange={(e) => setSearchMode(e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700 font-medium">Flexible Dates (Find Cheapest)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchMode"
                    value="fixed"
                    checked={searchMode === 'fixed'}
                    onChange={(e) => setSearchMode(e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700 font-medium">Fixed Dates</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Departure Airport */}
              <div>
                <label htmlFor="departureAirport" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Departure Airport</span>
                  </div>
                </label>
                <input
                  type="text"
                  id="departureAirport"
                  name="departureAirport"
                  value={formData.departureAirport}
                  onChange={handleInputChange}
                  placeholder="e.g., SFO"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              {/* Arrival Airport */}
              <div>
                <label htmlFor="arrivalAirport" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Arrival Airport</span>
                  </div>
                </label>
                <input
                  type="text"
                  id="arrivalAirport"
                  name="arrivalAirport"
                  value={formData.arrivalAirport}
                  onChange={handleInputChange}
                  placeholder="e.g., JFK"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Conditional Date Inputs */}
            {searchMode === 'fixed' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Departure Date */}
                <div>
                  <label htmlFor="departureDate" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Departure Date</span>
                    </div>
                  </label>
                  <input
                    type="date"
                    id="departureDate"
                    name="departureDate"
                    value={formData.departureDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                {/* Return Date */}
                <div>
                  <label htmlFor="returnDate" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Return Date</span>
                    </div>
                  </label>
                  <input
                    type="date"
                    id="returnDate"
                    name="returnDate"
                    value={formData.returnDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Month Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Travel Month
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                      <button
                        key={month}
                        type="button"
                        onClick={() => setFlexibleData(prev => ({ ...prev, month: index }))}
                        className={`px-4 py-3 rounded-lg font-medium transition ${
                          flexibleData.month === index
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Year Selection */}
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <select
                      id="year"
                      value={flexibleData.year}
                      onChange={(e) => setFlexibleData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    >
                      {[2025, 2026, 2027].map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Trip Duration */}
                  <div>
                    <label htmlFor="tripDuration" className="block text-sm font-medium text-gray-700 mb-2">
                      Trip Duration (days)
                    </label>
                    <input
                      type="number"
                      id="tripDuration"
                      min="1"
                      max="29"
                      value={flexibleData.tripDuration}
                      onChange={(e) => setFlexibleData(prev => ({ ...prev, tripDuration: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching for flights...</span>
                </>
              ) : (
                <>
                  <Plane className="w-5 h-5" />
                  <span>Search Flights</span>
                </>
              )}
            </button>
          </form>

          {/* Status Message */}
          {loading && statusMessage && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMessage}</span>
              </p>
            </div>
          )}
        </div>
        )}

        {/* 2-Column Layout: Minion Grid (Left) + Results (Right) */}
        {(loading || results) && (
          <div className={`grid grid-cols-1 ${activeMinions.length > 0 ? 'lg:grid-cols-2' : ''} gap-6`}>
            {/* Left Column: Minion Grid - Only show when there are active minions */}
            {activeMinions.length > 0 && (
            <div className="space-y-6">
              {/* Status Message */}
              {loading && statusMessage && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusMessage}</span>
                  </p>
                </div>
              )}

              {/* Minion Grid - Active Browser Sessions */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <MonitorPlay className="w-6 h-6 text-indigo-600" />
                <h3 className="text-xl font-semibold text-gray-900">Active Search Sessions</h3>
              </div>
              <div className="text-sm text-gray-600">
                {activeMinions.length} active minion{activeMinions.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeMinions.map((minion) => {
                const isCompleted = completedMinions.includes(minion.minionId);
                const isFailed = minion.isFailed;
                const isRetrying = minion.isRetrying;
                
                return (
                  <div
                    key={minion.minionId}
                    className={`relative border-2 rounded-lg overflow-hidden transition-all duration-500 ${
                      isCompleted 
                        ? 'border-green-400 bg-green-50 scale-105' 
                        : isFailed
                        ? 'border-red-400 bg-red-50 scale-105'
                        : isRetrying
                        ? 'border-yellow-400 bg-yellow-50'
                        : 'border-indigo-200 bg-white hover:border-indigo-400'
                    }`}
                    style={{ minHeight: '300px' }}
                  >
                    {/* Minion Header */}
                    <div className={`p-3 ${
                      isCompleted ? 'bg-green-100' 
                      : isFailed ? 'bg-red-100'
                      : isRetrying ? 'bg-yellow-100'
                      : 'bg-indigo-50'
                    } border-b border-gray-200`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">
                            Minion #{minion.minionId}
                            {isRetrying && <span className="ml-2 text-yellow-700">(Retrying...)</span>}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {minion.departureDate} → {minion.returnDate}
                          </p>
                        </div>
                        {isCompleted && (
                          <CheckCircle className="w-8 h-8 text-green-600 animate-bounce" />
                        )}
                        {isFailed && (
                          <XCircle className="w-8 h-8 text-red-600 animate-pulse" />
                        )}
                        {isRetrying && (
                          <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin" />
                        )}
                      </div>
                    </div>

                    {/* Live Preview */}
                    {!isCompleted && !isFailed ? (
                      <div className="relative" style={{ height: '250px' }}>
                        <iframe
                          src={minion.debuggerUrl}
                          className="w-full h-full"
                          title={`Minion ${minion.minionId} Live Session`}
                          sandbox="allow-same-origin allow-scripts"
                          allow="clipboard-read; clipboard-write"
                        />
                        <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1 ${
                          isRetrying ? 'bg-yellow-600' : 'bg-blue-600'
                        }`}>
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          <span>{isRetrying ? 'RETRY' : 'LIVE'}</span>
                        </div>
                      </div>
                    ) : isCompleted ? (
                      <div className="flex items-center justify-center" style={{ height: '250px' }}>
                        <div className="text-center">
                          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
                          <p className="text-green-700 font-semibold">Search Complete!</p>
                          <p className="text-sm text-gray-600 mt-1">Results collected</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center" style={{ height: '250px' }}>
                        <div className="text-center">
                          <XCircle className="w-16 h-16 text-red-600 mx-auto mb-3" />
                          <p className="text-red-700 font-semibold">Search Failed</p>
                          <p className="text-sm text-gray-600 mt-1">{minion.error || 'Timeout after retries'}</p>
                        </div>
                      </div>
                    )}

                    {/* Session ID */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2">
                      <p className="truncate">Session: {minion.sessionId}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            </div>
            )}

            {/* Right Column: Results */}
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Collapsible Minion History - Show when search is complete */}
              {results && results.isComplete && minionHistory.length > 0 && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                  <button
                    onClick={() => setShowMinionHistory(!showMinionHistory)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <MonitorPlay className="w-5 h-5 text-indigo-600" />
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Search History ({minionHistory.length} searches)
                        </h3>
                        <p className="text-sm text-gray-600">
                          {minionHistory.filter(m => m.status === 'completed').length} successful • {minionHistory.filter(m => m.status === 'failed').length} failed
                        </p>
                      </div>
                    </div>
                    {showMinionHistory ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {showMinionHistory && (
                    <div className="px-6 pb-6 border-t border-gray-200">
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {minionHistory.map((minion) => (
                          <div
                            key={minion.minionId}
                            className={`p-4 rounded-lg border-2 ${
                              minion.status === 'completed'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-700">
                                Minion #{minion.minionId}
                              </span>
                              {minion.status === 'completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              {minion.departureDate} → {minion.returnDate}
                            </p>
                            <p className={`text-xs font-medium ${
                              minion.status === 'completed' ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {minion.status === 'completed' ? '✓ Completed' : `✗ ${minion.error || 'Failed'}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
              )}

        {/* Live Session Viewer (for single fixed searches) */}
        {results && results.debuggerUrl && !searchMode === 'flexible' && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <MonitorPlay className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Live Browser Session</h3>
              </div>
              <a
                href={results.debuggerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200" style={{ height: '600px' }}>
              <iframe
                src={results.debuggerUrl}
                className="w-full h-full"
                title="BrowserBase Live Session"
                sandbox="allow-same-origin allow-scripts"
                allow="clipboard-read; clipboard-write"
              />
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-600">
                Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{results.sessionId}</code>
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Watch the browser automation happen in real-time! If the iframe doesn't load properly, click "Open in New Tab" above for the best viewing experience.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {results && results.searchMode === 'flexible' && results.analysis && (
          <div className="mt-6 space-y-6">
            {/* Progressive Update Indicator */}
            {!results.isComplete && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-blue-900 font-semibold">
                      Updating results... ({results.completedMinions}/{results.totalCombinations} searches complete)
                    </p>
                    <p className="text-blue-700 text-sm mt-1">
                      Results will automatically update as more data becomes available
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Best Deal Highlight */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6 relative">
              {!results.isComplete && (
                <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-1 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>UPDATING</span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <DollarSign className="w-7 h-7 text-green-600" />
                <span>{results.isComplete ? 'Best Deal Found!' : 'Best Deal So Far...'}</span>
              </h3>
              {results.analysis.cheapestOption && (
                <div className="bg-white rounded-lg p-5 shadow-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Travel Dates</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {results.analysis.cheapestOption.departureDate} → {results.analysis.cheapestOption.returnDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="text-3xl font-bold text-green-600">{results.analysis.cheapestOption.price}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Airline</p>
                      <p className="text-lg font-semibold text-gray-900">{results.analysis.cheapestOption.airline}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Why This Option?</p>
                      <p className="text-sm text-gray-700">{results.analysis.cheapestOption.reasoning}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Trends & Insights */}
            {results.analysis.trends && results.analysis.trends.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Pricing Trends</h3>
                <div className="space-y-3">
                  {results.analysis.trends.map((trend, index) => (
                    <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2">
                      <p className="font-medium text-gray-900">{trend.observation}</p>
                      <p className="text-sm text-gray-600 mt-1">{trend.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {results.analysis.recommendations && results.analysis.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">💡 Recommendations</h3>
                <ul className="space-y-2">
                  {results.analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-6 relative">
              {!results.isComplete && (
                <div className="absolute top-3 right-3 text-xs text-blue-600 font-semibold">
                  {results.completedMinions}/{results.totalCombinations} complete
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {results.isComplete ? 'Final Summary' : 'Summary (Updating...)'}
              </h3>
              <p className="text-gray-700">{results.analysis.summary}</p>
              <p className="text-sm text-gray-500 mt-3">
                {results.isComplete 
                  ? `Searched ${results.totalCombinations} date combinations • ${results.resultsCollected} successful${results.failedMinions > 0 ? ` • ${results.failedMinions} failed` : ''}`
                  : `Analyzed ${results.completedMinions} of ${results.totalCombinations} searches • More results coming...`
                }
              </p>
              {results.failedMinions > 0 && results.isComplete && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    ⚠️ {results.failedMinions} search{results.failedMinions !== 1 ? 'es' : ''} failed due to timeout. Results shown are based on successful searches only.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {results && results.flights && results.flights.length > 0 && !results.searchMode && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Available Flights
            </h3>
            <div className="space-y-4">
              {results.flights.map((flight, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg text-gray-900">{flight.airline}</p>
                      <p className="text-sm text-gray-600 mt-1">{flight.route}</p>
                      <p className="text-sm text-gray-500 mt-1">Duration: {flight.duration}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <p className="text-2xl font-bold text-green-600">{flight.price}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{flight.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
            </div>
          </div>
        )}

        {/* Info Section - Only show when not searching */}
        {!loading && !results && (
          <div className="mt-8 bg-indigo-50 rounded-lg p-6 max-w-4xl mx-auto">
            <h4 className="font-semibold text-indigo-900 mb-2">How it works</h4>
            <ul className="space-y-2 text-indigo-800 text-sm">
              <li>• Enter your departure and arrival airports (e.g., SFO, JFK)</li>
              <li>• Select your travel dates or choose flexible search</li>
              <li>• Our AI agent will search Expedia.com using BrowserBase automation</li>
              <li>• Get the best flight prices instantly with AI-powered insights</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
