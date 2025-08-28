import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Navigation from './components/Navigation';
import ProfileManager from './components/ProfileManager';
import EventManager from './components/EventManager';
import MarketplaceManager from './components/MarketplaceManager';
import MessagingSystem from './components/MessagingSystem';
import RewardSystem from './components/RewardSystem';
import CheckInSystem from './components/CheckInSystem';
import ProfileUpdateModal from './components/ProfileUpdateModal';
import { supabase } from './lib/supabaseClient';

function HomePage({ user }: { user: User }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Campus Connect
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Connect with your campus community, discover events, and earn rewards!
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Events</h3>
            <p className="text-gray-600">Discover and join campus events</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Marketplace</h3>
            <p className="text-gray-600">Buy and sell items with other students</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Rewards</h3>
            <p className="text-gray-600">Earn points and redeem exclusive coupons</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const handleAuthChange = (user: User | null) => {
    setUser(user);
    if (user) {
      checkUserProfile(user);
    } else {
      setShowProfileModal(false);
    }
  };

  const checkUserProfile = async (user: User) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        // Check if profile is complete
        const isComplete = data.full_name && data.email && data.university && data.degree && data.role;
        if (!isComplete) {
          setShowProfileModal(true);
        }
      } else {
        // No profile exists, show modal
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileUpdated = () => {
    setShowProfileModal(false);
  };

  const handleLogout = () => {
    setUser(null);
    setShowProfileModal(false);
  };

  if (!user) {
    return <Auth onAuthChange={handleAuthChange} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={handleLogout} />
        <main className="py-8">
          <Routes>
            <Route path="/" element={<HomePage user={user} />} />
            <Route path="/profile" element={<ProfileManager user={user} />} />
            <Route path="/events" element={<EventManager user={user} />} />
            <Route path="/marketplace" element={<MarketplaceManager user={user} />} />
            <Route path="/messages" element={<MessagingSystem user={user} />} />
            <Route path="/rewards" element={<RewardSystem user={user} />} />
            <Route path="/checkin" element={<CheckInSystem user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Profile Update Modal */}
        <ProfileUpdateModal
          user={user}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={handleProfileUpdated}
        />
        
        {/* Loading overlay */}
        {profileLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                <span>Loading profile...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;