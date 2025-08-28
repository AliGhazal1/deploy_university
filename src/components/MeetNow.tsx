import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface PresenceUser {
  id: string;
  username: string;
  university: string;
  created_at: string;
  expires_at: string;
}

const MeetNow: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveUsers();
    checkUserPresence();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('presence_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'presence' },
        () => fetchActiveUsers()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchActiveUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('presence')
        .select(`
          id,
          user_id,
          expires_at,
          created_at,
          profiles!inner(username, university)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const users = data?.map(item => ({
        id: item.user_id,
        username: item.profiles.username || 'Anonymous',
        university: item.profiles.university || 'Unknown University',
        created_at: item.created_at,
        expires_at: item.expires_at
      })) || [];

      setActiveUsers(users);
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  };

  const checkUserPresence = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('presence')
        .select('expires_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .single();

      setIsActive(!!data && !error);
    } catch (error) {
      setIsActive(false);
    }
  };

  const togglePresence = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isActive) {
        // Remove presence
        await supabase
          .from('presence')
          .delete()
          .eq('user_id', user.id);
        setIsActive(false);
      } else {
        // Add presence (expires in 30 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        await supabase
          .from('presence')
          .upsert({
            user_id: user.id,
            expires_at: expiresAt.toISOString()
          });
        setIsActive(true);
      }

      fetchActiveUsers();
    } catch (error) {
      console.error('Error toggling presence:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Meet Now</h1>
          <p className="text-lg text-gray-600 mb-8">
            Connect with students who are free right now
          </p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={togglePresence}
              disabled={loading}
              size="lg"
              className={`px-8 py-3 text-lg ${
                isActive 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              ) : (
                <Users className="mr-2" size={20} />
              )}
              {isActive ? "I'm Busy Now" : "I'm Free Now"}
            </Button>
          </motion.div>

          {isActive && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-green-600 mt-2"
            >
              ✅ You're visible to other students for the next 30 minutes
            </motion.p>
          )}
        </motion.div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2" size={24} />
            Students Available Now ({activeUsers.length})
          </h2>
        </div>

        {activeUsers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users size={48} className="mx-auto text-gray-400 mb-4" />
              <CardTitle className="text-xl text-gray-600 mb-2">
                No students are free right now
              </CardTitle>
              <CardDescription>
                Be the first to let others know you're available!
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -2 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{user.username}</CardTitle>
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin size={14} className="mr-1" />
                          {user.university}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <Clock size={14} className="mr-1" />
                      Available since {formatTimeAgo(user.created_at)}
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      Send Message
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetNow;
