import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './Chatbot.css';

const SUPABASE_URL = 'https://nqmdoblaghggzdzndjft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWRvYmxhZ2hnZ3pkem5kamZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODE0NDUsImV4cCI6MjA2OTI1NzQ0NX0.N-B7te5FVDJXbdNJ9A6mVX5P85h6sGYYV8i4lkr2Z50';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotProps {
  activeSessionId: string | null;
  onNewMessage: () => void;
  onSessionSelect: (sessionId: string) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ activeSessionId, onNewMessage, onSessionSelect }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to the bottom of the messages list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Effect to fetch history when the active session changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-chat-history', {
          body: { sessionId: activeSessionId },
        });
        if (error) throw error;
        setMessages(data.map((item: any) => ({ role: item.role, content: item.content })));
      } catch (err: any) {
        setError('Failed to load chat history.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [activeSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);
    setError('');

    // If it's a new chat, generate a session ID for the request
    const sessionIdForRequest = activeSessionId || crypto.randomUUID();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rag-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query: currentQuery, sessionId: sessionIdForRequest }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get a response from the server.');
      }
      
      // Handle streaming response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          lastMessage.content += chunk;
          return [...prev];
        });
      }
      
      // If this was the first message of a new chat, update the parent state
      if (!activeSessionId) {
        onNewMessage();
        onSessionSelect(sessionIdForRequest);
      }

    } catch (err: any) {
      console.error("Error during chat:", err);
      setError(err.message || 'Failed to get an answer.');
      setMessages(newMessages); // Revert to messages before AI response
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {error && <div className="chatbot-error">{error}</div>}
      <form onSubmit={handleSubmit} className="chatbot-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something..."
          className="chatbot-input"
          disabled={isLoading}
        />
        <button type="submit" className="chatbot-button" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default Chatbot; 