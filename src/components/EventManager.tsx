import { useState, useEffect } from 'react';
import { supabase, Event, EventRSVP } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import EventQR from './EventQR';
import { Calendar, MapPin, Users, Clock, Trash2, QrCode, Plus, X, Sparkles, Star, CheckCircle } from 'lucide-react';

interface EventManagerProps {
  user: User;
}

export default function EventManager({ user }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [userRSVPs, setUserRSVPs] = useState<EventRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showQRFor, setShowQRFor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    starts_at: '',
    ends_at: '',
    capacity: 50,
  });

  useEffect(() => {
    fetchEvents();
    fetchUserRSVPs();
    checkAdminStatus();
  }, [user.id]);

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

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gt('ends_at', new Date().toISOString()) // hide expired client-side
        .order('starts_at', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      if (isAdmin) {
        // Admin can delete any event
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);
        if (error) throw error;
      } else {
        // Regular users can only delete their own events
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('organizer_user_id', user.id);
        if (error) throw error;
      }
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const fetchUserRSVPs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setUserRSVPs(data || []);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Basic validation
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.starts_at || !formData.ends_at) throw new Error('Start and end times are required');

      const startsISO = new Date(formData.starts_at).toISOString();
      const endsISO = new Date(formData.ends_at).toISOString();
      if (new Date(endsISO) <= new Date(startsISO)) throw new Error('End time must be after start time');

      const { data, error } = await supabase
        .from('events')
        .insert([{
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          location: formData.location?.trim() || null,
          starts_at: startsISO,
          ends_at: endsISO,
          capacity: formData.capacity || null,
          organizer_user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      setEvents([...events, data]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        location: '',
        starts_at: '',
        ends_at: '',
        capacity: 50,
      });
      
      // Automatically show QR code for the newly created event
      setShowQRFor(data.id);
    } catch (error) {
      console.error('Error creating event:', error);
      alert((error as Error).message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const rsvpToEvent = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .insert([{
          event_id: eventId,
          user_id: user.id,
          status: 'confirmed',
        }])
        .select()
        .single();

      if (error) throw error;
      setUserRSVPs([...userRSVPs, data]);
    } catch (error) {
      console.error('Error RSVPing to event:', error);
    }
  };

  const cancelRSVP = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) throw error;
      setUserRSVPs(userRSVPs.filter(rsvp => rsvp.event_id !== eventId));
    } catch (error) {
      console.error('Error canceling RSVP:', error);
    }
  };

  const isUserRSVPed = (eventId: string) => {
    return userRSVPs.some(rsvp => rsvp.event_id === eventId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-violet-400" />
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            Campus Events
          </h2>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="group w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-600 hover:to-blue-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
        >
          {showCreateForm ? (
            <>
              <X className="h-5 w-5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              Create Event
              <Sparkles className="h-4 w-4 animate-pulse-glow" />
            </>
          )}
        </button>
      </div>

      {showCreateForm && (
        <div className="glass rounded-2xl p-6 mb-8 gradient-border">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            Create New Event
          </h3>
          <form onSubmit={createEvent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  placeholder="Enter event title"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  rows={3}
                  placeholder="Describe your event"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  placeholder="Enter address or location name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Start Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">End Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 glass text-zinc-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white rounded-lg hover:from-violet-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => {
          const isRSVPed = isUserRSVPed(event.id);
          const isOrganizer = event.organizer_user_id === user.id;
          const eventDate = new Date(event.starts_at);
          const isPast = eventDate < new Date();
          
          return (
            <div
              key={event.id}
              className={`glass rounded-xl overflow-hidden group hover:scale-105 transition-all duration-300 ${
                isPast ? 'opacity-60' : ''
              } ${isRSVPed ? 'gradient-border' : ''}`}
            >
              {/* Event Header with gradient */}
              <div className="relative h-32 bg-gradient-to-br from-violet-600/20 to-blue-600/20 p-4">
                <div className="absolute top-3 right-3 flex gap-2">
                  {isRSVPed && (
                    <div className="px-2 py-1 bg-emerald-500/20 backdrop-blur-sm rounded-full">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                  )}
                  {isOrganizer && (
                    <div className="px-2 py-1 bg-violet-500/20 backdrop-blur-sm rounded-full">
                      <Star className="h-4 w-4 text-violet-400" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 pr-16">{event.title}</h3>
                <div className="flex items-center gap-2 text-zinc-300 text-sm">
                  <Calendar className="h-4 w-4" />
                  {eventDate.toLocaleDateString()}
                </div>
              </div>

              {/* Event Details */}
              <div className="p-4 space-y-3">
                <p className="text-zinc-400 text-sm line-clamp-2">{event.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm">
                    <Clock className="h-4 w-4 text-blue-400" />
                    {new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-zinc-300 text-sm">
                      <MapPin className="h-4 w-4 text-red-400" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {event.capacity && (
                    <div className="flex items-center gap-2 text-zinc-300 text-sm">
                      <Users className="h-4 w-4 text-green-400" />
                      Capacity: {event.capacity}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3">
                  {!isPast && (
                    <>
                      {isRSVPed ? (
                        <button
                          onClick={() => cancelRSVP(event.id)}
                          className="flex-1 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium"
                        >
                          Cancel RSVP
                        </button>
                      ) : (
                        <button
                          onClick={() => rsvpToEvent(event.id)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 rounded-lg hover:from-emerald-500/30 hover:to-green-500/30 transition-all text-sm font-medium"
                        >
                          RSVP
                        </button>
                      )}
                    </>
                  )}
                  
                  {(isOrganizer || isAdmin) && (
                    <>
                      <button
                        onClick={() => setShowQRFor(showQRFor === event.id ? null : event.id)}
                        className="p-2 glass text-violet-400 rounded-lg hover:bg-violet-500/10 transition-all"
                        title="Show QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="p-2 glass text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                        title="Delete Event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* QR Code Display */}
                {showQRFor === event.id && (
                  <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg">
                    <EventQR eventId={event.id} eventTitle={event.title} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-xl text-zinc-400">No upcoming events</p>
          <p className="text-zinc-500 mt-2">Create the first event to get started!</p>
        </div>
      )}
    </div>
  );
}
