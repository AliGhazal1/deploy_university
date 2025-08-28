import { useState, useEffect } from 'react';
import { supabase, RewardWallet, RewardCoupon, RewardRedemption } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface RewardSystemProps {
  user: User;
}

export default function RewardSystem({ user }: RewardSystemProps) {
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [coupons, setCoupons] = useState<RewardCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
    fetchCoupons();
    fetchRedemptions();
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
            points_balance: 0,
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
    }
  };

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_coupons')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const redeemCoupon = async (coupon: RewardCoupon) => {
    if (!wallet || wallet.points_balance < coupon.points_required) {
      alert('Insufficient points!');
      return;
    }

    try {
      // Generate redemption code
      const redemptionCode = Math.random().toString(36).substring(2, 15).toUpperCase();

      // Create redemption record
      const { data: redemption, error: redemptionError } = await supabase
        .from('reward_redemptions')
        .insert([{
          user_id: user.id,
          coupon_id: coupon.id,
          redemption_code: redemptionCode,
          points_spent: coupon.points_required,
        }])
        .select()
        .single();

      if (redemptionError) throw redemptionError;

      // Update wallet balance
      const { data: updatedWallet, error: walletError } = await supabase
        .from('reward_wallets')
        .update({
          points_balance: wallet.points_balance - coupon.points_required,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (walletError) throw walletError;

      setWallet(updatedWallet);
      setRedemptions([redemption, ...redemptions]);
      
      alert(`Coupon redeemed successfully! Your redemption code is: ${redemptionCode}`);
    } catch (error) {
      console.error('Error redeeming coupon:', error);
      alert('Failed to redeem coupon. Please try again.');
    }
  };

  const formatDiscount = (coupon: RewardCoupon) => {
    if (coupon.discount_percentage) {
      return `${coupon.discount_percentage}% off`;
    } else if (coupon.discount_amount) {
      return `$${(coupon.discount_amount / 100).toFixed(2)} off`;
    }
    return 'Special offer';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Rewards</h2>
        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg">
          <span className="font-medium">Points Balance: {wallet?.points_balance || 0}</span>
        </div>
      </div>

      {/* Available Coupons */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Coupons</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="bg-white shadow rounded-lg p-6 border-l-4 border-indigo-500">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-lg font-medium text-gray-900">{coupon.title}</h4>
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                  {formatDiscount(coupon)}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Vendor:</span> {coupon.vendor}
              </p>
              
              {coupon.description && (
                <p className="text-gray-600 mb-4">{coupon.description}</p>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-indigo-600">
                  {coupon.points_required} points
                </span>
                
                <button
                  onClick={() => redeemCoupon(coupon)}
                  disabled={!wallet || wallet.points_balance < coupon.points_required}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Redeem
                </button>
              </div>
              
              {coupon.expiry_date && (
                <p className="text-xs text-gray-500 mt-2">
                  Expires: {new Date(coupon.expiry_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
        
        {coupons.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No coupons available at the moment.</p>
          </div>
        )}
      </div>

      {/* Redemption History */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Redemption History</h3>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {redemptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No redemptions yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {(redemption as any).reward_coupons?.title || 'Unknown Coupon'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Vendor: {(redemption as any).reward_coupons?.vendor || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Redeemed on {new Date(redemption.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm font-mono">
                        {redemption.redemption_code}
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        -{redemption.points_spent} points
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
