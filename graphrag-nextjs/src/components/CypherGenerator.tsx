import React, { useState } from 'react';

interface CypherGeneratorProps {
  onGeneratedQuery: (query: string) => void;
  // This prop will be used to pass the supabase client for making the function call
  supabase: any; 
}

export default function CypherGenerator({ onGeneratedQuery, supabase }: CypherGeneratorProps) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!naturalLanguageInput.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-cypher', {
        body: { question: naturalLanguageInput },
      });

      if (invokeError) throw invokeError;
      
      if (data.error) throw new Error(data.error);
      
      if (data.cypher.startsWith('ERROR:')) {
        setError(data.cypher);
      } else {
        onGeneratedQuery(data.cypher);
        setNaturalLanguageInput(''); // Clear input on success
      }

    } catch (e: any) {
      setError(`Failed to generate Cypher: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cypher-generator">
      <h4>Natural Language to Cypher</h4>
      <p>输入你的问题，Agent 将会为你生成相应的 Cypher 查询语句。</p>
      <div className="input-group">
        <input
          type="text"
          placeholder="例如: '查找所有关于图神经网络的论文'"
          value={naturalLanguageInput}
          onChange={(e) => setNaturalLanguageInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          disabled={isLoading}
        />
        <button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? '生成中...' : '生成'}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}