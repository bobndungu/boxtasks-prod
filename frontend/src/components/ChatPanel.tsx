import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useChatSubscription, type ChatMessageData, type TypingData } from '../lib/mercure';
import {
  fetchMessages,
  sendMessage,
  createOrGetChannel,
  markMessagesRead,
  sendTypingIndicator,
  formatMessageTime,
  getInitials,
  type ChatMessage,
  type ChatChannel,
  type ChannelType,
} from '../lib/api/chat';
import { formatDate } from '../lib/utils/date';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  channelType: ChannelType;
  entityId: string;
  entityName: string;
}

export default function ChatPanel({
  isOpen,
  onClose,
  channelType,
  entityId,
  entityName,
}: ChatPanelProps) {
  const { user } = useAuthStore();
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef<number>(0);

  // Handle real-time messages
  const handleRealtimeMessage = useCallback((data: ChatMessageData) => {
    // Don't add if it's from the current user (we already added it optimistically)
    if (data.sender?.id === user?.id) return;

    const newMsg: ChatMessage = {
      id: data.id,
      text: data.text,
      type: data.type as ChatMessage['type'],
      sender: data.sender,
      createdAt: data.createdAt,
    };

    setMessages(prev => [...prev, newMsg]);

    // Clear typing indicator for this user
    setTypingUsers(prev => {
      const next = new Map(prev);
      if (data.sender?.id) {
        const entry = next.get(data.sender.id);
        if (entry) {
          clearTimeout(entry.timeout);
          next.delete(data.sender.id);
        }
      }
      return next;
    });
  }, [user?.id]);

  // Handle typing indicators
  const handleTyping = useCallback((data: TypingData) => {
    if (data.user.id === user?.id) return;

    setTypingUsers(prev => {
      const next = new Map(prev);

      // Clear existing timeout
      const existing = next.get(data.user.id);
      if (existing) {
        clearTimeout(existing.timeout);
      }

      // Set new timeout to clear after 3 seconds
      const timeout = setTimeout(() => {
        setTypingUsers(p => {
          const n = new Map(p);
          n.delete(data.user.id);
          return n;
        });
      }, 3000);

      next.set(data.user.id, {
        name: data.user.displayName || data.user.name,
        timeout,
      });

      return next;
    });
  }, [user?.id]);

  // Subscribe to real-time updates
  const { connected } = useChatSubscription(channel?.id, {
    onMessage: handleRealtimeMessage,
    onTyping: handleTyping,
  });

  // Load or create channel and fetch messages
  useEffect(() => {
    if (!isOpen || !entityId) return;

    const initChat = async () => {
      setIsLoading(true);
      try {
        // Get or create channel
        const channelData = await createOrGetChannel({
          name: `${entityName} Chat`,
          type: channelType,
          entityId,
        });
        setChannel(channelData);

        // Fetch messages
        const { messages: msgs, hasMore: more } = await fetchMessages(channelData.id);
        setMessages(msgs);
        setHasMore(more);

        // Mark as read
        await markMessagesRead(channelData.id);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, [isOpen, entityId, entityName, channelType]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load more messages
  const loadMore = async () => {
    if (!channel || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const firstMessage = messages[0];
      const { messages: olderMessages, hasMore: more } = await fetchMessages(
        channel.id,
        { before: firstMessage?.id, limit: 50 }
      );
      setMessages(prev => [...olderMessages, ...prev]);
      setHasMore(more);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send typing indicator (throttled)
  const sendTyping = useCallback(() => {
    if (!channel) return;

    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;

    lastTypingSent.current = now;
    sendTypingIndicator(channel.id).catch(() => {});
  }, [channel]);

  // Handle send message
  const handleSend = async () => {
    if (!channel || !newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Optimistic update
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      type: 'text',
      sender: user ? {
        id: user.id,
        name: user.username || '',
        displayName: user.displayName || user.username || '',
        avatar: null,
      } : null,
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const sentMessage = await sendMessage({
        channelId: channel.id,
        message: messageText,
      });

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(m => m.id === optimisticMessage.id ? sentMessage : m)
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restore the message
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    sendTyping();
  };

  // Get typing indicator text
  const getTypingText = () => {
    const users = Array.from(typingUsers.values()).map(u => u.name);
    if (users.length === 0) return null;
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users.length} people are typing...`;
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{entityName}</h3>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {connected ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>Connecting...</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {/* Load more button */}
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  )}
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Messages grouped by date */}
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(date, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>

                {dateMessages.map((message, index) => {
                  const isOwnMessage = message.sender?.id === user?.id;
                  const showAvatar = index === 0 ||
                    dateMessages[index - 1]?.sender?.id !== message.sender?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div className="w-8 flex-shrink-0">
                        {showAvatar && message.sender && (
                          <div
                            className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                            title={message.sender.displayName || message.sender.name}
                          >
                            {getInitials(message.sender.displayName || message.sender.name)}
                          </div>
                        )}
                      </div>

                      {/* Message bubble */}
                      <div
                        className={`max-w-[70%] ${showAvatar ? 'mt-1' : ''}`}
                      >
                        {showAvatar && message.sender && (
                          <div className={`text-xs text-gray-500 dark:text-gray-400 mb-1 ${isOwnMessage ? 'text-right' : ''}`}>
                            {message.sender.displayName || message.sender.name}
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            isOwnMessage
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.text}
                          </p>
                        </div>
                        <div className={`text-xs text-gray-400 dark:text-gray-500 mt-0.5 ${isOwnMessage ? 'text-right' : ''}`}>
                          {formatMessageTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {/* Typing indicator */}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{getTypingText()}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
