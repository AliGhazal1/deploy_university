import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Meetup {
  id: string;
  title: string;
  date_time: string;
  location: string;
  created_by: string;
  created_at: string;
  profiles: {
    username: string;
    university: string;
  };
}

const locations = [
  'TFDL',
  'MacEwan',
  'Riddell Library',
  'Wyckham House',
  'RGO Library',
  'LeFort Centre'
];

const ScheduleLater: React.FC = () => {
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date_time: '',
    location: ''
  });

  useEffect(() => {
    fetchMeetups();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('meetups_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'meetups' },
        () => fetchMeetups()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchMeetups = async () => {
    try {
      const { data, error } = await supabase
        .from('meetups')
        .select(`
          id,
          title,
          date_time,
          location,
          created_by,
          created_at,
          profiles!inner(username, university)
        `)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;
      setMeetups(data || []);
    } catch (error) {
      console.error('Error fetching meetups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('meetups')
        .insert({
          title: formData.title,
          date_time: formData.date_time,
          location: formData.location,
          created_by: user.id
        });

      if (error) throw error;

      setFormData({ title: '', date_time: '', location: '' });
      setShowForm(false);
      fetchMeetups();
    } catch (error) {
      console.error('Error creating meetup:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    };
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // Minimum 30 minutes from now
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Schedule Later</h1>
          <p className="text-lg text-gray-600 mb-8">
            Plan study sessions and meetups in advance
          </p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={() => setShowForm(!showForm)}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              <Plus className="mr-2" size={20} />
              Create Meetup
            </Button>
          </motion.div>
        </motion.div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Create New Meetup</CardTitle>
                <CardDescription>
                  Schedule a study session or meetup with fellow students
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <Input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., CPSC 331 Study Group"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date & Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.date_time}
                      onChange={(e) => setFormData({ ...formData, date_time: e.target.value })}
                      min={getMinDateTime()}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : null}
                      Create Meetup
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2" size={24} />
            Upcoming Meetups ({meetups.length})
          </h2>
        </div>

        {meetups.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
              <CardTitle className="text-xl text-gray-600 mb-2">
                No upcoming meetups
              </CardTitle>
              <CardDescription>
                Be the first to schedule a study session!
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {meetups.map((meetup, index) => {
              const { date, time } = formatDateTime(meetup.date_time);
              return (
                <motion.div
                  key={meetup.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{meetup.title}</CardTitle>
                      <CardDescription>
                        Organized by {meetup.profiles.username}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock size={16} className="mr-2" />
                        {date} at {time}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin size={16} className="mr-2" />
                        {meetup.location}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users size={16} className="mr-2" />
                        {meetup.profiles.university}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4">
                        Join Meetup
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleLater;
