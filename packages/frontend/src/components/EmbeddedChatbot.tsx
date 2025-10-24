import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Loader2, Copy, ExternalLink, Bot, User } from 'lucide-react';

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

const EmbeddedChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-xl shadow-2xl overflow-hidden border border-purple-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              Ask Elara AI
              <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-normal">Beta</span>
            </h3>
            <p className="text-purple-100 text-sm">Your Intelligent Cybersecurity Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-white/50">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full mb-4">
              <Bot className="w-12 h-12 text-purple-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Ask Elara AI!</h4>
            <p className="text-gray-600 mb-4">I'm here to help you with cybersecurity questions.</p>
            <div className="max-w-md mx-auto text-left space-y-2">
              <div className="p-3 bg-white rounded-lg border border-purple-200">
                <p className="text-sm text-gray-700">💡 <strong>Try asking:</strong></p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• "How can I identify phishing emails?"</li>
                  <li>• "What is ransomware?"</li>
                  <li>• "How do I create a strong password?"</li>
                  <li>• "What should I do if I clicked a suspicious link?"</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                : 'bg-gradient-to-r from-purple-500 to-pink-500'
            }`}>
              {message.role === 'user' ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl p-4 shadow-md ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Sources:
                    </p>
                    <div className="space-y-1">
                      {message.sources.map((source, idx) => (
                        <div key={source.id} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="font-medium">{idx + 1}.</span>
                          <span>{source.title} ({(source.similarity * 100).toFixed(0)}% match)</span>
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
                  <span className={`text-xs ${message.role === 'user' ? 'text-purple-100' : 'text-gray-400'}`}>
                    {formatTime(message.timestamp)}
                  </span>
                  <button
                    onClick={() => copyMessage(message.content)}
                    className={`${message.role === 'user' ? 'text-purple-100 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Copy message"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-md">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-white border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about cybersecurity..."
            className="flex-1 border-2 border-purple-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed self-end transition-all duration-200 transform hover:scale-105"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send,
          <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs ml-1">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
};

export default EmbeddedChatbot;
