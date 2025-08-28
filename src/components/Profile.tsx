import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Edit3, LogOut, Trophy, Mail, Save, X, GraduationCap, Calendar, Heart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: string;
  university: string;
  degree?: string;
  major?: string;
  year_of_study?: number;
  interests: string[];
  bio?: string;
  points_balance: number;
  total_earned: number;
  created_at: string;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    university: '',
    degree: '',
    major: '',
    year_of_study: 1,
    bio: '',
    interests: [] as string[]
  });
  const [newInterest, setNewInterest] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user data from our backend API
      const userResponse = await apiClient.getCurrentUser();
      const profileResponse = await apiClient.getProfile();
      const rewardsResponse = await apiClient.getRewardBalance();

      const profileData: UserProfile = {
        id: userResponse.user.id,
        email: userResponse.user.email,
        name: userResponse.user.name,
        role: userResponse.user.role,
        university: userResponse.user.university,
        degree: profileResponse.profile?.degree,
        major: profileResponse.profile?.major,
        year_of_study: profileResponse.profile?.year_of_study,
        interests: profileResponse.profile?.interests || [],
        bio: profileResponse.profile?.bio,
        points_balance: rewardsResponse.points_balance || 0,
        total_earned: rewardsResponse.total_earned || 0,
        created_at: new Date().toISOString()
      };

      setProfile(profileData);
      setEditData({
        name: profileData.name,
        university: profileData.university,
        degree: profileData.degree || '',
        major: profileData.major || '',
        year_of_study: profileData.year_of_study || 1,
        bio: profileData.bio || '',
        interests: profileData.interests
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data.",
        variant: "destructive"
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile using our backend API
      await apiClient.updateProfile({
        degree: editData.degree,
        major: editData.major,
        year_of_study: editData.year_of_study,
        interests: editData.interests,
        bio: editData.bio
      });

      setProfile(prev => prev ? {
        ...prev,
        name: editData.name,
        university: editData.university,
        degree: editData.degree,
        major: editData.major,
        year_of_study: editData.year_of_study,
        interests: editData.interests,
        bio: editData.bio
      } : null);

      setEditing(false);

      toast({
        title: "Success!",
        description: "Your profile has been updated.",
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && !editData.interests.includes(newInterest.trim())) {
      setEditData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setEditData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      apiClient.clearToken();
      navigate('/survey');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Profile</h1>
          <p className="text-lg text-gray-600">
            Manage your account and view your achievements
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <User className="mr-2" size={24} />
                    Profile Information
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? (
                      <>
                        <X className="mr-2" size={16} />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit3 className="mr-2" size={16} />
                        Edit Profile
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-xl bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                    <p className="text-gray-600 flex items-center mt-1">
                      <GraduationCap size={16} className="mr-1" />
                      {profile.role} at {profile.university}
                    </p>
                    {profile.major && (
                      <p className="text-sm text-gray-500 mt-1">
                        {profile.major} {profile.degree && `- ${profile.degree}`}
                      </p>
                    )}
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <Input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        University
                      </label>
                      <Input
                        type="text"
                        value={editData.university}
                        onChange={(e) => setEditData({ ...editData, university: e.target.value })}
                        placeholder="Enter your university"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Degree
                      </label>
                      <Input
                        type="text"
                        value={editData.degree}
                        onChange={(e) => setEditData({ ...editData, degree: e.target.value })}
                        placeholder="Bachelor of Science"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Major
                      </label>
                      <Input
                        type="text"
                        value={editData.major}
                        onChange={(e) => setEditData({ ...editData, major: e.target.value })}
                        placeholder="Computer Science"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year of Study
                      </label>
                      <select
                        value={editData.year_of_study}
                        onChange={(e) => setEditData({ ...editData, year_of_study: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                        <option value={5}>Graduate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Interests
                      </label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                          placeholder="Add an interest"
                          className="flex-1"
                        />
                        <Button type="button" onClick={addInterest} variant="outline" size="sm">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editData.interests.map((interest, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {interest}
                            <button
                              type="button"
                              onClick={() => removeInterest(interest)}
                              className="text-blue-600 hover:text-blue-800 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={editData.bio}
                        onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button onClick={handleSave} disabled={loading} className="flex-1">
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                          <Save className="mr-2" size={16} />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Full Name</div>
                        <div className="font-medium">{profile.name}</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Role</div>
                        <div className="font-medium capitalize">{profile.role}</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">University</div>
                        <div className="font-medium">{profile.university}</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1 flex items-center">
                          <Mail size={14} className="mr-1" />
                          Email
                        </div>
                        <div className="font-medium">{profile.email}</div>
                      </div>
                      {profile.degree && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-500 mb-1 flex items-center">
                            <GraduationCap size={14} className="mr-1" />
                            Degree
                          </div>
                          <div className="font-medium">{profile.degree}</div>
                        </div>
                      )}
                      {profile.major && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-500 mb-1">Major</div>
                          <div className="font-medium">{profile.major}</div>
                        </div>
                      )}
                      {profile.year_of_study && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-500 mb-1 flex items-center">
                            <Calendar size={14} className="mr-1" />
                            Year of Study
                          </div>
                          <div className="font-medium">
                            {profile.year_of_study === 5 ? 'Graduate' : `${profile.year_of_study}${profile.year_of_study === 1 ? 'st' : profile.year_of_study === 2 ? 'nd' : profile.year_of_study === 3 ? 'rd' : 'th'} Year`}
                          </div>
                        </div>
                      )}
                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
                        <div className="text-sm text-yellow-700 mb-1 flex items-center">
                          <Trophy size={14} className="mr-1" />
                          Points Balance
                        </div>
                        <div className="font-bold text-2xl text-yellow-800">{profile.points_balance}</div>
                      </div>
                    </div>
                    
                    {profile.interests.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 mb-2 flex items-center">
                          <Heart size={14} className="mr-1" />
                          Interests
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.interests.map((interest, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {profile.bio && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-2">Bio</div>
                        <div className="text-gray-700">{profile.bio}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="mr-2 text-yellow-500" size={24} />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{profile.points_balance}</div>
                  <div className="text-sm text-blue-700">Current Balance</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-2">{profile.total_earned}</div>
                  <div className="text-sm text-green-700">Total Earned</div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Power Hour Participant</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Earned
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Social Connector</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      In Progress
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Marketplace Pro</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      Locked
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <User className="mr-2" size={16} />
                  Privacy Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Trophy className="mr-2" size={16} />
                  View Leaderboard
                </Button>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2" size={16} />
                    Sign Out
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
