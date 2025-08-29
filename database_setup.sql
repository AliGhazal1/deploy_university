-- Create reward system tables for Supabase (matching existing schema)

-- 1. Reward Wallets Table (using existing 'rewards' structure)
CREATE TABLE IF NOT EXISTS reward_wallets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Reward Coupons Table (using existing 'coupons' structure)
CREATE TABLE IF NOT EXISTS reward_coupons (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vendor VARCHAR(255),
    points_required INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Reward Redemptions Table (using existing 'coupon_redemptions' structure)
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coupon_id INTEGER NOT NULL REFERENCES reward_coupons(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Event RSVPs Table (matching existing events table with INTEGER id)
CREATE TABLE IF NOT EXISTS event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- 5. Update existing checkins table to match expected structure
-- First, check if checkins table exists and modify it
DO $$
BEGIN
    -- Add points_awarded column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'checkins' AND column_name = 'points_awarded') THEN
        ALTER TABLE checkins ADD COLUMN points_awarded INTEGER DEFAULT 25;
    END IF;
    
    -- Ensure user_id references auth.users if using Supabase auth
    -- Note: This might need manual adjustment based on your auth setup
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE reward_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reward_wallets
CREATE POLICY "Users can view own wallet" ON reward_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON reward_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON reward_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for reward_coupons (public read)
CREATE POLICY "Anyone can view active coupons" ON reward_coupons
    FOR SELECT USING (is_active = true);

-- RLS Policies for reward_redemptions
CREATE POLICY "Users can view own redemptions" ON reward_redemptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own redemptions" ON reward_redemptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for event_rsvps
CREATE POLICY "Users can view own RSVPs" ON event_rsvps
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own RSVPs" ON event_rsvps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs" ON event_rsvps
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs" ON event_rsvps
    FOR DELETE USING (auth.uid() = user_id);

-- Create RPC function for redeeming coupons
CREATE OR REPLACE FUNCTION redeem_coupon(p_user UUID, p_coupon INTEGER)
RETURNS JSON AS $$
DECLARE
    user_points INTEGER;
    coupon_points INTEGER;
    coupon_active BOOLEAN;
    result JSON;
BEGIN
    -- Get user's current points
    SELECT points INTO user_points 
    FROM reward_wallets 
    WHERE user_id = p_user;
    
    -- Get coupon details
    SELECT points_required, is_active INTO coupon_points, coupon_active
    FROM reward_coupons 
    WHERE id = p_coupon;
    
    -- Check if user has enough points and coupon is active
    IF user_points IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User wallet not found');
    END IF;
    
    IF coupon_points IS NULL OR NOT coupon_active THEN
        RETURN json_build_object('success', false, 'error', 'Coupon not found or inactive');
    END IF;
    
    IF user_points < coupon_points THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient points');
    END IF;
    
    -- Deduct points from wallet
    UPDATE reward_wallets 
    SET points = points - coupon_points, updated_at = NOW()
    WHERE user_id = p_user;
    
    -- Create redemption record
    INSERT INTO reward_redemptions (user_id, coupon_id, points_spent, status)
    VALUES (p_user, p_coupon, coupon_points, 'completed');
    
    RETURN json_build_object('success', true, 'points_spent', coupon_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample reward coupons
INSERT INTO reward_coupons (title, description, vendor, points_required, is_active) VALUES
('Free Coffee', 'Get a free coffee from the campus cafe', 'Campus Cafe', 50, true),
('Pizza Slice', 'Free slice of pizza from the food court', 'Food Court', 75, true),
('Bookstore Discount', '10% off any item at the bookstore', 'Campus Bookstore', 100, true),
('Gym Day Pass', 'Free day pass to the campus gym', 'Campus Gym', 125, true),
('Library Study Room', '2-hour private study room booking', 'Library', 150, true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reward_wallets_user_id ON reward_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);

-- Create admin profiles table for role management
CREATE TABLE IF NOT EXISTS admin_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin',
    permissions TEXT[] DEFAULT ARRAY['manage_coupons', 'manage_events', 'view_analytics'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS for admin_profiles
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy for admin_profiles (admins can view all, users can view own)
CREATE POLICY "Admins can view all admin profiles" ON admin_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles ap 
            WHERE ap.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own admin profile" ON admin_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_profiles 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to make a user admin (run this after creating your admin account)
CREATE OR REPLACE FUNCTION make_user_admin(admin_email TEXT)
RETURNS JSON AS $$
DECLARE
    target_user_id UUID;
    result JSON;
BEGIN
    -- Get user ID from email
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = admin_email;
    
    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Insert admin profile
    INSERT INTO admin_profiles (user_id, role, permissions)
    VALUES (target_user_id, 'admin', ARRAY['manage_coupons', 'manage_events', 'view_analytics'])
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object('success', true, 'message', 'User is now admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
