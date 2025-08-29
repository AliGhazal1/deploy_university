import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Navigation from './components/Navigation';
import ProfileManager from './components/ProfileManager';
import EventManager from './components/EventManager';
import MarketplaceManager from './components/MarketplaceManager';
import MessagingSystem from './components/MessagingSystem';
import RewardSystem from './components/RewardSystem';
import CheckInSystem from './components/CheckInSystem';
import AdminCouponManager from './components/AdminCouponManager';
import ProfileUpdateModal from './components/ProfileUpdateModal';
import { supabase } from './lib/supabaseClient';
import { Calendar, ShoppingBag, Trophy, QrCode, MessageCircle, TrendingUp, Users, Star, Sparkles, Activity, Zap, Target } from 'lucide-react';

function HomePage({ user }: { user: User }) {
  const [stats, setStats] = useState({
    totalPoints: 0,
    eventsAttended: 0,
    itemsListed: 0,
    messagesCount: 0
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user.id]);

  const fetchDashboardData = async () => {
    try {
      // Fetch user stats using correct table names
      const [walletData, eventsData, userListingsData, messagesData] = await Promise.all([
        supabase.from('reward_wallets').select('points').eq('user_id', user.id).single(),
        supabase.from('checkins').select('*').eq('user_id', user.id),
        supabase.from('marketplace_listings').select('*').eq('seller_id', user.id),
        supabase.from('messages').select('*').eq('receiver_id', user.id)
      ]);

      const { data: allItems } = await supabase
        .from('marketplace_listings')
        .select('*');

      const totalMarketplaceCount = allItems?.length ?? 0;

      setStats({
        totalPoints: walletData.data?.points || 0,
        eventsAttended: eventsData.data?.length || 0,
        itemsListed: totalMarketplaceCount,
        messagesCount: messagesData.data?.length || 0
      });

      // Fetch recent events
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentEvents(events || []);

      // Fetch recent marketplace listings
      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentListings(listings || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          {/* Skeleton loader with dark theme */}
          <div className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-900/50 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Welcome Header with Animated Gradient */}
      <div className="relative overflow-hidden rounded-2xl glass p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-blue-600/20 to-cyan-600/20 animate-gradient"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-violet-400 animate-pulse-glow" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Welcome back, {user.email?.split('@')[0]}!
            </h1>
          </div>
          <p className="text-lg text-zinc-400">
            Your campus hub is ready. Let's make today amazing.
          </p>
        </div>
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-violet-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Stats Cards with Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass glass-hover rounded-xl p-6 gradient-border group">
          <div className="flex items-center justify-between mb-4">
            <Trophy className="h-10 w-10 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold text-white">{stats.totalPoints}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-2">Total Points</p>
          <Link to="/rewards" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 group">
            View Rewards 
            <Zap className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="glass glass-hover rounded-xl p-6 gradient-border group">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-10 w-10 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold text-white">{stats.eventsAttended}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-2">Events Attended</p>
          <Link to="/events" className="text-sm text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 group">
            Browse Events
            <Zap className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="glass glass-hover rounded-xl p-6 gradient-border group">
          <div className="flex items-center justify-between mb-4">
            <ShoppingBag className="h-10 w-10 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold text-white">{stats.itemsListed}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-2">Items Listed</p>
          <Link to="/marketplace" className="text-sm text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 group">
            View Market
            <Zap className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="glass glass-hover rounded-xl p-6 gradient-border group">
          <div className="flex items-center justify-between mb-4">
            <MessageCircle className="h-10 w-10 text-orange-400 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold text-white">{stats.messagesCount}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-2">Messages</p>
          <Link to="/messages" className="text-sm text-orange-400 hover:text-orange-300 font-medium inline-flex items-center gap-1 group">
            View Messages
            <Zap className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Quick Actions with Hover Effects */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Activity className="h-6 w-6 text-violet-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/check-in"
            className="group flex flex-col items-center p-6 bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 rounded-xl hover:from-indigo-500/20 hover:to-indigo-600/20 transition-all duration-300 border border-indigo-500/20"
          >
            <QrCode className="h-10 w-10 text-indigo-400 mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform" />
            <span className="text-sm font-medium text-zinc-300">Scan QR</span>
          </Link>
          <Link
            to="/events"
            className="group flex flex-col items-center p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl hover:from-blue-500/20 hover:to-blue-600/20 transition-all duration-300 border border-blue-500/20"
          >
            <Calendar className="h-10 w-10 text-blue-400 mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform" />
            <span className="text-sm font-medium text-zinc-300">Find Events</span>
          </Link>
          <Link
            to="/marketplace"
            className="group flex flex-col items-center p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl hover:from-purple-500/20 hover:to-purple-600/20 transition-all duration-300 border border-purple-500/20"
          >
            <ShoppingBag className="h-10 w-10 text-purple-400 mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform" />
            <span className="text-sm font-medium text-zinc-300">Sell Item</span>
          </Link>
          <Link
            to="/rewards"
            className="group flex flex-col items-center p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-xl hover:from-emerald-500/20 hover:to-emerald-600/20 transition-all duration-300 border border-emerald-500/20"
          >
            <Trophy className="h-10 w-10 text-emerald-400 mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform" />
            <span className="text-sm font-medium text-zinc-300">Get Rewards</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity with Modern Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Events */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Recent Events
            </h2>
            <Link to="/events" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-center p-4 bg-zinc-900/50 rounded-lg hover:bg-zinc-900/70 transition-colors group">
                  <div className="p-3 bg-blue-500/10 rounded-lg mr-4 group-hover:bg-blue-500/20 transition-colors">
                    <Calendar className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{event.title}</h3>
                    <p className="text-sm text-zinc-500">
                      {new Date(event.starts_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Target className="h-4 w-4 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-center py-8">No recent events</p>
            )}
          </div>
        </div>

        {/* Recent Marketplace */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Latest Marketplace
            </h2>
            <Link to="/marketplace" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentListings.length > 0 ? (
              recentListings.map((item) => (
                <div key={item.id} className="flex items-center p-4 bg-zinc-900/50 rounded-lg hover:bg-zinc-900/70 transition-colors group">
                  <div className="p-3 bg-purple-500/10 rounded-lg mr-4 group-hover:bg-purple-500/20 transition-colors">
                    <ShoppingBag className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{item.title}</h3>
                    <p className="text-sm text-emerald-400 font-semibold">${item.price}</p>
                  </div>
                  <Target className="h-4 w-4 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-center py-8">No recent listings</p>
            )}
          </div>
        </div>
      </div>

      {/* Campus Connect Features */}
      <div className="relative overflow-hidden glass rounded-2xl p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-blue-600/5 to-cyan-600/5"></div>
        <h2 className="text-2xl font-bold text-white mb-8 text-center">Explore Campus Connect</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="text-center group">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-10 w-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Connect</h3>
            <p className="text-zinc-400 text-sm">Build your campus network and make lasting friendships</p>
          </div>
          <div className="text-center group">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Earn Rewards</h3>
            <p className="text-zinc-400 text-sm">Participate in events and unlock exclusive campus perks</p>
          </div>
          <div className="text-center group">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="h-10 w-10 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Trade & Sell</h3>
            <p className="text-zinc-400 text-sm">Safe marketplace for students to buy and sell</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent({ user, showProfileModal, setShowProfileModal, handleProfileUpdated, profileLoading, setUser }: {
  user: User;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  handleProfileUpdated: () => void;
  profileLoading: boolean;
  setUser: (user: User | null) => void;
}) {
  const navigate = useNavigate();
  const [contactSellerInfo, setContactSellerInfo] = useState<{
    sellerId: string;
    sellerName: string;
    listingTitle: string;
  } | null>(null);

  const handleContactSeller = (sellerId: string, sellerName: string, listingTitle: string) => {
    setContactSellerInfo({ sellerId, sellerName, listingTitle });
    navigate('/messages');
  };

  const handleLogout = async () => {
    try {
      setContactSellerInfo(null);
      
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // The auth state change listener will handle setting user to null
    } catch (error) {
      console.error('Logout error:', error);
      // Force user state reset even if signOut fails
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <Navigation onLogout={handleLogout} />
      <main className="py-8 relative z-10">
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/profile" element={<ProfileManager user={user} />} />
          <Route path="/events" element={<EventManager user={user} />} />
          <Route path="/marketplace" element={<MarketplaceManager user={user} onContactSeller={handleContactSeller} />} />
          <Route path="/messages" element={<MessagingSystem user={user} contactSellerInfo={contactSellerInfo} onClearContactInfo={() => setContactSellerInfo(null)} />} />
          <Route path="/rewards/*" element={<RewardSystem user={user} />} />
          <Route path="/admin/coupons" element={<AdminCouponManager user={user} />} />
          <Route path="/check-in" element={<CheckInSystem user={user} />} />
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
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user);
      } else {
        setShowProfileModal(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (!user) {
    return <Auth onAuthChange={handleAuthChange} />;
  }

  return (
    <Router>
      <AppContent 
        user={user}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        handleProfileUpdated={handleProfileUpdated}
        profileLoading={profileLoading}
        setUser={setUser}
      />
    </Router>
  );
}

export default App;