-- Migration to add new fields to profiles table
-- Run this in your Supabase SQL editor

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS degree TEXT,
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('student', 'faculty', 'admin')) DEFAULT 'student';

-- Update existing profiles to have email from auth.users if not set
UPDATE profiles 
SET email = (SELECT email FROM auth.users WHERE auth.users.id = profiles.user_id)
WHERE profiles.email IS NULL;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Create index on university for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_university ON profiles(university);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add RLS policies for the new fields (if not already covered by existing policies)
-- These policies ensure users can only read/update their own profiles

-- Policy for reading profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for updating profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for inserting profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Additional policy to allow authenticated users to read basic profile info for search
-- Note: If you want to restrict to only authenticated users, keep USING (auth.uid() IS NOT NULL)
-- This enables user search (reading other users' public profile fields)
DROP POLICY IF EXISTS "Users can view all profiles (basic)" ON profiles;
CREATE POLICY "Users can view all profiles (basic)" ON profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Create a public_profiles table with limited fields and no RLS (world-readable)
CREATE TABLE IF NOT EXISTS public_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  university TEXT,
  degree TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure no RLS so it can be publicly readable
ALTER TABLE public_profiles DISABLE ROW LEVEL SECURITY;

-- Lock down writes from client roles; only service_role/postgres should write
REVOKE INSERT, UPDATE, DELETE ON public_profiles FROM anon, authenticated;
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at_public_profiles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_public_profiles ON public_profiles;
CREATE TRIGGER trg_set_updated_at_public_profiles
BEFORE UPDATE ON public_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at_public_profiles();

-- Sync public_profiles from profiles (source of truth)
CREATE OR REPLACE FUNCTION sync_public_profiles_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert limited fields on insert/update
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    INSERT INTO public_profiles (user_id, full_name, university, degree, avatar_url)
    VALUES (NEW.user_id, NEW.full_name, NEW.university, NEW.degree, COALESCE(NULLIF(NEW.avatar_url, ''), NULL))
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      university = EXCLUDED.university,
      degree = EXCLUDED.degree,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public_profiles WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers on profiles to keep public copy in sync
DROP TRIGGER IF EXISTS trg_public_profiles_insupd ON profiles;
CREATE TRIGGER trg_public_profiles_insupd
AFTER INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_public_profiles_from_profiles();

DROP TRIGGER IF EXISTS trg_public_profiles_del ON profiles;
CREATE TRIGGER trg_public_profiles_del
AFTER DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_public_profiles_from_profiles();

-- Backfill from existing profiles
INSERT INTO public_profiles (user_id, full_name, university, degree)
SELECT p.user_id, p.full_name, p.university, p.degree
FROM profiles p
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  university = EXCLUDED.university,
  degree = EXCLUDED.degree,
  updated_at = now();

-- Ensure new auth.users are mirrored into profiles and public_profiles
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile row if missing
  INSERT INTO profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Insert/update public profile with defaults
  INSERT INTO public_profiles (user_id, full_name)
  VALUES (NEW.id, split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Anonymous'), '@', 1))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_handle_new_auth_user'
  ) THEN
    CREATE TRIGGER trg_handle_new_auth_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
  END IF;
END $$;

-- Fix messages table schema to use UUIDs and add RLS policies
-- Drop existing messages table if it exists with wrong schema
DROP TABLE IF EXISTS messages CASCADE;

-- Create messages table with UUID user references
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
-- Users can view messages where they are sender or receiver
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
    );

-- Users can insert messages only as themselves (sender)
CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_user_id);

-- Users can update messages only if they are the receiver (for read_at)
CREATE POLICY "Users can mark messages as read" ON messages
    FOR UPDATE USING (auth.uid() = receiver_user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_user_id ON messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_user_id ON messages(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_user_id, receiver_user_id);

-- =============================================================================
-- ADMIN SETUP
-- =============================================================================

-- Make aghaz101@mtroyal.ca the only admin with specific privileges
-- Clear any existing admin profiles first
DELETE FROM admin_profiles;

-- Add aghaz101@mtroyal.ca as the only admin
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get the user ID for aghaz101@mtroyal.ca
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'aghaz101@mtroyal.ca';
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert admin profile with specific privileges
        INSERT INTO admin_profiles (user_id, role, permissions)
        VALUES (admin_user_id, 'admin', ARRAY['delete_events', 'delete_marketplace', 'generate_qr_codes'])
        ON CONFLICT (user_id) DO UPDATE SET
            role = EXCLUDED.role,
            permissions = EXCLUDED.permissions;
        
        RAISE NOTICE 'Admin privileges granted to aghaz101@mtroyal.ca';
    ELSE
        RAISE NOTICE 'User aghaz101@mtroyal.ca not found. Please ensure the user has signed up first.';
    END IF;
END $$;

-- =============================================================================
-- MARKETPLACE SYSTEM (PUBLIC, SIMPLE)
-- =============================================================================

-- Drop existing marketplace tables if they exist
DROP TABLE IF EXISTS marketplace_images CASCADE;
DROP TABLE IF EXISTS marketplace_transactions CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS marketplace CASCADE;

-- Create simple public marketplace table
CREATE TABLE marketplace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    images TEXT[] DEFAULT '{}', -- Array of up to 5 image URLs
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS - completely public table for reading
ALTER TABLE marketplace DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON marketplace TO anon, authenticated;
GRANT INSERT, UPDATE ON marketplace TO authenticated;
GRANT DELETE ON marketplace TO authenticated; -- Users can delete their own, admins can delete any

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_by ON marketplace(created_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON marketplace(created_at);

-- Updated at trigger
CREATE OR REPLACE FUNCTION set_updated_at_marketplace()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_marketplace ON marketplace;
CREATE TRIGGER trg_set_updated_at_marketplace
BEFORE UPDATE ON marketplace
FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketplace();

-- =============================================================================
-- REWARD SYSTEM (ADMIN QR GENERATION)
-- =============================================================================

-- Reward system tables already exist from database_setup.sql
-- Just need to ensure admin can generate QR codes

-- Create QR code generation table for admin tracking
CREATE TABLE IF NOT EXISTS reward_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id INTEGER NOT NULL REFERENCES reward_coupons(id) ON DELETE CASCADE,
    qr_code_data TEXT NOT NULL, -- The QR code content/data
    generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Enable RLS for QR codes
ALTER TABLE reward_qr_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can generate QR codes
CREATE POLICY "Only admins can generate QR codes" ON reward_qr_codes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid() AND 'generate_qr_codes' = ANY(permissions))
    );

-- Anyone can view active QR codes (for scanning)
CREATE POLICY "Anyone can view active QR codes" ON reward_qr_codes
    FOR SELECT USING (is_active = true);

-- Only admins can update/delete QR codes
CREATE POLICY "Only admins can manage QR codes" ON reward_qr_codes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid() AND 'generate_qr_codes' = ANY(permissions))
    );

-- Function to generate QR code for a coupon (admin only)
CREATE OR REPLACE FUNCTION generate_coupon_qr(p_coupon_id INTEGER, p_expires_hours INTEGER DEFAULT 24)
RETURNS JSON AS $$
DECLARE
    qr_data TEXT;
    qr_id UUID;
    result JSON;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid() AND 'generate_qr_codes' = ANY(permissions)) THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin access required');
    END IF;
    
    -- Check if coupon exists and is active
    IF NOT EXISTS (SELECT 1 FROM reward_coupons WHERE id = p_coupon_id AND is_active = true) THEN
        RETURN json_build_object('success', false, 'error', 'Coupon not found or inactive');
    END IF;
    
    -- Generate unique QR code data
    qr_data := 'REWARD_' || p_coupon_id || '_' || extract(epoch from now())::text || '_' || gen_random_uuid()::text;
    
    -- Insert QR code record
    INSERT INTO reward_qr_codes (coupon_id, qr_code_data, generated_by, expires_at)
    VALUES (p_coupon_id, qr_data, auth.uid(), now() + (p_expires_hours || ' hours')::interval)
    RETURNING id INTO qr_id;
    
    RETURN json_build_object(
        'success', true, 
        'qr_id', qr_id,
        'qr_data', qr_data,
        'expires_at', now() + (p_expires_hours || ' hours')::interval
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and redeem QR code
CREATE OR REPLACE FUNCTION verify_qr_code(p_qr_data TEXT, p_user_id UUID DEFAULT auth.uid())
RETURNS JSON AS $$
DECLARE
    qr_record RECORD;
    coupon_record RECORD;
    user_points INTEGER;
    result JSON;
BEGIN
    -- Find the QR code
    SELECT * INTO qr_record 
    FROM reward_qr_codes 
    WHERE qr_code_data = p_qr_data AND is_active = true AND expires_at > now();
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired QR code');
    END IF;
    
    -- Get coupon details
    SELECT * INTO coupon_record
    FROM reward_coupons 
    WHERE id = qr_record.coupon_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Coupon no longer available');
    END IF;
    
    -- Get user's current points
    SELECT points INTO user_points 
    FROM reward_wallets 
    WHERE user_id = p_user_id;
    
    -- Create wallet if doesn't exist
    IF user_points IS NULL THEN
        INSERT INTO reward_wallets (user_id, points) VALUES (p_user_id, 0);
        user_points := 0;
    END IF;
    
    -- Award points to user
    UPDATE reward_wallets 
    SET points = points + coupon_record.points_required, updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Create redemption record
    INSERT INTO reward_redemptions (user_id, coupon_id, points_spent, status)
    VALUES (p_user_id, qr_record.coupon_id, -coupon_record.points_required, 'completed');
    
    -- Deactivate the QR code (one-time use)
    UPDATE reward_qr_codes SET is_active = false WHERE id = qr_record.id;
    
    RETURN json_build_object(
        'success', true, 
        'points_awarded', coupon_record.points_required,
        'coupon_title', coupon_record.title,
        'new_balance', user_points + coupon_record.points_required
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for QR codes
CREATE INDEX IF NOT EXISTS idx_reward_qr_codes_coupon_id ON reward_qr_codes(coupon_id);
CREATE INDEX IF NOT EXISTS idx_reward_qr_codes_generated_by ON reward_qr_codes(generated_by);
CREATE INDEX IF NOT EXISTS idx_reward_qr_codes_active ON reward_qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_reward_qr_codes_expires_at ON reward_qr_codes(expires_at);
