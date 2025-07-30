'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import GraphVisualization from '@/components/GraphVisualization';
import Chatbot from '@/components/Chatbot';
import Sidebar from '@/components/Sidebar';
import { GraphData } from '@/types';
import './globals.css';

import '@/components/ChatHistorySidebar.css';
import '@/components/GraphVisualization.css';
import '@/components/Chatbot.css';

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatListVersion, setChatListVersion] = useState(0); // Version tracker for sidebar
  
  const [layout, setLayout] = useState<'force' | 'radial'>('force');
  const [isAggregated, setIsAggregated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supabase] = useState(() => createPagesBrowserClient());

  const fetchInitialData = useCallback(async (client: SupabaseClient) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: funcError } = await client.functions.invoke('get-graph-data');
      if (funcError) throw funcError;
      if (data && data.nodes && data.links) {
        setGraphData(data);
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

  useEffect(() => {
    const getSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        fetchInitialData(supabase);
      }
    };

    getSessionAndData();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN') {
        fetchInitialData(supabase);
      }
      if (_event === 'SIGNED_OUT') {
        setGraphData({ nodes: [], links: [] });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, fetchInitialData]);
  
  const handleNewSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    // Increment version to force sidebar refresh
    setChatListVersion(v => v + 1);
  };

  if (!session) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '320px' }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['github', 'google']}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Sidebar 
        supabase={supabase} 
        activeSessionId={activeSessionId} 
        setActiveSessionId={setActiveSessionId}
        chatListVersion={chatListVersion}
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
          <button onClick={() => fetchInitialData(supabase)} className="reset-btn" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reset View'}
          </button>
        </header>
        <main className="main-content">
          {error && <div className="error-message">Error: {error}</div>}
          <GraphVisualization 
            supabase={supabase}
            graphData={graphData}
            setGraphData={setGraphData}
            activeSessionId={activeSessionId}
            layout={layout}
            isAggregated={isAggregated}
            setIsLoading={setIsLoading}
            setError={setError}
          />
        </main>
      </div>
      <Chatbot 
        supabase={supabase} 
        setGraphData={setGraphData} 
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
      />
    </div>
  );
}

export default App;
