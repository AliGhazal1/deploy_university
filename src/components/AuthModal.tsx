import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { apiClient } from '../lib/api'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onAuthed?: (email?: string | null) => void
  defaultToSignUp?: boolean
}

interface SignUpData {
  email: string
  password: string
  name: string
  role: string
  university: string
  degree?: string
  major?: string
  year_of_study?: number
  interests: string[]
  bio?: string
  availability: any
  free_time: any
  social_links: any
}

const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onAuthed, defaultToSignUp = false }) => {
  const [isSignUp, setIsSignUp] = useState(defaultToSignUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  
  // Profile data for signup
  const [signupData, setSignupData] = useState<SignUpData>({
    email: '',
    password: '',
    name: '',
    role: 'student',
    university: '',
    degree: '',
    major: '',
    year_of_study: 1,
    interests: [],
    bio: '',
    availability: {},
    free_time: {},
    social_links: {}
  })
  
  const [newInterest, setNewInterest] = useState('')

  useEffect(() => {
    if (!open) {
      setIsSignUp(defaultToSignUp)
      setEmail('')
      setPassword('')
      setError(null)
      setSuccess(null)
      setStep(1)
      setSignupData({
        email: '',
        password: '',
        name: '',
        role: 'student',
        university: '',
        degree: '',
        major: '',
        year_of_study: 1,
        interests: [],
        bio: '',
        availability: {},
        free_time: {},
        social_links: {}
      })
    } else {
      setIsSignUp(defaultToSignUp)
    }
  }, [open, defaultToSignUp])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      
      const { data } = await supabase.auth.getUser()
      onAuthed?.(data.user?.email)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUpStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setSignupData(prev => ({ ...prev, email, password }))
    setStep(2)
  }

  const handleSignUpComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Use our backend API for signup with profile data
      const response = await apiClient.signupWithProfile(signupData)
      
      if (response.token) {
        // Store token and user data
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
        onAuthed?.(response.user.email)
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const addInterest = () => {
    if (newInterest.trim() && !signupData.interests.includes(newInterest.trim())) {
      setSignupData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }))
      setNewInterest('')
    }
  }

  const removeInterest = (interest: string) => {
    setSignupData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">{isSignUp ? 'Create account' : 'Sign in'}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
        )}

        {!isSignUp ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="you@university.edu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Please wait…' : 'Sign in'}
            </button>
          </form>
        ) : step === 1 ? (
          <form onSubmit={handleSignUpStep1} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="you@university.edu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUpComplete} className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={signupData.name}
                  onChange={(e) => setSignupData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  required
                  value={signupData.role}
                  onChange={(e) => setSignupData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">University</label>
              <input
                type="text"
                required
                value={signupData.university}
                onChange={(e) => setSignupData(prev => ({ ...prev, university: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="University of Toronto"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Degree</label>
                <input
                  type="text"
                  value={signupData.degree || ''}
                  onChange={(e) => setSignupData(prev => ({ ...prev, degree: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Bachelor of Science"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Major</label>
                <input
                  type="text"
                  value={signupData.major || ''}
                  onChange={(e) => setSignupData(prev => ({ ...prev, major: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Computer Science"
                />
              </div>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Year of Study</label>
              <select
                value={signupData.year_of_study || 1}
                onChange={(e) => setSignupData(prev => ({ ...prev, year_of_study: parseInt(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
                <option value={5}>Graduate</option>
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Interests</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Add an interest"
                />
                <button
                  type="button"
                  onClick={addInterest}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {signupData.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                value={signupData.bio || ''}
                onChange={(e) => setSignupData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="mt-4 text-center text-sm">
            <button onClick={() => setIsSignUp(v => !v)} className="font-medium text-blue-600 hover:text-blue-800">
              {isSignUp ? 'Have an account? Sign in' : "New here? Create an account"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthModal
