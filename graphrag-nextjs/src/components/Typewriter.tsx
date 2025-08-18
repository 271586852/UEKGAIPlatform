
import React, { useState, useEffect } from 'react';
import './Typewriter.css';

interface TypewriterProps {
  text: string;
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);
    let i = 0;
    const intervalId = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(intervalId);
        setIsComplete(true);
        if (onComplete) {
          onComplete();
        }
      }
    }, 20); 

    return () => clearInterval(intervalId);
  }, [text, onComplete]);

  return (
    <span className={`typewriter-text ${isComplete ? 'completed' : ''}`}>
      {displayedText}
      {!isComplete && <span className="cursor">|</span>}
    </span>
  );
};

export default Typewriter;