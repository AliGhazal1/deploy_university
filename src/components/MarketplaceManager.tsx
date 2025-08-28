import { useState, useEffect } from 'react';
import { supabase, MarketplaceListing } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface MarketplaceManagerProps {
  user: User;
}

export default function MarketplaceManager({ user }: MarketplaceManagerProps) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price_cents: 0,
    category: 'product',
  });

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
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
      if (!Number.isFinite(formData.price_cents) || formData.price_cents < 0) throw new Error('Price must be >= 0');
      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert([{
          ...formData,
          user_id: user.id,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;

      setListings([data, ...listings]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        price_cents: 0,
        category: 'product',
      });
    } catch (error) {
      console.error('Error creating listing:', error);
      alert((error as Error).message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const markAsSold = async (listingId: string) => {
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .update({ status: 'sold', updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .select()
        .single();

      if (error) throw error;

      setListings(listings.map(listing => 
        listing.id === listingId ? data : listing
      ));
    } catch (error) {
      console.error('Error marking as sold:', error);
    }
  };

  const deleteListing = async (listingId: string) => {
    try {
      const { error } = await supabase
        .from('marketplace_listings')
        .delete()
        .eq('id', listingId);

      if (error) throw error;

      setListings(listings.filter(listing => listing.id !== listingId));
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Marketplace</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Listing'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Listing</h3>
          <form onSubmit={createListing} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="errand">Errand</option>
                <option value="job">Job</option>
                <option value="product">Product</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price_cents / 100}
                onChange={(e) => setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <div key={listing.id} className="relative bg-white shadow rounded-lg p-6">
            {listing.status === 'sold' && (
              <div className="absolute -top-2 -right-2 rotate-12">
                <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded shadow">SOLD</span>
              </div>
            )}
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-medium text-gray-900">{listing.title}</h3>
              <span className="text-lg font-bold text-green-600">
                {formatPrice(listing.price_cents)}
              </span>
            </div>
            {('category' in listing) && (
              <div className="mb-2">
                <span className="inline-block text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 capitalize">{(listing as any).category}</span>
              </div>
            )}
            
            {listing.description && (
              <p className="text-gray-600 mb-4">{listing.description}</p>
            )}
            
            <div className="text-sm text-gray-500 mb-4">
              <p>Listed on {new Date(listing.created_at).toLocaleDateString()}</p>
            </div>

            {listing.user_id === user.id ? (
              <div className="flex space-x-2">
                <button
                  onClick={() => markAsSold(listing.id)}
                  disabled={listing.status === 'sold'}
                  className={`flex-1 px-3 py-2 rounded-md text-sm ${listing.status === 'sold' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  {listing.status === 'sold' ? 'Already Sold' : 'Mark as Sold'}
                </button>
                <button
                  onClick={() => deleteListing(listing.id)}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                className={`w-full px-3 py-2 rounded-md text-sm ${listing.status === 'sold' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                disabled={listing.status === 'sold'}
              >
                {listing.status === 'sold' ? 'Sold' : 'Contact Seller'}
              </button>
            )}
          </div>
        ))}
      </div>

      {listings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No listings found. Create the first one!</p>
        </div>
      )}
    </div>
  );
}
