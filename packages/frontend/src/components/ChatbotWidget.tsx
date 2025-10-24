import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Copy, RotateCcw, Loader2, ExternalLink } from 'lucide-react';

// Backend URL for chatbot (public endpoint, no auth required)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  confidence?: number;
}

interface Source {
  id: string;
  title: string;
  content: string;
  similarity: number;
  category?: string;
}

interface ChatResponse {
  message: string;
  sources: Source[];
  sessionId: string;
  confidence: number;
  tokensUsed?: number;
  latency?: number;
}

interface ChatbotWidgetProps {
  defaultOpen?: boolean;
}

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Open chatbot when defaultOpen changes
  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  // Load session from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem('chatbot_session_id');
    const savedMessages = localStorage.getItem('chatbot_messages');

    if (savedSessionId) {
      setSessionId(savedSessionId);
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    }
  }, []);

  // Save session to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chatbot_session_id', sessionId);
    }
    if (messages.length > 0) {
      localStorage.setItem('chatbot_messages', JSON.stringify(messages));
    }
  }, [sessionId, messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/v2/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId || undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chatbot API error:', response.status, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const chatResponse: ChatResponse = data.data;

      // Update session ID if new
      if (chatResponse.sessionId && !sessionId) {
        setSessionId(chatResponse.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: chatResponse.message,
        timestamp: new Date(),
        sources: chatResponse.sources,
        confidence: chatResponse.confidence
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearConversation = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('chatbot_session_id');
    localStorage.removeItem('chatbot_messages');
  };

  const submitFeedback = async () => {
    if (!sessionId || rating === null) return;

    try {
      const response = await fetch(`${API_BASE_URL}/v2/chatbot/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          rating,
          feedback: feedback || undefined
        })
      });

      if (!response.ok) {
        console.error('Failed to submit feedback:', response.status);
      }

      setShowFeedback(false);
      setRating(null);
      setFeedback('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return 'Unknown';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110 z-50"
          aria-label="Open chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window - Responsive */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-96 h-[calc(100vh-2rem)] sm:h-[600px] max-w-md bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-white">Ask Elara</h3>
                <p className="text-xs text-blue-100">Cybersecurity Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => setShowFeedback(true)}
                  className="text-white hover:bg-blue-700 p-1 rounded"
                  title="Rate conversation"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="text-white hover:bg-blue-700 p-1 rounded"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-blue-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">Hi! I'm Elara, your cybersecurity assistant.</p>
                <p className="text-xs mt-2">Ask me anything about online safety, phishing, malware, or digital security!</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 shadow-sm'
                  }`}
                >
                  <p className={`text-sm whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : 'text-gray-900 font-medium'}`}>{message.content}</p>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Sources:</p>
                      <div className="space-y-1">
                        {message.sources.map((source, idx) => (
                          <div key={source.id} className="text-xs text-gray-600 flex items-start gap-1">
                            <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{idx + 1}. {source.title} ({(source.similarity * 100).toFixed(0)}% match)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence Score */}
                  {message.confidence !== undefined && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs">
                        <span className="text-gray-600">Confidence: </span>
                        <span className={`font-semibold ${getConfidenceColor(message.confidence)}`}>
                          {getConfidenceLabel(message.confidence)} ({(message.confidence * 100).toFixed(0)}%)
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatTime(message.timestamp)}
                    </span>
                    <button
                      onClick={() => copyMessage(message.content)}
                      className={`${message.role === 'user' ? 'text-blue-100 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Feedback Modal */}
          {showFeedback && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
                <h4 className="font-semibold text-lg text-gray-900 mb-4">Rate this conversation</h4>

                <div className="flex gap-4 mb-4 justify-center">
                  <button
                    onClick={() => setRating(1)}
                    className={`p-3 rounded-lg border-2 ${rating === 1 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                  >
                    <ThumbsDown className={`w-6 h-6 ${rating === 1 ? 'text-red-500' : 'text-gray-400'}`} />
                  </button>
                  <button
                    onClick={() => setRating(5)}
                    className={`p-3 rounded-lg border-2 ${rating === 5 ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                  >
                    <ThumbsUp className={`w-6 h-6 ${rating === 5 ? 'text-green-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback..."
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 placeholder-gray-500 mb-4"
                  rows={3}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitFeedback}
                    disabled={rating === null}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about cybersecurity..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
