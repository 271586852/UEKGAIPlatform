import React from 'react';
import './ThinkingIndicator.css';

const ThinkingIndicator: React.FC = () => {
  return (
    <div className="thinking-indicator">
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="dot"></span>
    </div>
  );
};

export default ThinkingIndicator;