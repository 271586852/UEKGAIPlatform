'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { GraphData } from '@/types';
import './Chatbot.css';

interface ChatbotProps {
  supabase: SupabaseClient;
  setGraphData: (data: GraphData | ((d: GraphData) => GraphData)) => void;
  activeSessionId: string | null;
  onNewSession: (sessionId: string) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot({ supabase, setGraphData, activeSessionId, onNewSession }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-chat-history', {
        body: { sessionId },
      });
      if (error) throw error;
      setMessages(data.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })));
    } catch (err: any) {
      console.error('Failed to fetch chat history:', err);
      setMessages([{ role: 'assistant', content: 'Failed to load chat history.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (activeSessionId) {
      fetchHistory(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId, fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    const sessionIdForRequest = activeSessionId || crypto.randomUUID();

    try {
      // Use fetch directly to handle the streaming response
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rag-query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ query: currentInput, sessionId: sessionIdForRequest }),
        }
      );

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get a response from the server.');
      }
      
      // If this is the first message of a new chat, notify the parent component
      if (!activeSessionId) {
        onNewSession(sessionIdForRequest);
      }
      
      // Handle the streaming response for typewriter effect
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content += chunk;
          }
          return [...prev];
        });
      }
    } catch (err: any) {
      console.error('Error during chat submission:', err);
      const errorMessage: Message = { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Need to get session for the Authorization header
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
  }, [supabase]);

  return (
    <div className="chatbot-container">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chatbot-form">
        <input
          className="chatbot-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Unreal Engine..."
          disabled={isLoading}
        />
        <button type="submit" className="chatbot-button" disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
