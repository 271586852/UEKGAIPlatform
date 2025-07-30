'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ChatSession } from '@/types';
import './ChatHistorySidebar.css'; 

interface SidebarProps {
  supabase: SupabaseClient;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  // This version number will be incremented by the parent to trigger a refetch
  chatListVersion: number; 
}

export default function Sidebar({ supabase, activeSessionId, setActiveSessionId, chatListVersion }: SidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data, error: fetchError } = await supabase.functions.invoke('get-chat-history');

        if (fetchError) throw fetchError;
        
        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          console.warn('Received non-array data for sessions:', data);
          setSessions([]);
        }

      } catch (err: any) {
        console.error('Failed to fetch chat sessions:', err);
        setError(`Failed to load sessions: ${err.message}`);
      }
    };

    fetchSessions();

  }, [supabase, chatListVersion]); // Dependency on chatListVersion ensures refetch on new chat

  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  return (
    <div className="chat-history-sidebar">
      <div className="sidebar-header">
        <h2>Chat History</h2>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
      </div>
      {error && <p className="error-message" style={{ padding: '10px', color: 'red' }}>{error}</p>}
      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className={`session-item ${session.session_id === activeSessionId ? 'active' : ''}`}
            onClick={() => setActiveSessionId(session.session_id)}
          >
            <p className="session-title">{session.first_message}</p>
            <p className="session-timestamp">
              {new Date(session.last_updated).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
