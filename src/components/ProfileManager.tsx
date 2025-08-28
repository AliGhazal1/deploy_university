import { useState, useEffect } from 'react';
import { supabase, Profile } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface ProfileManagerProps {
  user: User;
}

export default function ProfileManager({ user }: ProfileManagerProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    bio: '',
    degree: '',
    major: '',
    graduation_year: new Date().getFullYear(),
    university: '',
    role: 'student' as 'student' | 'faculty' | 'admin',
  });

  useEffect(() => {
    fetchProfile();
  }, [user.id]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          bio: data.bio || '',
          degree: data.degree || '',
          major: data.major || '',
          graduation_year: data.graduation_year || new Date().getFullYear(),
          university: data.university || '',
          role: data.role || 'student',
        });
      } else {
        // No profile exists, create one
        await createProfile();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    try {
      const newProfile = {
        user_id: user.id,
        email: user.email || '',
        full_name: user.email?.split('@')[0] || '',
        bio: '',
        degree: '',
        major: '',
        graduation_year: new Date().getFullYear(),
        university: '',
        role: 'student' as 'student' | 'faculty' | 'admin',
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        full_name: data.full_name,
        email: data.email || user.email || '',
        bio: data.bio || '',
        degree: data.degree || '',
        major: data.major || '',
        graduation_year: data.graduation_year || new Date().getFullYear(),
        university: data.university || '',
        role: data.role || 'student',
      });
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: formData.email,
            full_name: formData.full_name,
            bio: formData.bio,
            degree: formData.degree,
            major: formData.major,
            graduation_year: formData.graduation_year,
            university: formData.university,
            role: formData.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
          <button
            onClick={() => setEditing(!editing)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={updateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">University</label>
                <input
                  type="text"
                  value={formData.university}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'student' | 'faculty' | 'admin' })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Degree</label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Major</label>
                <input
                  type="text"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Graduation Year</label>
              <input
                type="number"
                value={formData.graduation_year}
                onChange={(e) => setFormData({ ...formData, graduation_year: parseInt(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                min="2020"
                max="2035"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{profile?.full_name}</h3>
              <p className="text-gray-600">{profile?.email || user.email}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile?.university && (
                <div>
                  <span className="text-sm font-medium text-gray-700">University: </span>
                  <span className="text-gray-900">{profile.university}</span>
                </div>
              )}

              {profile?.role && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Role: </span>
                  <span className="text-gray-900 capitalize">{profile.role}</span>
                </div>
              )}

              {profile?.degree && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Degree: </span>
                  <span className="text-gray-900">{profile.degree}</span>
                </div>
              )}

              {profile?.major && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Major: </span>
                  <span className="text-gray-900">{profile.major}</span>
                </div>
              )}

              {profile?.graduation_year && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Graduation Year: </span>
                  <span className="text-gray-900">{profile.graduation_year}</span>
                </div>
              )}
            </div>

            {profile?.bio && (
              <div>
                <span className="text-sm font-medium text-gray-700">Bio: </span>
                <p className="text-gray-900 mt-1">{profile.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
