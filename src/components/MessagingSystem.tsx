import { useState, useEffect } from 'react';
import { supabase, Message } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { MessageCircle, Send, Search, Plus, User as UserIcon, Clock, Check, CheckCheck } from 'lucide-react';

interface MessagingSystemProps {
  user: User;
  contactSellerInfo?: {
    sellerId: string;
    sellerName: string;
    listingTitle: string;
  } | null;
  onClearContactInfo?: () => void;
}

interface Conversation {
  user_id: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  user_name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  university: string;
  degree: string;
}

export default function MessagingSystem({ user, contactSellerInfo, onClearContactInfo }: MessagingSystemProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('💬 MessagingSystem mounted. user.id =', user.id);
    fetchConversations();
  }, [user.id]);

  useEffect(() => {
    if (selectedUserId) {
      fetchMessages(selectedUserId);
    }
  }, [selectedUserId, user.id]);

  useEffect(() => {
    if (contactSellerInfo) {
      console.log('📞 Starting conversation with seller:', contactSellerInfo);
      setSelectedUserId(contactSellerInfo.sellerId);
      setSelectedUserName(contactSellerInfo.sellerName);
      setNewMessage(`Hi! I'm interested in your listing: "${contactSellerInfo.listingTitle}". Is it still available?`);
      setShowUserSearch(false);
      
      // Clear the contact info after using it
      if (onClearContactInfo) {
        onClearContactInfo();
      }
    }
  }, [contactSellerInfo, onClearContactInfo]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation partner user_id
      const conversationMap = new Map<string, Conversation>();
      
      for (const message of allMessages || []) {
        const partnerId = message.sender_user_id === user.id 
          ? message.receiver_user_id 
          : message.sender_user_id;
        
        if (partnerId && !conversationMap.has(partnerId)) {
          // Fetch partner's public profile info
          const { data: partnerProfile } = await supabase
            .from('public_profiles')
            .select('full_name')
            .eq('user_id', partnerId)
            .single();
          
          conversationMap.set(partnerId, {
            user_id: partnerId,
            last_message: message.body,
            last_message_time: message.created_at,
            unread_count: 0,
            user_name: partnerProfile?.full_name || 'Unknown User'
          });
        }
      }

      setConversations(Array.from(conversationMap.values()));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_user_id.eq.${user.id},receiver_user_id.eq.${partnerId}),and(sender_user_id.eq.${partnerId},receiver_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      await markMessagesAsRead(partnerId);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async (partnerId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_user_id', partnerId)
        .eq('receiver_user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_user_id: user.id,
            receiver_user_id: selectedUserId,
            body: newMessage.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages((prev) => [...prev, data]);
        setNewMessage('');
        // Refresh conversations to show this new conversation
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const searchUsers = async (query: string) => {
    console.log('🚀 searchUsers function called with query:', query);
    
    if (!query.trim()) {
      console.log('⚠️ Query is empty, clearing results');
      setSearchResults([]);
      return;
    }

    try {
      console.log('🔍 Searching for:', query);
      console.log('👤 Current user ID:', user.id);
      
      const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, full_name, university, degree')
        .ilike('full_name', `%${query}%`)
        .neq('user_id', user.id)
        .limit(10);

      console.log('📊 Query result - Data:', data);
      console.log('❌ Query result - Error:', error);
      console.log('📈 Number of results:', data?.length || 0);

      if (error) {
        console.error('Search error:', error);
        throw error;
      }
      
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    }
  };

  const startConversationWithUser = (userId: string, userName?: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName || '');
    setShowUserSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Temporary debug helper to verify public_profiles query works irrespective of UI
  const runProfilesDebugQuery = async () => {
    try {
      console.log('🧪 Running debug public_profiles query...');
      const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, full_name')
        .limit(20);
      console.log('🧪 Debug public_profiles data:', data);
      console.log('🧪 Debug public_profiles error:', error);
    } catch (e) {
      console.error('🧪 Debug public_profiles exception:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-violet-400" />
          Messages
        </h2>
        <p className="text-zinc-400 mt-2">Connect with your campus community</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
        {/* Conversations List */}
        <div className="backdrop-blur-xl bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400 mb-4">
            Conversations
          </h3>
          
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2 custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">No conversations yet</p>
                <p className="text-zinc-600 text-xs mt-1">Start a new conversation below</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.user_id}
                  onClick={() => {
                    setSelectedUserId(conversation.user_id);
                    setSelectedUserName(conversation.user_name);
                  }}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedUserId === conversation.user_id
                      ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30'
                      : 'bg-zinc-900/30 hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-100 mb-1">
                        {conversation.user_name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {conversation.last_message}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(conversation.last_message_time).toLocaleDateString()}
                      </div>
                    </div>
                    {conversation.unread_count > 0 && (
                      <div className="bg-violet-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conversation.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="pt-4 border-t border-zinc-700/50">
            <button
              onClick={() => setShowUserSearch(!showUserSearch)}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-3 rounded-xl hover:from-violet-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2 font-semibold"
            >
              {showUserSearch ? (
                <>
                  <Search className="w-4 h-4" />
                  Cancel Search
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Start New Conversation
                </>
              )}
            </button>
            
            {showUserSearch && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Search by name..."
                    className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto bg-zinc-900/30 border border-zinc-700/50 rounded-xl">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.user_id}
                        onClick={() => startConversationWithUser(profile.user_id, profile.full_name)}
                        className="p-3 hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-700/30 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-sm text-zinc-100">
                          {profile.full_name}
                        </div>
                        {profile.university && (
                          <div className="text-xs text-zinc-500 mt-1">
                            {profile.university} • {profile.degree}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {searchQuery && searchResults.length === 0 && (
                  <div className="text-sm text-zinc-500 text-center py-3 bg-zinc-900/30 rounded-xl border border-zinc-700/30">
                    No users found. Try a different search term.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="lg:col-span-2 backdrop-blur-xl bg-zinc-800/50 border border-zinc-700/50 rounded-2xl flex flex-col overflow-hidden">
          {selectedUserId ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-zinc-700/50 flex-shrink-0 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">
                      {selectedUserName || 'Unknown User'}
                    </h3>
                    <p className="text-xs text-zinc-400">Active now</p>
                  </div>
                </div>
              </div>
              
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((message) => {
                  const isOwnMessage = message.sender_user_id === user.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`group flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                        {!isOwnMessage && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`px-4 py-3 rounded-2xl ${
                            isOwnMessage
                              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                              : 'bg-zinc-700/50 text-zinc-100 border border-zinc-600/50'
                          }`}
                        >
                          <p className="text-sm break-words">{message.body}</p>
                          <div className={`flex items-center gap-1 mt-2 ${
                            isOwnMessage ? 'justify-end' : ''
                          }`}>
                            <p className={`text-xs ${
                              isOwnMessage ? 'text-violet-200' : 'text-zinc-500'
                            }`}>
                              {new Date(message.created_at).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                            {isOwnMessage && (
                              message.read_at ? 
                                <CheckCheck className="w-3 h-3 text-violet-200" /> : 
                                <Check className="w-3 h-3 text-violet-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-6 border-t border-zinc-700/50 flex-shrink-0 bg-zinc-900/30">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 font-semibold"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                <MessageCircle className="w-12 h-12 text-violet-400" />
              </div>
              <p className="text-zinc-400 text-center text-lg font-medium">Select a conversation</p>
              <p className="text-zinc-500 text-center text-sm mt-2">Choose a conversation from the list or start a new one</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}
