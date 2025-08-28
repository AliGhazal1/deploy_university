-- Campus Connection Platform Database Schema
-- PostgreSQL Database Schema for University Social Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Core user information
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    university VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles table - Extended user information
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    degree VARCHAR(100),
    major VARCHAR(100),
    year_of_study INTEGER,
    interests TEXT[],
    bio TEXT,
    availability JSONB, -- Store availability schedule as JSON
    free_time JSONB,    -- Store free time preferences as JSON
    profile_picture_url VARCHAR(500),
    social_links JSONB, -- Store social media links as JSON
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Events table - Campus events and activities
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('academic', 'social', 'sports', 'career', 'other')),
    location VARCHAR(200),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    capacity INTEGER,
    current_attendees INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    tags TEXT[],
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Event RSVPs table - Track event attendance
CREATE TABLE event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    rsvp_date TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Marketplace listings table - Buy/sell items
CREATE TABLE marketplace_listings (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    condition VARCHAR(20) CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive')),
    images TEXT[], -- Array of image URLs
    location VARCHAR(200),
    is_negotiable BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace transactions table - Track sales
CREATE TABLE marketplace_transactions (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    transaction_date TIMESTAMP DEFAULT NOW()
);

-- Messages table - User messaging system
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Check-ins table - Event attendance tracking
CREATE TABLE checkins (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    checked_in_at TIMESTAMP,
    points_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Rewards table - User reward points and transactions
CREATE TABLE rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_redeemed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Reward transactions table - Track point earning/spending
CREATE TABLE reward_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed')),
    points INTEGER NOT NULL,
    reason VARCHAR(200),
    reference_id INTEGER, -- Can reference events, checkins, etc.
    reference_type VARCHAR(50), -- 'event_checkin', 'marketplace_sale', etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Coupons table - Available rewards for redemption
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    points_required INTEGER NOT NULL,
    discount_amount DECIMAL(10,2),
    discount_percentage INTEGER,
    vendor VARCHAR(100),
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    usage_limit INTEGER,
    current_usage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Coupon redemptions table - Track coupon usage
CREATE TABLE coupon_redemptions (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    redemption_code VARCHAR(50) UNIQUE,
    redeemed_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    is_used BOOLEAN DEFAULT false
);

-- Reports table - User reporting system
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('harassment', 'inappropriate_content', 'spam', 'fake_profile', 'safety_concern', 'academic_dishonesty', 'other')),
    description TEXT NOT NULL,
    evidence_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    action_taken VARCHAR(100),
    admin_notes TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- User restrictions table - Track temporary/permanent restrictions
CREATE TABLE user_restrictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    restriction_type VARCHAR(50) NOT NULL CHECK (restriction_type IN ('messaging_blocked', 'messaging_limited', 'account_suspended', 'account_banned')),
    reason TEXT,
    expires_at TIMESTAMP, -- NULL for permanent restrictions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Matching preferences table - User matching algorithm preferences
CREATE TABLE matching_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferred_roles TEXT[],
    preferred_majors TEXT[],
    preferred_years INTEGER[],
    max_distance INTEGER, -- In case of location-based matching
    study_preferences JSONB,
    social_preferences JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User connections table - Track user matches/connections
CREATE TABLE user_connections (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    connection_type VARCHAR(20) DEFAULT 'match' CHECK (connection_type IN ('match', 'friend', 'blocked')),
    initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id != user2_id)
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_university ON users(university);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_active ON events(is_active);
CREATE INDEX idx_events_created_by ON events(created_by);

CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_category ON marketplace_listings(category);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_created_at ON marketplace_listings(created_at);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id);

CREATE INDEX idx_checkins_event ON checkins(event_id);
CREATE INDEX idx_checkins_user ON checkins(user_id);
CREATE INDEX idx_checkins_qr_code ON checkins(qr_code);

CREATE INDEX idx_rewards_user ON rewards(user_id);
CREATE INDEX idx_reward_transactions_user ON reward_transactions(user_id);
CREATE INDEX idx_reward_transactions_type ON reward_transactions(transaction_type);

CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);

CREATE INDEX idx_user_restrictions_user ON user_restrictions(user_id);
CREATE INDEX idx_user_restrictions_active ON user_restrictions(is_active);
CREATE INDEX idx_user_restrictions_expires ON user_restrictions(expires_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matching_preferences_updated_at BEFORE UPDATE ON matching_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_connections_updated_at BEFORE UPDATE ON user_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, name, role, university, is_active, email_verified) 
VALUES ('admin@university.edu', '$2b$10$rQZ8kHWKQYXyQxQxQxQxQeJ8kHWKQYXyQxQxQxQxQeJ8kHWKQYXyQx', 'System Admin', 'admin', 'University System', true, true);

-- Insert default reward balance for admin
INSERT INTO rewards (user_id, points_balance, total_earned, total_redeemed) 
VALUES (1, 0, 0, 0);

-- Insert sample coupons
INSERT INTO coupons (title, description, points_required, discount_percentage, vendor, expiry_date, is_active, usage_limit) VALUES
('Campus Bookstore 10% Off', 'Get 10% off your next purchase at the campus bookstore', 100, 10, 'Campus Bookstore', '2024-12-31', true, 100),
('Coffee Shop Free Drink', 'Get a free coffee or tea at the campus coffee shop', 150, NULL, 'Campus Coffee', '2024-12-31', true, 50),
('Library Late Fee Waiver', 'Waive one library late fee (up to $10)', 75, NULL, 'University Library', '2024-12-31', true, 200);

-- Comments for documentation
COMMENT ON TABLE users IS 'Core user accounts and authentication information';
COMMENT ON TABLE user_profiles IS 'Extended user profile information and preferences';
COMMENT ON TABLE events IS 'Campus events and activities';
COMMENT ON TABLE event_rsvps IS 'Event attendance tracking and RSVPs';
COMMENT ON TABLE marketplace_listings IS 'Student marketplace for buying/selling items';
COMMENT ON TABLE marketplace_transactions IS 'Completed marketplace transactions';
COMMENT ON TABLE messages IS 'User-to-user messaging system';
COMMENT ON TABLE checkins IS 'Event check-in system with QR codes';
COMMENT ON TABLE rewards IS 'User reward points and balances';
COMMENT ON TABLE reward_transactions IS 'History of point earning and spending';
COMMENT ON TABLE coupons IS 'Available rewards for point redemption';
COMMENT ON TABLE coupon_redemptions IS 'Tracking of redeemed coupons';
COMMENT ON TABLE reports IS 'User reporting and safety system';
COMMENT ON TABLE user_restrictions IS 'Temporary and permanent user restrictions';
COMMENT ON TABLE matching_preferences IS 'User preferences for matching algorithm';
COMMENT ON TABLE user_connections IS 'User matches and connections';
