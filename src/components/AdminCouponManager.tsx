import { useState, useEffect } from 'react';
import { supabase, RewardCoupon } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import CouponQR from './CouponQR';
import { Plus, QrCode, Power, Trash2, Tag, Store, Coins, Loader2, AlertCircle, X } from 'lucide-react';

interface AdminCouponManagerProps {
  user: User;
}

export default function AdminCouponManager({ user }: AdminCouponManagerProps) {
  const [coupons, setCoupons] = useState<RewardCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showQRFor, setShowQRFor] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vendor: '',
    points_required: 50,
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchCoupons();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .rpc('is_admin', { user_uuid: user.id });

      if (error) throw error;
      setIsAdmin(data || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title.trim()) throw new Error('Title is required');
      if (formData.points_required <= 0) throw new Error('Points required must be positive');

      const { data, error } = await supabase
        .from('reward_coupons')
        .insert([{
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          vendor: formData.vendor?.trim() || null,
          points_required: formData.points_required,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      setCoupons([data, ...coupons]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        vendor: '',
        points_required: 50,
      });
      
      // Auto-show QR for new coupon
      setShowQRFor(data.id);
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert((error as Error).message || 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('reward_coupons')
        .update({ is_active: !currentStatus })
        .eq('id', couponId);

      if (error) throw error;

      setCoupons(coupons.map(coupon => 
        coupon.id === couponId 
          ? { ...coupon, is_active: !currentStatus }
          : coupon
      ));
    } catch (error) {
      console.error('Error updating coupon status:', error);
    }
  };

  const deleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const { error } = await supabase
        .from('reward_coupons')
        .delete()
        .eq('id', couponId);

      if (error) throw error;
      setCoupons(coupons.filter(coupon => coupon.id !== couponId));
    } catch (error) {
      console.error('Error deleting coupon:', error);
    }
  };

  if (loading && coupons.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <span className="ml-2 text-gray-400">Loading coupons...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
            <Tag className="w-8 h-8 text-violet-400" />
            Coupon Management
          </h1>
          <p className="text-gray-400 mt-2">Create and manage reward coupons with QR codes</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg flex items-center gap-2 ${
            showCreateForm 
              ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 hover:shadow-red-500/25'
              : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 hover:shadow-violet-500/25'
          }`}
        >
          {showCreateForm ? (
            <>
              <X className="w-5 h-5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Create New Coupon
            </>
          )}
        </button>
      </div>

      {/* Create Coupon Form */}
      {showCreateForm && (
        <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-6">Create New Coupon</h2>
          <form onSubmit={createCoupon} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter coupon title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                rows={3}
                placeholder="Enter coupon description (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Vendor</label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter vendor name (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Points Required</label>
              <input
                type="number"
                value={formData.points_required}
                onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                min="1"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white py-3 px-4 rounded-xl hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-violet-500/25 transition-all duration-200"
            >
              {loading ? 'Creating...' : 'Create Coupon'}
            </button>
          </form>
        </div>
      )}

      {/* Coupons List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {coupons.map((coupon) => (
          <div key={coupon.id} className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-100">{coupon.title}</h3>
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                coupon.is_active 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {coupon.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            {coupon.description && (
              <p className="text-gray-400 mb-4 text-sm">{coupon.description}</p>
            )}
            
            <div className="space-y-2 text-sm mb-5">
              {coupon.vendor && (
                <p className="flex items-center gap-2 text-gray-400">
                  <Store className="w-4 h-4 text-cyan-400" />
                  <span>{coupon.vendor}</span>
                </p>
              )}
              <p className="flex items-center gap-2 text-gray-400">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span>{coupon.points_required} points required</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setShowQRFor(showQRFor === coupon.id ? null : coupon.id)}
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-3 py-2 rounded-lg hover:from-violet-600 hover:to-purple-600 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                {showQRFor === coupon.id ? 'Hide QR' : 'Generate QR'}
              </button>
              <button
                onClick={() => toggleCouponStatus(coupon.id, coupon.is_active)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  coupon.is_active
                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                }`}
              >
                <Power className="w-4 h-4" />
                {coupon.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => deleteCoupon(coupon.id)}
                className="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm hover:bg-red-500/30 border border-red-500/30 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>

            {showQRFor === coupon.id && (
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <CouponQR 
                  couponId={coupon.id}
                  couponTitle={coupon.title}
                  pointsRequired={coupon.points_required}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {coupons.length === 0 && (
        <div className="text-center py-12">
          <Tag className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No coupons found. Create the first one!</p>
        </div>
      )}
    </div>
  );
}
