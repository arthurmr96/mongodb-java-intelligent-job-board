import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import CandidatePage from './pages/CandidatePage';
import RecruiterPage from './pages/RecruiterPage';
import CandidateMatchesPage from './pages/CandidateMatchesPage';
import JobMatchesPage from './pages/JobMatchesPage';

/**
 * App
 *
 * Root component with a simple tab navigation between the Candidate and
 * Recruiter portals. In a production app you would use React Router instead.
 */
export default function App() {
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
            { to: '/candidate', label: '👤 I\'m a Candidate' },
            { to: '/recruiter', label: '🏢 I\'m a Recruiter' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-100 text-green-800'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`
              }
              end
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <Routes>
        <Route path="/" element={<Navigate to="/candidate" replace />} />
        <Route path="/candidate" element={<CandidatePage />} />
        <Route path="/recruiter" element={<RecruiterPage />} />

        <Route path="/candidate/:candidateId/matches" element={<CandidateMatchesPage />} />
        <Route path="/job/:jobId/matches" element={<JobMatchesPage />} />

        <Route path="*" element={<Navigate to="/candidate" replace />} />
      </Routes>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 mt-8">
        Built with Java 21 · Spring Boot 3 · MongoDB Atlas Vector Search · VoyageAI
      </footer>
    </div>
  );
}
