import { useState, useEffect } from 'react';
import { supabase, MarketplaceListing } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { ShoppingBag, Plus, X, MessageCircle, Trash2, Tag, Calendar, DollarSign } from 'lucide-react';

interface MarketplaceManagerProps {
  user: User;
  onContactSeller?: (sellerId: string, sellerName: string, listingTitle: string) => void;
}

export default function MarketplaceManager({ user, onContactSeller }: MarketplaceManagerProps) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    category: 'product',
  });

  useEffect(() => {
    fetchListings();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (!error) {
        setIsAdmin(data || false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const listingsData = data || [];
      setListings(listingsData);

      // Fetch seller names for all listings
      const sellerIds = [...new Set(listingsData.map(listing => listing.created_by))];
      const sellerNameMap: Record<string, string> = {};
      
      for (const sellerId of sellerIds) {
        try {
          const { data: profile } = await supabase
            .from('public_profiles')
            .select('full_name')
            .eq('user_id', sellerId)
            .single();
          
          sellerNameMap[sellerId] = profile?.full_name || 'Unknown User';
        } catch (error) {
          console.error('Error fetching seller name:', error);
          sellerNameMap[sellerId] = 'Unknown User';
        }
      }
      
      setSellerNames(sellerNameMap);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.category) throw new Error('Category is required');
      if (!Number.isFinite(formData.price) || formData.price < 0) throw new Error('Price must be >= 0');
      
      const { data, error } = await supabase
        .from('marketplace')
        .insert([{
          ...formData,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      setListings([data, ...listings]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        price: 0,
        category: 'product',
      });
    } catch (error) {
      console.error('Error creating listing:', error);
      alert((error as Error).message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const deleteListing = async (listingId: string) => {
    try {
      const { error } = await supabase
        .from('marketplace')
        .delete()
        .eq('id', listingId);

      if (error) throw error;

      setListings(listings.filter(listing => listing.id !== listingId));
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  const contactSeller = async (listing: MarketplaceListing) => {
    try {
      const { data: profile } = await supabase
        .from('public_profiles')
        .select('full_name')
        .eq('user_id', listing.created_by)
        .single();

      const sellerName = profile?.full_name || 'Unknown User';
      if (onContactSeller) {
        onContactSeller(listing.created_by, sellerName, listing.title);
      } else {
        // Fallback: navigate to messages page
        window.location.href = '/messages';
      }
    } catch (error) {
      console.error('Error fetching seller name:', error);
    }
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-emerald-400" />
            Campus Marketplace
          </h2>
          <p className="text-zinc-400 mt-2">Buy, sell, and trade with your campus community</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 font-semibold"
        >
          {showCreateForm ? (
            <>
              <X className="w-5 h-5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Create Listing
            </>
          )}
        </button>
      </div>

      {showCreateForm && (
        <div className="backdrop-blur-xl bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 mb-8 shadow-2xl">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-6">
            Create New Listing
          </h3>
          <form onSubmit={createListing} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="block w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  placeholder="What are you selling?"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="block w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  placeholder="Describe your item or service..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="block w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="errand" className="bg-zinc-900">Errand</option>
                  <option value="job" className="bg-zinc-900">Job</option>
                  <option value="product" className="bg-zinc-900">Product</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="block w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 font-semibold"
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <div 
            key={listing.id} 
            className="group relative backdrop-blur-xl bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 hover:bg-zinc-800/70 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1"
          >
            {/* Price Badge */}
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-lg shadow-lg">
              {formatPrice(listing.price)}
            </div>

            {/* Category Badge */}
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 capitalize font-medium border border-emerald-500/30">
                {listing.category}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-zinc-100 mb-3 group-hover:text-emerald-400 transition-colors">
              {listing.title}
            </h3>
            
            {/* Description */}
            {listing.description && (
              <p className="text-zinc-400 mb-4 text-sm line-clamp-3">
                {listing.description}
              </p>
            )}
            
            {/* Date and Seller */}
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
              <Calendar className="w-3 h-3" />
              <span>{new Date(listing.created_at).toLocaleDateString()}</span>
              {sellerNames[listing.created_by] && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400">{sellerNames[listing.created_by]}</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {(listing.created_by === user.id || isAdmin) && (
                <button
                  onClick={() => deleteListing(listing.id)}
                  className="w-full bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl hover:bg-red-500/30 text-sm transition-all duration-200 border border-red-500/30 hover:border-red-500/50 flex items-center justify-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {isAdmin && listing.created_by !== user.id ? 'Admin Delete' : 'Delete Listing'}
                </button>
              )}
              
              {listing.created_by !== user.id && !isAdmin && (
                <button
                  onClick={() => contactSeller(listing)}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2.5 rounded-xl hover:from-violet-600 hover:to-purple-600 text-sm transition-all duration-300 shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2 font-medium"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact Seller
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {listings.length === 0 && (
        <div className="text-center py-16 backdrop-blur-xl bg-zinc-800/30 rounded-2xl border border-zinc-700/50">
          <ShoppingBag className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg">No listings found</p>
          <p className="text-zinc-500 mt-2">Be the first to create a listing!</p>
        </div>
      )}
    </div>
  );
}
