import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Calendar, MapPin, MonitorPlay } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState('fixed');
  const [formData, setFormData] = useState({
    departureAirport: 'YVR',
    arrivalAirport: 'DEL',
    departureDate: '2025-11-05',
    returnDate: '2025-11-10',
  });
  const [flexibleData, setFlexibleData] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    tripDuration: 25
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare search parameters
    const searchParams = searchMode === 'flexible'
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

    // Navigate to search page with parameters
    navigate('/search', { state: { searchParams, testMode: false } });
  };

  const handleTestCaptcha = () => {
    // Navigate to search page in test mode
    navigate('/search', { state: { searchParams: null, testMode: true } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <Plane className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Trip Agent</h1>
              <p className="mt-1 text-gray-600">AI-powered flight booking assistant</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
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

            {/* Conditional Fields Based on Search Mode */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Month Selection */}
                  <div>
                    <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Month</span>
                      </div>
                    </label>
                    <select
                      id="month"
                      value={flexibleData.month}
                      onChange={(e) => setFlexibleData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>
                          {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year Selection */}
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Year</span>
                      </div>
                    </label>
                    <select
                      id="year"
                      value={flexibleData.year}
                      onChange={(e) => setFlexibleData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    >
                      {Array.from({ length: 3 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
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
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition flex items-center justify-center space-x-2"
            >
              <Plane className="w-5 h-5" />
              <span>Search Flights</span>
            </button>

            {/* Test CAPTCHA Solver Button */}
            <button
              type="button"
              onClick={handleTestCaptcha}
              className="w-full bg-amber-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition flex items-center justify-center space-x-2"
            >
              <MonitorPlay className="w-5 h-5" />
              <span>Test CAPTCHA Solver</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Home;
