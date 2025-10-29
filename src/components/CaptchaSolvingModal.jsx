import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, User, Bot } from 'lucide-react';

const CaptchaSolvingModal = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  browserUrl, 
  captchaCount = 1,
  currentCaptcha = 1,
  minionId,
  minionRoute,
  useHumanSolving = true // Toggle between human and AI solving
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    let interval;
    if (isOpen) {
      setTimeElapsed(0);
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleNext = async () => {
    setIsLoading(true);
    try {
      await onContinue();
    } finally {
      setIsLoading(false);
    }
  };

  const hasMoreCaptchas = currentCaptcha < captchaCount;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {useHumanSolving ? (
                <User className="w-5 h-5 text-blue-600" />
              ) : (
                <Bot className="w-5 h-5 text-purple-600" />
              )}
              <h2 className="text-xl font-semibold text-gray-900">
                {useHumanSolving ? 'Human CAPTCHA Solving' : 'AI CAPTCHA Solving'}
              </h2>
            </div>
            <div className="text-sm text-gray-500">
              ({currentCaptcha} of {captchaCount})
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress and Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Progress */}
              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium text-gray-700">Progress:</div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(currentCaptcha / captchaCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">
                    {Math.round((currentCaptcha / captchaCount) * 100)}%
                  </span>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeElapsed)}</span>
              </div>

              {/* Minion Info */}
              <div className="text-sm text-gray-500">
                {minionId && (
                  <div>Minion: {minionId}</div>
                )}
                {minionRoute && (
                  <div className="font-medium text-gray-700">Route: {minionRoute}</div>
                )}
              </div>
            </div>

            {/* Mode Toggle Info */}
            <div className="flex items-center space-x-2 text-sm">
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                useHumanSolving 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {useHumanSolving ? 'Human Mode' : 'AI Mode'}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-6 py-4 bg-blue-50 border-b">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              {useHumanSolving ? (
                <>
                  <strong>Instructions:</strong> A CAPTCHA has been detected in the browser session. 
                  Please solve the CAPTCHA in the embedded browser below, then click "Continue" to proceed with the search.
                </>
              ) : (
                <>
                  <strong>AI Processing:</strong> The AI is analyzing and solving the CAPTCHA automatically. 
                  This may take a few moments. Please wait...
                </>
              )}
            </div>
          </div>
        </div>

        {/* Browser Iframe */}
        <div className="flex-1 p-6">
          <div className="relative w-full h-96 border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
            {browserUrl ? (
              <iframe
                src={browserUrl}
                className="w-full h-full"
                title="CAPTCHA Solving Browser"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                allow="clipboard-read; clipboard-write; camera; microphone"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Browser session not available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live Session Active</span>
            </div>
            {captchaCount > 1 && (
              <div>
                {hasMoreCaptchas 
                  ? `${captchaCount - currentCaptcha} more CAPTCHA${captchaCount - currentCaptcha !== 1 ? 's' : ''} after this one`
                  : 'This is the last CAPTCHA'
                }
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel Search
            </button>
            
            {useHumanSolving ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{hasMoreCaptchas ? 'Next CAPTCHA' : 'Continue Search'}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="px-6 py-2 bg-purple-100 text-purple-800 rounded-lg flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span>AI Solving...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaptchaSolvingModal;
