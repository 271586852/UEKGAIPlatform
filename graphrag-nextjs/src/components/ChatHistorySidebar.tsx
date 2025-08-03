'use client';

import React from 'react';
import './ChatHistorySidebar.css';

export interface ChatSession {
  session_id: string;
  first_message: string;
  last_updated: string;
}

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionClick: (sessionId: string) => void;
  onNewChat: () => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionClick,
  onNewChat,
}) => {
  return (
    <div className="chat-history-sidebar">
      <div className="sidebar-header">
        <h2>Chat History</h2>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>
      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className={`session-item ${session.session_id === activeSessionId ? 'active' : ''}`}
            onClick={() => onSessionClick(session.session_id)}
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
};

export default ChatHistorySidebar;