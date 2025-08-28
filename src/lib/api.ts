// API service layer for Campus Connect backend
const API_BASE_URL = 'http://localhost:3001/api/v1';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'faculty' | 'admin';
  university: string;
  is_active: boolean;
}

export interface UserProfile {
  id: number;
  user_id: number;
  degree?: string;
  major?: string;
  year_of_study?: number;
  interests: string[];
  bio?: string;
  availability?: any;
  free_time?: any;
  profile_picture_url?: string;
  social_links?: any;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  event_type: 'academic' | 'social' | 'sports' | 'career' | 'other';
  location?: string;
  start_time: string;
  end_time: string;
  capacity?: number;
  current_attendees: number;
  created_by: number;
  is_active: boolean;
  tags: string[];
  image_url?: string;
}

export interface MarketplaceListing {
  id: number;
  seller_id: number;
  title: string;
  description?: string;
  price: number;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  status: 'active' | 'sold' | 'inactive';
  images: string[];
  location?: string;
  is_negotiable: boolean;
  created_at: string;
}

export interface RewardBalance {
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
}

// API Client class
class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('campus_connect_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('campus_connect_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('campus_connect_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{ token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async signup(email: string, password: string, name: string, university: string, role: string = 'student') {
    return this.request<{ message: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, university, role }),
    });
  }

  async signupWithProfile(signupData: any) {
    const response = await this.request<{ token: string; user: User; message: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupData),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/auth/me');
  }

  // Profile endpoints
  async getProfile(userId?: number) {
    const endpoint = userId ? `/profiles/${userId}` : '/profiles';
    return this.request<{ profile: UserProfile }>(`${endpoint}`);
  }

  async updateProfile(profileData: Partial<UserProfile>) {
    return this.request<{ message: string; profile: UserProfile }>('/profiles', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Events endpoints
  async getEvents(page = 1, limit = 20, eventType?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (eventType) params.append('event_type', eventType);
    
    return this.request<{ events: Event[]; pagination: any }>(`/events?${params}`);
  }

  async getEvent(eventId: number) {
    return this.request<{ event: Event }>(`/events/${eventId}`);
  }

  async createEvent(eventData: Partial<Event>) {
    return this.request<{ message: string; event: Event }>('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async rsvpToEvent(eventId: number) {
    return this.request<{ message: string }>(`/events/${eventId}/rsvp`, {
      method: 'POST',
    });
  }

  // Marketplace endpoints
  async getMarketplaceListings(page = 1, limit = 20, category?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (category) params.append('category', category);
    
    return this.request<{ listings: MarketplaceListing[]; pagination: any }>(`/marketplace?${params}`);
  }

  async createListing(listingData: Partial<MarketplaceListing>) {
    return this.request<{ message: string; listing: MarketplaceListing }>('/marketplace', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  }

  async getMyListings() {
    return this.request<{ listings: MarketplaceListing[] }>('/marketplace/my-items');
  }

  async updateListing(listingId: number, listingData: Partial<MarketplaceListing>) {
    return this.request<{ message: string; listing: MarketplaceListing }>(`/marketplace/${listingId}`, {
      method: 'PUT',
      body: JSON.stringify(listingData),
    });
  }

  // Rewards endpoints
  async getRewardBalance() {
    return this.request<RewardBalance>('/rewards/balance');
  }

  async getLeaderboard() {
    return this.request<{ leaderboard: any[] }>('/rewards/leaderboard');
  }

  async getCoupons() {
    return this.request<{ coupons: any[] }>('/rewards/coupons');
  }

  async redeemCoupon(couponId: number) {
    return this.request<{ message: string; redemption_code: string }>('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify({ coupon_id: couponId }),
    });
  }

  // Matching endpoints
  async getMatches() {
    return this.request<{ matches: any[] }>('/matching/matches');
  }

  async getSuggestions() {
    return this.request<{ suggestions: any[] }>('/matching/suggestions');
  }

  // Messages endpoints
  async getConversations() {
    return this.request<{ conversations: any[] }>('/messages/conversations');
  }

  async getMessages(userId: number, conversationWith?: number) {
    const params = new URLSearchParams({
      user_id: userId.toString(),
    });
    if (conversationWith) params.append('conversation_with', conversationWith.toString());
    
    return this.request<{ messages: any[] }>(`/messages?${params}`);
  }

  async sendMessage(receiverId: number, body: string) {
    return this.request<{ message: string }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId, body }),
    });
  }

  // Reports endpoints
  async submitReport(reportedUserId: number, reason: string, description: string) {
    return this.request<{ message: string }>('/reports', {
      method: 'POST',
      body: JSON.stringify({
        reported_user_id: reportedUserId,
        reason,
        description,
      }),
    });
  }
}

export const apiClient = new ApiClient();
