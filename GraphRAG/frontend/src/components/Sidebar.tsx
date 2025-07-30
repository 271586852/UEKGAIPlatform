import React from 'react';
import type { GraphNode } from '../types';
import './Sidebar.css';

interface SidebarProps {
  node: GraphNode | null;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ node, onClose }) => {
  if (!node) {
    return null;
  }

  return (
    <div className="sidebar">
      <button className="close-btn" onClick={onClose}>×</button>
      <h2>Node Details</h2>
      <div className="node-info">
        <p><strong>ID:</strong> {node.id}</p>
        <p><strong>Name:</strong> {node.name}</p>
        {/* 在这里可以添加节点的其他详细信息 */}
      </div>
    </div>
  );
};

export default Sidebar; 