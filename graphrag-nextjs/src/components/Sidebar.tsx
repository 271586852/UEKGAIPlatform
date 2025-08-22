"use client";

import { useState, useEffect } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { ChatSession } from "@/types";

interface SidebarProps {
  supabase: SupabaseClient;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  // This version number will be incremented by the parent to trigger a refetch
  chatListVersion: number;
  onDeleteSession: (sessionId: string) => void; // Add this
}

export default function Sidebar({
  supabase,
  activeSessionId,
  setActiveSessionId,
  chatListVersion,
  onDeleteSession,
}: SidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [error, setSidebarError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-chat-history"
        );

        if (fetchError) throw fetchError;

        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          console.warn("Received non-array data for sessions:", data);
          setSessions([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch chat sessions:", err);
        setSidebarError(`Failed to load sessions: ${err.message}`);
      }
    };

    fetchSessions();
  }, [supabase, chatListVersion]); // Dependency on chatListVersion ensures refetch on new chat

  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent session click event from firing
    if (window.confirm("Are you sure you want to delete this chat session?")) {
      onDeleteSession(sessionId);
    }
  };

  return (
    <div className="chat-history-sidebar">
      <div className="sidebar-header">
        <h2>Chat History</h2>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
      </div>
      {error && (
        <p className="error-message" style={{ padding: "10px", color: "red" }}>
          {error}
        </p>
      )}
      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className={`session-item ${
              session.session_id === activeSessionId ? "active" : ""
            }`}
            onClick={() => setActiveSessionId(session.session_id)}
          >
            <div className="session-details">
              <p className="session-title">{session.first_message}</p>
              <p className="session-timestamp">
                {new Date(session.last_updated).toLocaleString()}
              </p>
            </div>
            <button
              className="delete-session-btn"
              onClick={(e) => handleDelete(e, session.session_id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
