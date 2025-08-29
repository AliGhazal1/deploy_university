import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Home, Calendar, ShoppingBag, MessageCircle, Trophy, User, LogOut, QrCode, Menu, X, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AnimeNavBar } from './ui/anime-navbar';

interface NavigationProps {
  onLogout: () => void;
}

export default function Navigation({ onLogout }: NavigationProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Profile', url: '/profile', icon: User },
    { name: 'Events', url: '/events', icon: Calendar },
    { name: 'Marketplace', url: '/marketplace', icon: ShoppingBag },
    { name: 'Messages', url: '/messages', icon: MessageCircle },
    { name: 'Rewards', url: '/rewards', icon: Trophy },
    { name: 'Check-In', url: '/check-in', icon: QrCode },
  ];

  // Get current active tab based on location
  const getCurrentTab = () => {
    const currentItem = navItems.find(item => item.url === location.pathname);
    return currentItem ? currentItem.name : 'Home';
  };

  return (
    <>
      {/* Anime Navigation Bar */}
      <AnimeNavBar 
        items={navItems}
        defaultActive={getCurrentTab()}
      />

      {/* Logo and Logout - positioned separately with glassmorphism */}
      <div className="fixed top-3 left-3 md:left-5 z-[9998]">
        <Link to="/" className="group flex items-center space-x-2 glass px-3 py-1.5 rounded-full hover:scale-105 transition-all duration-300">
          <div className="relative">
            <Sparkles className="absolute -top-1 -right-1 h-2 w-2 text-violet-400 animate-pulse-glow" />
            <img 
              src="/University-connect-logo.png" 
              alt="University Connect" 
              className="h-6 w-auto group-hover:scale-110 transition-transform"
            />
          </div>
          <h1 className="hidden sm:block text-sm font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            Campus Connect
          </h1>
        </Link>
      </div>

      <div className="fixed top-3 right-3 md:right-5 z-[9998]">
        <button
          onClick={handleLogout}
          className="group inline-flex items-center px-3 py-1.5 glass text-zinc-300 hover:text-white text-xs font-medium rounded-full transition-all duration-300 hover:scale-105 gradient-border"
        >
          <LogOut size={14} className="mr-1.5 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* Mobile menu fallback for very small screens */}
      <div className="sm:hidden fixed bottom-4 right-4 z-[9997]">
        <div className="flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center p-3 rounded-full glass text-zinc-300 hover:text-white focus:outline-none hover:scale-110 transition-all shadow-lg"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu with glassmorphism */}
        {mobileMenuOpen && (
          <div className="absolute bottom-16 right-0 glass rounded-2xl shadow-2xl z-50 min-w-[200px]">
            <div className="px-4 py-3 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-white'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon size={16} className="mr-3" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full text-left block px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
              >
                <div className="flex items-center">
                  <LogOut size={16} className="mr-3" />
                  Logout
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
