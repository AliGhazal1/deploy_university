import { useState, useEffect } from 'react';
import { supabase, Event, EventRSVP } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface EventManagerProps {
  user: User;
}

export default function EventManager({ user }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [userRSVPs, setUserRSVPs] = useState<EventRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  }, [user.id]);

  // No external location autocomplete; users can type the address manually.

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
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('organizer_user_id', user.id);
      if (error) throw error;
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
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Events</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Event'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Event</h3>
          <form onSubmit={createEvent} className="space-y-4">
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
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Capacity</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                min="1"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <div key={event.id} className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{event.title}</h3>
            {event.description && (
              <p className="text-gray-600 mb-3">{event.description}</p>
            )}
            
            <div className="space-y-2 text-sm text-gray-500 mb-4">
              {event.location && (
                <p><span className="font-medium">Location:</span> {event.location}</p>
              )}
              <p><span className="font-medium">Start:</span> {new Date(event.starts_at).toLocaleString()}</p>
              <p><span className="font-medium">End:</span> {new Date(event.ends_at).toLocaleString()}</p>
              {event.capacity && (
                <p><span className="font-medium">Capacity:</span> {event.capacity}</p>
              )}
            </div>

            <div className="flex justify-between items-center">
              {isUserRSVPed(event.id) ? (
                <button
                  onClick={() => cancelRSVP(event.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                >
                  Cancel RSVP
                </button>
              ) : (
                <button
                  onClick={() => rsvpToEvent(event.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                >
                  RSVP
                </button>
              )}
              
              {event.organizer_user_id === user.id && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-indigo-600 font-medium">Your Event</span>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-xs text-red-600 hover:text-red-700"
                    title="Delete event"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No events found. Create the first one!</p>
        </div>
      )}
    </div>
  );
}
