import { useState } from 'react';
import { supabase, Profile } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { X, User as UserIcon, GraduationCap, Building2, BookOpen, Calendar, FileText } from 'lucide-react';

interface ProfileUpdateModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (profile: Profile) => void;
}

export default function ProfileUpdateModal({ user, isOpen, onClose, onProfileUpdated }: ProfileUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    email: user.email || '',
    degree: '',
    major: '',
    graduation_year: new Date().getFullYear(),
    university: '',
    role: 'student' as 'student' | 'faculty' | 'admin',
    bio: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upsert by user_id to avoid duplicates and update existing rows
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: formData.email,
            full_name: formData.full_name,
            degree: formData.degree,
            major: formData.major,
            graduation_year: formData.graduation_year,
            university: formData.university,
            role: formData.role,
            bio: formData.bio,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;

      onProfileUpdated(data);
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <UserIcon className="w-6 h-6 md:w-8 md:h-8 text-violet-400" />
              Complete Your Profile
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors duration-200"
              disabled={loading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-gray-400 mb-6">
            Please complete your profile to get the most out of Campus Connect. This information helps us connect you with the right people and opportunities.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  University *
                </label>
                <input
                  type="text"
                  value={formData.university}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., University of California, Berkeley"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'student' | 'faculty' | 'admin' })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 cursor-pointer"
                  required
                >
                  <option value="student" className="bg-gray-800">Student</option>
                  <option value="faculty" className="bg-gray-800">Faculty</option>
                  <option value="admin" className="bg-gray-800">Admin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  Degree *
                </label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., Bachelor's, Master's, PhD"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  Major/Field of Study
                </label>
                <input
                  type="text"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., Computer Science, Biology"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-yellow-400" />
                Graduation Year *
              </label>
              <input
                type="number"
                value={formData.graduation_year}
                onChange={(e) => setFormData({ ...formData, graduation_year: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                min="2020"
                max="2035"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Tell us a bit about yourself, your interests, and what you're looking for on campus..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 text-gray-300 bg-gray-700 rounded-xl hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 border border-gray-600"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-violet-500/25 transition-all duration-200"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
