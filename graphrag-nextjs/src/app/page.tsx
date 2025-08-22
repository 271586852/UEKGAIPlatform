'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import GraphVisualization from '@/components/GraphVisualization';
import Chatbot from '@/components/Chatbot';
import Sidebar from '@/components/Sidebar';
import ThinkingIndicator from '@/components/ThinkingIndicator';
import CypherGenerator from '@/components/CypherGenerator';
import { GraphData } from '@/types';
import './globals.css';

import '@/components/GraphVisualization.css';
import '@/components/Chatbot.css';
import '@/components/ThinkingIndicator.css';

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatListVersion, setChatListVersion] = useState(0); // Version tracker for sidebar
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cypherQuery, setCypherQuery] = useState('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25');


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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-chat-history', {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      
      // Remove the session from the local state to update the UI
      // setSessions(prevSessions => prevSessions.filter(s => s.session_id !== sessionId)); // This line was removed as per the new_code, as sessions state was not defined.
      
      // If the deleted session was the active one, start a new chat
      if (activeSessionId === sessionId) {
        setActiveSessionId(null); // Or trigger a proper new chat flow
      }
      // Force a refresh of the chat list by updating the version tracker
      setChatListVersion(v => v + 1);
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      setError(`Failed to delete session: ${err.message}`);
    }
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
        onDeleteSession={handleDeleteSession} // Pass the handler to Sidebar
      />
      <div className="app-main-content">
        <header className="App-header">
          <h1>Unreal Engine Knowledge Graph</h1>
        </header>
        <main className="main-content">
          <div className="main-controls-container">
            <div className="cypher-and-generator">
              <div className="cypher-query-container">
                <textarea 
                  value={cypherQuery}
                  onChange={(e) => setCypherQuery(e.target.value)}
                  placeholder="Enter Cypher query..."
                />
                <button>Execute</button> {/* This button's onClick will be handled by GraphVis */}
              </div>
              <CypherGenerator onGeneratedQuery={setCypherQuery} supabase={supabase} />
            </div>
            <div className="graph-controls">
              {/* These buttons' onClick will be handled by GraphVis */}
              <button>Force</button>
              <button>Radial</button>
              <button>Group by Label</button>
              <button>Reset View</button>
            </div>
          </div>
          {error && <div className="error-message">Error: {error}</div>}
          {isLoading && <ThinkingIndicator />}
          <GraphVisualization 
            supabase={supabase}
            graphData={graphData}
            setGraphData={setGraphData}
            activeSessionId={activeSessionId}
            fetchInitialData={() => fetchInitialData(supabase)}
            setIsLoading={setIsLoading}
            setError={setError}
            cypherQuery={cypherQuery}
            setCypherQuery={setCypherQuery}
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
