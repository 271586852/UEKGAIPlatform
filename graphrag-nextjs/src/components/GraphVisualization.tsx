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
  fetchInitialData: () => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function GraphVisualization({
  supabase,
  graphData,
  setGraphData,
  activeSessionId,
  fetchInitialData,
  setIsLoading,
  setError,
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // Use ref for synchronous access in event handlers

  const [layout, setLayout] = useState<'force' | 'radial'>('force');
  const [isAggregated, setIsAggregated] = useState(false);

  // D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) {
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }
  
    const container = containerRef.current;
    if (!container) return;
  
    const svg = d3.select(svgRef.current);
  
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        svg.attr('width', width).attr('height', height);
        // Recenter the simulation
        const simulation = d3.forceSimulation()
          .force('center', d3.forceCenter(width / 2, height / 2));
        simulation.restart();
      }
    });
  
    if (container) {
      resizeObserver.observe(container);
    }

    svg.selectAll('*').remove(); // Clear SVG for re-rendering
    
    const width = container.clientWidth;
    const height = container.clientHeight;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8]) // Zoom range from 10% to 800%
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.attr('width', width).attr('height', height)
       .attr('viewBox', [0, 0, width, height])
       .call(zoom);

    const g = svg.append("g");

    // Define arrow markers for directed links
    g.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 19) // Controls the distance of the arrowhead from the node
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');

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
        .force('center', d3.forceCenter(width / 2, height / 2));
    }

    const link = g.append("g")
        .attr('class', 'links')
        .selectAll("line")
        .data(simulationLinks)
        .join("line")
        .attr('marker-end', 'url(#arrowhead)'); // Apply the arrowhead to each link

    const node = g.append("g")
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
            if (containerRef.current) {
              const containerRect = containerRef.current.getBoundingClientRect();
              setContextMenu({ 
                node: d, 
                x: event.clientX - containerRect.left, 
                y: event.clientY - containerRect.top 
              });
            } else {
              // Fallback for safety
              setContextMenu({ node: d, x: event.clientX, y: event.clientY });
            }
            event.stopPropagation();
        })
        .on('mouseover', (_event, d) => {
          if (!isDraggingRef.current) {
            setHoveredNode(d);
          }
        })
        .on('mouseout', () => {
          if (!isDraggingRef.current) {
            setHoveredNode(null);
          }
        })
        .call(drag(simulation) as any);
        
    node.append("title").text(d => d.label);

    const labels = g.append("g")
        .attr('class', 'labels')
        .selectAll("text")
        .data(simulationNodes)
        .join("text")
        .text(d => d.label)
        .attr('x', 12)
        .attr('y', 5);

    const nodeRadius = 10;

    simulation.on("tick", () => {
      link.each(function(d) {
        const source = d.source as SimulationNode;
        const target = d.target as SimulationNode;

        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Avoid division by zero
        if (distance === 0) return;

        const newTargetX = target.x! - (dx / distance) * nodeRadius;
        const newTargetY = target.y! - (dy / distance) * nodeRadius;
        
        d3.select(this)
          .attr("x1", source.x!)
          .attr("y1", source.y!)
          .attr("x2", newTargetX)
          .attr("y2", newTargetY);
      });

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x! + 12)
        .attr("y", d => d.y! + 5);
    });

    return () => {
      if (container) {
        resizeObserver.unobserve(container);
      }
    };
  }, [graphData, layout, isAggregated]);

  // Separate useEffect for hover effects to avoid re-rendering the entire graph
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll('.nodes circle');
    const labels = svg.selectAll('.labels text');
    const links = svg.selectAll('.links line');

    if (hoveredNode) {
      // Create a map for connected nodes for efficient lookup
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
      };

      nodes.style('opacity', (n: any) => isConnected(n, hoveredNode) ? 1 : 0.2);
      labels.style('opacity', (l: any) => isConnected(l, hoveredNode) ? 1 : 0.2);
      links.style('opacity', (o: any) => {
        const source = o.source as SimulationNode;
        const target = o.target as SimulationNode;
        return isConnected(source, hoveredNode) && isConnected(target, hoveredNode) ? 1 : 0.2;
      });
    } else {
      // Reset all opacities when no node is hovered
      nodes.style('opacity', 1);
      labels.style('opacity', 1);
      links.style('opacity', 0.6);
    }
  }, [hoveredNode, graphData.links]);

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
    } catch (err: unknown) {
      console.error('Failed to trace graph:', err);
      setError(`Failed to trace graph: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      isDraggingRef.current = true;
      setIsDragging(true);
    }

    function dragged(event: d3.D3DragEvent<Element, SimulationNode, SimulationNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<Element, SimulationNode, SimulationNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setHoveredNode(null); // Explicitly clear hovered node on drag end
    }

    return d3.drag<SVGCircleElement, SimulationNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  return (
    <div className="graph-container" ref={containerRef} onClick={() => setContextMenu(null)}>
      <div className="graph-controls">
        <button onClick={() => setLayout('force')} disabled={layout === 'force'}>Force</button>
        <button onClick={() => setLayout('radial')} disabled={layout === 'radial'}>Radial</button>
        <button onClick={() => setIsAggregated(!isAggregated)}>
          {isAggregated ? 'Ungroup' : 'Group by Label'}
        </button>
        <button onClick={fetchInitialData}>Reset View</button>
      </div>
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
