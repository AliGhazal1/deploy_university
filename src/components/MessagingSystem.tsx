import { useState, useEffect } from 'react';
import { supabase, Message } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface MessagingSystemProps {
  user: User;
}

interface Conversation {
  user_id: string;
  user_email: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export default function MessagingSystem({ user }: MessagingSystemProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, [user.id]);

  useEffect(() => {
    if (selectedUserId) {
      fetchMessages(selectedUserId);
    }
  }, [selectedUserId, user.id]);

  const fetchConversations = async () => {
    try {
      // Get all messages involving the current user
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation partner
      const conversationMap = new Map<string, Conversation>();
      
      for (const message of allMessages || []) {
        const partnerId = message.sender_user_id === user.id 
          ? message.receiver_user_id 
          : message.sender_user_id;
        
        if (!conversationMap.has(partnerId)) {
          // Get partner's email from auth.users (this would need RLS policy)
          const { data: userData } = await supabase.auth.admin.getUserById(partnerId);
          
          conversationMap.set(partnerId, {
            user_id: partnerId,
            user_email: userData.user?.email || 'Unknown User',
            last_message: message.body,
            last_message_time: message.created_at,
            unread_count: 0,
          });
        }
      }

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
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

  const markMessagesAsRead = async (senderId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_user_id', senderId)
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
        .insert([{
          sender_user_id: user.id,
          receiver_user_id: selectedUserId,
          body: newMessage.trim(),
        }])
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-96">
        {/* Conversations List */}
        <div className="bg-white shadow rounded-lg p-4 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversations</h3>
          {conversations.length === 0 ? (
            <p className="text-gray-500 text-sm">No conversations yet</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.user_id}
                  onClick={() => setSelectedUserId(conversation.user_id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUserId === conversation.user_id
                      ? 'bg-indigo-100 border-indigo-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">
                    {conversation.user_email}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {conversation.last_message}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(conversation.last_message_time).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="md:col-span-2 bg-white shadow rounded-lg flex flex-col">
          {selectedUserId ? (
            <>
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  {conversations.find(c => c.user_id === selectedUserId)?.user_email}
                </h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_user_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender_user_id === user.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.body}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_user_id === user.id ? 'text-indigo-200' : 'text-gray-500'
                      }`}>
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
