import React, { useState, useCallback, useEffect } from 'react';
import GraphVisualization from './components/GraphVisualization';
import Sidebar from './components/Sidebar';
import type { GraphNode, GraphLink } from './types';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import Chatbot from './components/Chatbot';
import ChatHistorySidebar, { type ChatSession } from './components/ChatHistorySidebar';

// 全局 Supabase 客户端实例
const SUPABASE_URL = 'https://nqmdoblaghggzdzndjft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWRvYmxhZ2hnZ3pkem5kamZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODE0NDUsImV4cCI6MjA2OTI1NzQ0NX0.N-B7te5FVDJXbdNJ9A6mVX5P85h6sGYYV8i4lkr2Z50';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  // Graph and UI State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'force' | 'radial'>('force');
  const [isAggregated, setIsAggregated] = useState(false);

  // Chat State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Fetch initial graph data
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-graph-data');
      if (funcError) throw funcError;
      if (data && data.nodes && data.links) {
        setNodes(data.nodes);
        setLinks(data.links);
      } else {
        throw new Error("Invalid data structure received.");
      }
    } catch (err: any) {
      console.error("Failed to fetch initial graph data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch chat sessions
  const fetchChatSessions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-chat-history');
      if (error) throw error;
      setChatSessions(data || []);
    } catch (err: any) {
      console.error("Failed to fetch chat sessions:", err);
      // Not setting a page-blocking error for this
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchInitialData();
    fetchChatSessions();
  }, [fetchInitialData]);

  // Event Handlers
  const handleNodeClick = (node: GraphNode) => setSelectedNode(node);
  const handleSidebarClose = () => setSelectedNode(null);

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleNewChat = () => {
    setActiveSessionId(null); // Deselect any active session to start a new one
  };
  
  // When a new message is sent, we need to refresh the session list
  // to show the new chat at the top.
  const handleNewMessage = () => {
    fetchChatSessions();
  };

  return (
    <div className="App">
      <ChatHistorySidebar
        sessions={chatSessions}
        activeSessionId={activeSessionId}
        onSessionClick={handleSessionSelect}
        onNewChat={handleNewChat}
      />
      <div className="app-main-content">
        <header className="App-header">
          <h1>Unreal Engine Knowledge Graph</h1>
          <div className="layout-controls">
            <button onClick={() => setLayout('force')} disabled={layout === 'force' || isLoading}>Force</button>
            <button onClick={() => setLayout('radial')} disabled={layout === 'radial' || isLoading}>Radial</button>
            <button onClick={() => setIsAggregated(!isAggregated)} disabled={isLoading}>
              {isAggregated ? 'Ungroup' : 'Group by Label'}
            </button>
          </div>
          <button onClick={fetchInitialData} className="reset-btn" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reset View'}
          </button>
        </header>
        <main className={`main-content ${selectedNode ? 'sidebar-open' : ''}`}>
          {error && <div className="error-message full-page-error">Error: {error}</div>}
          {!error && (
            <>
              <GraphVisualization
                nodes={nodes}
                links={links}
                onNodeClick={handleNodeClick}
                setNodes={setNodes}
                setLinks={setLinks}
                setIsLoading={setIsLoading}
                setError={setError}
                layout={layout}
                isAggregated={isAggregated}
              />
              <Sidebar node={selectedNode} onClose={handleSidebarClose} />
            </>
          )}
        </main>
      </div>
      <Chatbot 
        key={activeSessionId || 'new'} 
        activeSessionId={activeSessionId}
        onNewMessage={handleNewMessage}
        onSessionSelect={handleSessionSelect}
      />
    </div>
  );
}

export default App; 