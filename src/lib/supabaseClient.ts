import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY  as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'university-connect-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: true
  }
})

export { supabaseUrl }

// Database types
export interface Profile {
  id: string
  user_id: string
  email: string
  full_name: string
  bio?: string
  degree?: string
  major?: string
  graduation_year?: number
  university?: string
  role?: 'student' | 'faculty' | 'admin'
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  organizer_user_id: string
  title: string
  description?: string
  location?: string
  starts_at: string
  ends_at: string
  capacity?: number
  created_at: string
  updated_at: string
}

export interface EventRSVP {
  id: string
  event_id: string
  user_id: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
}

export interface MarketplaceListing {
  id: string // UUID
  created_by: string // UUID reference to auth.users
  title: string
  description?: string
  category: string
  price: number // Decimal, not cents
  images: string[] // Array of image URLs
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  sender_user_id: string
  receiver_user_id: string
  body: string
  read_at?: string
  created_at: string
}

export interface RewardWallet {
  user_id: string
  points: number
  updated_at: string
}

export interface RewardCoupon {
  id: string
  title: string
  vendor: string
  description?: string
  discount_percentage?: number
  discount_amount?: number
  points_required: number
  expiry_date?: string
  is_active: boolean
  created_at: string
}

export interface RewardRedemption {
  id: string
  user_id: string
  coupon_id: string
  redemption_code: string
  points_spent: number
  created_at: string
}

export interface CheckIn {
  id: string
  user_id: string
  event_id: string
  points_awarded: number
  created_at: string
}

export interface AdminProfile {
  id: string
  user_id: string
  role: string
  permissions: string[]
  created_at: string
}
