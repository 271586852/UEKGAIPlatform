'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SupabaseClient } from '@supabase/supabase-js';
import { GraphData, GraphNode, GraphLink } from '@/types';
import ContextMenu from './ContextMenu';
import './GraphVisualization.css';

// Define the shape of d3's simulation node, which includes x, y coordinates
interface SimulationNode extends GraphNode {
  x?: number;
  y?: number;
}

interface GraphVisualizationProps {
  supabase: SupabaseClient;
  graphData: GraphData;
  setGraphData: React.Dispatch<React.SetStateAction<GraphData>>;
  activeSessionId: string | null;
  layout: 'force' | 'radial';
  isAggregated: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function GraphVisualization({
  supabase,
  graphData,
  setGraphData,
  activeSessionId,
  layout,
  isAggregated,
  setIsLoading,
  setError,
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  // D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) {
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = svg.node()?.parentElement;
    if (!container) return;

    svg.selectAll('*').remove(); // Clear SVG for re-rendering

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg.attr('width', width).attr('height', height).attr('viewBox', [-width / 2, -height / 2, width, height]);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const linkedByIndex = new Map<string, Set<string>>();
    graphData.links.forEach(link => {
        const sourceId = (link.source as GraphNode).id ?? link.source as string;
        const targetId = (link.target as GraphNode).id ?? link.target as string;
        if (!linkedByIndex.has(sourceId)) linkedByIndex.set(sourceId, new Set());
        if (!linkedByIndex.has(targetId)) linkedByIndex.set(targetId, new Set());
        linkedByIndex.get(sourceId)!.add(targetId);
        linkedByIndex.get(targetId)!.add(sourceId);
    });

    const isConnected = (a: GraphNode, b: GraphNode) => {
        return linkedByIndex.get(a.id)?.has(b.id) || a.id === b.id;
    }

    const simulationNodes: SimulationNode[] = graphData.nodes.map(n => ({...n}));
    const simulationLinks = graphData.links.map(l => ({...l}));

    const simulation = d3.forceSimulation(simulationNodes)
        .force('link', d3.forceLink<SimulationNode, GraphLink>(simulationLinks).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-400));

    if (layout === 'radial') {
      const radius = Math.min(width, height) / 3;
      simulation
        .force('r', d3.forceRadial<SimulationNode>(d => isAggregated ? (d.group === 'center' ? 0 : radius) : radius).strength(0.7))
        .force('center', d3.forceCenter(0, 0));
    } else {
      simulation
        .force('r', null)
        .force('center', d3.forceCenter(0, 0));
    }

    const link = svg.append("g")
        .attr('class', 'links')
        .selectAll("line")
        .data(simulationLinks)
        .join("line");

    const node = svg.append("g")
        .attr('class', 'nodes')
        .selectAll("circle")
        .data(simulationNodes)
        .join("circle")
        .attr("r", 10)
        .attr("fill", d => color(isAggregated ? d.group || 'default' : d.type || 'default'))
        .on("click", (event, d) => {
          setSelectedNode(d);
          event.stopPropagation();
        })
        .on('contextmenu', (event, d) => {
            event.preventDefault();
            setContextMenu({ node: d, x: event.pageX, y: event.pageY });
            event.stopPropagation();
        })
        .on('mouseover', (_event, d) => setHoveredNode(d))
        .on('mouseout', () => setHoveredNode(null))
        .call(drag(simulation) as any);
        
    node.append("title").text(d => d.label);

    const labels = svg.append("g")
        .attr('class', 'labels')
        .selectAll("text")
        .data(simulationNodes)
        .join("text")
        .text(d => d.label)
        .attr('x', 12)
        .attr('y', 5);
        
    node.style('opacity', n => hoveredNode ? (isConnected(n, hoveredNode) ? 1 : 0.2) : 1);
    labels.style('opacity', l => hoveredNode ? (isConnected(l, hoveredNode) ? 1 : 0.2) : 1);
    link.style('opacity', o => hoveredNode ? (isConnected(o.source as SimulationNode, hoveredNode) && isConnected(o.target as SimulationNode, hoveredNode) ? 1 : 0.2) : 0.6);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x! + 12)
        .attr("y", d => d.y! + 5);
    });

  }, [graphData, layout, isAggregated, hoveredNode]);

  const handleTrace = async (direction: 'UPSTREAM' | 'DOWNSTREAM') => {
    if (!contextMenu) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('trace-graph', {
        body: { nodeId: contextMenu.node.id, direction },
      });
      if (error) throw error;
      if (data && data.nodes && data.links) {
        setGraphData(data);
      }
    } catch (err: any) {
      console.error('Failed to trace graph:', err);
      setError(`Failed to trace graph: ${err.message}`);
    } finally {
      setIsLoading(false);
      setContextMenu(null);
    }
  };

  const drag = (simulation: d3.Simulation<SimulationNode, undefined>) => {
    function dragstarted(event: d3.D3DragEvent<Element, SimulationNode, SimulationNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<Element, SimulationNode, SimulationNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<Element, SimulationNode, SimulationNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag<SVGCircleElement, SimulationNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  return (
    <div className="graph-container">
      <svg ref={svgRef}></svg>
      {contextMenu && (
        <ContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onTrace={handleTrace}
        />
      )}
      {selectedNode && (
        <div className={`sidebar ${selectedNode ? '' : 'hidden'}`}>
          <button onClick={() => setSelectedNode(null)} className="close-btn">×</button>
          <h2>Node Details</h2>
          <div className="node-info">
            <p><strong>ID:</strong> {selectedNode.id}</p>
            <p><strong>Label:</strong> {selectedNode.label}</p>
            <p><strong>Type:</strong> {selectedNode.type || 'N/A'}</p>
            <p><strong>Description:</strong> {selectedNode.description || 'No description available.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
