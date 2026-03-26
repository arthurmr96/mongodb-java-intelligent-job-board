import { useState } from 'react';
import CandidatePage from './pages/CandidatePage';
import RecruiterPage from './pages/RecruiterPage';

/**
 * App
 *
 * Root component with a simple tab navigation between the Candidate and
 * Recruiter portals. In a production app you would use React Router instead.
 */
export default function App() {
  const [tab, setTab] = useState('candidate');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-1 h-14">
          {/* Logo / brand */}
          <div className="flex items-center gap-2 mr-6">
            <span className="text-green-600 font-bold text-lg leading-none">⚡</span>
            <span className="font-semibold text-gray-800 text-sm hidden sm:block">
              JobMatch AI
            </span>
          </div>

          {/* Tabs */}
          {[
            { key: 'candidate', label: '👤 I\'m a Candidate' },
            { key: 'recruiter', label: '🏢 I\'m a Recruiter' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${tab === key
                  ? 'bg-green-100 text-green-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      {tab === 'candidate' ? <CandidatePage /> : <RecruiterPage />}

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 mt-8">
        Built with Java 21 · Spring Boot 3 · MongoDB Atlas Vector Search · VoyageAI
      </footer>
    </div>
  );
}
