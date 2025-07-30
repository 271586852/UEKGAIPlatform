'use client';

import React from 'react';
import type { GraphNode } from '@/types';
import './ContextMenu.css';

interface ContextMenuProps {
  node: GraphNode;
  x: number;
  y: number;
  onClose: () => void;
  onTrace: (direction: 'UPSTREAM' | 'DOWNSTREAM') => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ node, x, y, onClose, onTrace }) => {
  const handleTraceUpstream = () => {
    onTrace('UPSTREAM');
    onClose();
  };

  const handleTraceDownstream = () => {
    onTrace('DOWNSTREAM');
    onClose();
  };

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <ul>
        <li onClick={handleTraceUpstream}>Trace Upstream</li>
        <li onClick={handleTraceDownstream}>Trace Downstream</li>
        <li onClick={onClose}>Close</li>
      </ul>
    </div>
  );
};

export default ContextMenu;