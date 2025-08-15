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
    <div 
      className="context-menu" 
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <ul>
        <li onClick={handleTraceUpstream}>追踪上游</li>
        <li onClick={handleTraceDownstream}>追踪下游</li>
        <li onClick={onClose}>关闭</li>
      </ul>
    </div>
  );
};

export default ContextMenu;