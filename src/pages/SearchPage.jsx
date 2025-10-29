import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plane, Loader2, DollarSign, ExternalLink, MonitorPlay, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchParams, testMode: isTestMode, proxyConfig } = location.state || {};

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeMinions, setActiveMinions] = useState([]);
  const [completedMinions, setCompletedMinions] = useState([]);
  const [minionHistory, setMinionHistory] = useState([]);
  const [showMinionHistory, setShowMinionHistory] = useState(false);
  const [captchaActions, setCaptchaActions] = useState([]);
  const [testMode, setTestMode] = useState(isTestMode || false);

  useEffect(() => {
    // If no search params, redirect to home
    if (!searchParams && !isTestMode) {
      navigate('/');
      return;
    }

    // Start the search
    startSearch();
  }, []);

  const startSearch = async () => {
    try {
      setStatusMessage('Initializing search...');

      const endpoint = testMode ? '/api/test-captcha' : '/api/search-flights';
      const requestBody = testMode ? { proxyConfig } : { ...searchParams, proxyConfig };

      console.log('🚀 Starting search with:', requestBody);
      console.log('🔌 Proxy config:', proxyConfig);
      console.log('🌐 API URL:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to start search: ${response.status} ${errorText}`);
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

            if (data.status) {
              setStatusMessage(data.message || '');

              // Track CAPTCHA actions for test mode
              if (data.action) {
                console.log('📝 Received action:', data.action.type, 'Has screenshot:', !!data.action.screenshot);
                setCaptchaActions(prev => [...prev, {
                  timestamp: new Date().toISOString(),
                  ...data.action
                }]);
              }

              // Handle different status updates
              handleStatusUpdate(data);

              if (data.status === 'completed') {
                setResults(data);
                setLoading(false);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleStatusUpdate = (data) => {
    // Handle minion updates
    if (data.minionId) {
      setActiveMinions(prev => {
        const existing = prev.find(m => m.minionId === data.minionId);
        if (existing) {
          return prev.map(m =>
            m.minionId === data.minionId
              ? { ...m, status: data.status, message: data.message }
              : m
          );
        } else {
          return [...prev, {
            minionId: data.minionId,
            status: data.status,
            message: data.message,
            departureDate: data.departureDate || 'Test',
            returnDate: data.returnDate || 'Mode',
            sessionId: data.sessionId,
            debuggerUrl: data.debuggerUrl,
            isFailed: false,
            isRetrying: false
          }];
        }
      });
    }

    // Handle session creation
    if (data.status === 'session_created') {
      setActiveMinions(prev => prev.map(m =>
        m.minionId === data.minionId
          ? { ...m, sessionId: data.sessionId, debuggerUrl: data.debuggerUrl }
          : m
      ));
    }

    // Handle minion completion
    if (data.status === 'minion_completed') {
      setCompletedMinions(prev => [...prev, data.minionId]);
      setTimeout(() => {
        setMinionHistory(prev => [...prev, {
          minionId: data.minionId,
          departureDate: data.departureDate,
          returnDate: data.returnDate,
          status: 'completed'
        }]);
      }, 2000);
    }

    // Handle minion retry
    if (data.status === 'minion_retrying') {
      setActiveMinions(prev => prev.map(m =>
        m.minionId === data.minionId
          ? { ...m, isRetrying: true, retryAttempt: data.retryAttempt }
          : m
      ));
    }

    // Handle minion failure
    if (data.status === 'minion_failed' || data.status === 'minion_failed_final') {
      setActiveMinions(prev => prev.map(m =>
        m.minionId === data.minionId
          ? { ...m, isFailed: true, error: data.error }
          : m
      ));
      setMinionHistory(prev => [...prev, {
        minionId: data.minionId,
        departureDate: data.departureDate,
        returnDate: data.returnDate,
        status: 'failed',
        error: data.error
      }]);
    }
  };

  const handleNewSearch = () => {
    navigate('/');
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
                <h1 className="text-3xl font-bold text-gray-900">Trip Agent</h1>
              </div>
              <p className="mt-2 text-gray-600">AI-powered flight booking assistant</p>
            </div>
            <button
              onClick={handleNewSearch}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              <Plane className="w-4 h-4" />
              <span>New Search</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Display */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-900 font-semibold">Search Error</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        {loading && statusMessage && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <span className="text-blue-900 font-medium">{statusMessage}</span>
            </div>
          </div>
        )}

        {/* Active Minions Display */}
        {activeMinions.length > 0 && (
          <div className="mb-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Active Search Sessions</h3>
                  <div className="text-sm text-gray-600">
                    {activeMinions.length} active minion{activeMinions.length !== 1 ? 's' : ''}
                  </div>
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
                      {!isCompleted && !isFailed && minion.debuggerUrl ? (
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
                      {minion.sessionId && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2">
                          <p className="truncate">Session: {minion.sessionId}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CAPTCHA Actions Log - Only in Test Mode */}
            {testMode && captchaActions.length > 0 && (
              <div className="mt-8 max-w-7xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MonitorPlay className="w-5 h-5 mr-2 text-amber-600" />
                  Gemini CAPTCHA Solver Actions ({captchaActions.length} steps)
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-y-auto" style={{ maxHeight: '800px' }}>
                  <div className="space-y-4 font-mono text-sm">
                    {captchaActions.map((action, index) => (
                      <div key={index} className="border-l-4 border-amber-500 pl-3 py-3 bg-gray-800 rounded-r">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="bg-amber-600 text-white px-2 py-1 rounded text-xs font-bold">
                                Step {index + 1}
                              </span>
                              <span className="text-amber-400 font-semibold">
                                [{new Date(action.timestamp).toLocaleTimeString()}]
                              </span>
                              <span className="text-green-400">
                                {action.type}
                              </span>
                            </div>
                            {action.description && (
                              <p className="text-gray-300 mt-1">{action.description}</p>
                            )}
                            {action.coordinates && (
                              <p className="text-blue-400 mt-1">
                                Coordinates: ({action.coordinates.x}, {action.coordinates.y})
                              </p>
                            )}
                            {action.reasoning && (
                              <p className="text-purple-400 mt-1 italic">"{action.reasoning}"</p>
                            )}
                            {action.screenshot && (
                              <div className="mt-3 bg-gray-950 p-3 rounded">
                                <div className="flex items-center space-x-2 mb-2">
                                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                  <p className="text-cyan-400 text-xs font-semibold">
                                    {action.type === 'assess' ? '📸 AFTER Action Screenshot' : '📸 Screenshot Analyzed by AI'}
                                  </p>
                                </div>
                                <img
                                  src={`data:image/jpeg;base64,${action.screenshot}`}
                                  alt={`Screenshot for ${action.type}`}
                                  className="border-2 border-cyan-600 rounded max-w-full h-auto cursor-pointer hover:border-cyan-400 transition"
                                  style={{ maxHeight: '500px' }}
                                  onClick={(e) => {
                                    // Open in new tab for full size view
                                    const win = window.open();
                                    win.document.write(`<img src="data:image/jpeg;base64,${action.screenshot}" />`);
                                  }}
                                  title="Click to view full size"
                                />
                                <p className="text-gray-500 text-xs mt-1 italic">Click to view full size</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {results && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Search Complete!</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default SearchPage;
