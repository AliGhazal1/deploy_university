import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase, RewardWallet, RewardCoupon, RewardRedemption } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import WalletCard from './WalletCard';
import CouponCard from './CouponCard';
import RedemptionList from './RedemptionList';
import { Trophy, Wallet, ShoppingBag, Clock, CheckCircle, Gift, Sparkles, TrendingUp } from 'lucide-react';

interface RewardSystemProps {
  user: User;
}

function WalletPage({ wallet, loading }: { wallet: RewardWallet | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <WalletCard wallet={wallet} loading={loading} />
      
      <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          How to Earn Points
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full p-3 mr-4 flex-shrink-0 shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Event Check-ins</h4>
              <p className="text-sm text-gray-400">Earn 25 points per event</p>
            </div>
          </div>
          
          <div className="flex items-center p-4 bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-full p-3 mr-4 flex-shrink-0 shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Special Activities</h4>
              <p className="text-sm text-gray-400">Bonus points for participation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopPage({ 
  coupons, 
  wallet, 
  loading, 
  isAdmin
}: { 
  coupons: RewardCoupon[]; 
  wallet: RewardWallet | null; 
  loading: boolean;
  isAdmin: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6 animate-pulse">
            <div className="h-5 bg-gray-700 rounded-lg w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-700 rounded-lg w-1/2 mb-2"></div>
            <div className="h-20 bg-gray-700 rounded-lg mb-4"></div>
            <div className="h-10 bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl">
        <div className="mx-auto h-16 w-16 text-gray-500 mb-4">
          <Gift className="w-full h-full" />
        </div>
        <h3 className="text-xl font-semibold text-gray-200 mb-2">No coupons available</h3>
        <p className="text-gray-400">Check back later for new rewards!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map((coupon) => (
        <CouponCard
          key={coupon.id}
          coupon={coupon}
          userBalance={wallet?.points || 0}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}

export default function RewardSystem({ user }: RewardSystemProps) {
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [coupons, setCoupons] = useState<RewardCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string>('');
  const location = useLocation();

  useEffect(() => {
    fetchWallet();
    fetchCoupons();
    fetchRedemptions();
    checkAdminStatus();
  }, [user.id]);

  const fetchWallet = async () => {
    try {
      let { data, error } = await supabase
        .from('reward_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No wallet exists, create one
        const { data: newWallet, error: createError } = await supabase
          .from('reward_wallets')
          .insert([{
            user_id: user.id,
            points: 0,
          }])
          .select()
          .single();

        if (createError) throw createError;
        data = newWallet;
      } else if (error) {
        throw error;
      }

      setWallet(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
      setError('Failed to load wallet information');
    }
  };

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_coupons')
        .select('*')
        .eq('is_active', true)
        .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString())
        .order('points_required', { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      setError('Failed to load available coupons');
    }
  };

  const fetchRedemptions = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_redemptions')
        .select(`
          *,
          reward_coupons (
            title,
            vendor,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRedemptions(data || []);
    } catch (error) {
      console.error('Error fetching redemptions:', error);
      setError('Failed to load redemption history');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      setIsAdmin(data || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const redeemCoupon = async (coupon: RewardCoupon) => {
    if (!wallet || wallet.points < coupon.points_required) {
      setError('Insufficient points to redeem this coupon');
      return;
    }

    setError('');

    try {
      // Call the Supabase RPC function
      const { data, error } = await supabase.rpc('redeem_coupon', {
        p_user: user.id,
        p_coupon: coupon.id
      });

      if (error) throw error;

      // Refresh data after successful redemption
      await Promise.all([fetchWallet(), fetchRedemptions()]);
      
      // Show success message with redemption code
      if (data && data.redemption_code) {
        alert(`✅ Coupon redeemed successfully!\n\nYour redemption code is: ${data.redemption_code}\n\nSave this code to use your discount.`);
      } else {
        alert('✅ Coupon redeemed successfully!');
      }
    } catch (error: any) {
      console.error('Error redeeming coupon:', error);
      if (error.message?.includes('Insufficient points')) {
        setError('You don\'t have enough points to redeem this coupon');
      } else if (error.message?.includes('already redeemed')) {
        setError('You have already redeemed this coupon');
      } else {
        setError('Failed to redeem coupon. Please try again.');
      }
    }
  };

  const isActive = (path: string) => location.pathname === path || 
    (path === '/rewards' && location.pathname === '/rewards');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
          <Trophy className="w-8 h-8 text-violet-400" />
          Campus Rewards
        </h2>
        <div className="text-sm text-gray-400 bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-700/50">
          Welcome back, <span className="text-violet-400 font-medium">{user.email?.split('@')[0]}</span>!
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700/50 mb-8 overflow-x-auto">
        <nav className="-mb-px flex space-x-2 sm:space-x-4 min-w-max">
          <Link
            to="/rewards"
            className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
              isActive('/rewards')
                ? 'border-violet-400 text-violet-400 bg-violet-400/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800/30'
            } rounded-t-lg`}
          >
            <Wallet className="w-4 h-4" />
            Wallet
          </Link>
          <Link
            to="/rewards/shop"
            className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
              isActive('/rewards/shop')
                ? 'border-violet-400 text-violet-400 bg-violet-400/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800/30'
            } rounded-t-lg`}
          >
            <ShoppingBag className="w-4 h-4" />
            Shop
          </Link>
          <Link
            to="/rewards/history"
            className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
              isActive('/rewards/history')
                ? 'border-violet-400 text-violet-400 bg-violet-400/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800/30'
            } rounded-t-lg`}
          >
            <Clock className="w-4 h-4" />
            History
          </Link>
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/50 text-red-400 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Routes */}
      <Routes>
        <Route 
          path="/" 
          element={<WalletPage wallet={wallet} loading={loading} />} 
        />
        <Route 
          path="/shop" 
          element={
            <ShopPage 
              coupons={coupons} 
              wallet={wallet} 
              loading={loading}
              isAdmin={isAdmin}
            />
          } 
        />
        <Route 
          path="/history" 
          element={<RedemptionList redemptions={redemptions} loading={loading} />} 
        />
      </Routes>
    </div>
  );
}
