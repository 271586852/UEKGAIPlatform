import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { createClient } from '@supabase/supabase-js';
import type { GraphNode, GraphLink } from '../types';
import './GraphVisualization.css';
import ContextMenu from './ContextMenu';

// 仅在此处定义一次 Supabase 客户端
const SUPABASE_URL = 'https://nqmdoblaghggzdzndjft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWRvYmxhZ2hnZ3pkem5kamZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODE0NDUsImV4cCI6MjA2OTI1NzQ0NX0.N-B7te5FVDJXbdNJ9A6mVX5P85h6sGYYV8i4lkr2Z50';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface GraphVisualizationProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (node: GraphNode) => void;
  setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
  setLinks: React.Dispatch<React.SetStateAction<GraphLink[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  layout: 'force' | 'radial';
  isAggregated: boolean;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  nodes,
  links,
  onNodeClick,
  setNodes,
  setLinks,
  setIsLoading,
  setError,
  layout,
  isAggregated,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      // Close context menu if clicked outside
      if (contextMenu && !(event.target as HTMLElement).closest('.context-menu')) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);


  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean slate

    if (!nodes.length) return; // Don't render if no data

    // --- Grouping & Colors ---
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const groups = isAggregated ? d3.group(nodes, d => d.group || 'default') : null;

    // --- Highlighting Logic ---
    const linkedByIndex = new Map<string, Set<string>>();
    links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        if (!linkedByIndex.has(sourceId)) linkedByIndex.set(sourceId, new Set());
        if (!linkedByIndex.has(targetId)) linkedByIndex.set(targetId, new Set());
        linkedByIndex.get(sourceId)!.add(targetId);
        linkedByIndex.get(targetId)!.add(sourceId);
    });

    const isConnected = (a: GraphNode, b: GraphNode) => {
        return linkedByIndex.get(a.id)?.has(b.id) || a.id === b.id;
    }

    const width = svgRef.current.parentElement!.clientWidth;
    const height = svgRef.current.parentElement!.clientHeight;
    
    svg.attr('width', width).attr('height', height).attr('viewBox', [-width / 2, -height / 2, width, height]);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-400));

    if (layout === 'radial') {
      const radius = Math.min(width, height) / 3;
      simulation
        .force('r', d3.forceRadial(radius).strength(0.7))
        .force('center', d3.forceCenter(0, 0));
    } else {
      simulation
        .force('r', null)
        .force('center', d3.forceCenter(0, 0));
    }

    const hullGroup = svg.append('g').attr('class', 'hulls');
    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const labelGroup = svg.append('g').attr('class', 'labels');

    const hull = hullGroup
      .selectAll('path')
      .data(groups ? Array.from(groups.entries()) : [])
      .join('path')
      .attr('fill', d => color(d[0]))
      .attr('stroke', d => color(d[0]))
      .attr('stroke-width', 40)
      .attr('stroke-linejoin', 'round')
      .style('opacity', 0.2);

    const link = linkGroup
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .style('opacity', d => hoveredNode ? (isConnected(d.source as GraphNode, hoveredNode) && isConnected(d.target as GraphNode, hoveredNode) ? 1 : 0.2) : 1);

    const node = nodeGroup
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', 15)
        .attr('fill', d => (isAggregated ? color(d.group || 'default') : '#69b3a2'))
        .style('opacity', d => hoveredNode ? (isConnected(d, hoveredNode) ? 1 : 0.2) : 1)
        .on('click', (event, d) => {
            onNodeClick(d);
            event.stopPropagation();
        })
        .on('mouseover', (event, d) => setHoveredNode(d))
        .on('mouseout', () => setHoveredNode(null))
        .on('contextmenu', (event, d) => {
            event.preventDefault();
            event.stopPropagation();
            setContextMenu({ node: d, x: event.pageX, y: event.pageY });
        })
        .call(drag(simulation) as any);

    node.append('title').text(d => d.name);

    const labels = labelGroup
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.name)
        .attr('x', 18)
        .attr('y', 6)
        .attr('font-size', '12px')
        .attr('fill', '#333')
        .style('opacity', d => hoveredNode ? (isConnected(d, hoveredNode) ? 1 : 0.2) : 1);

    simulation.on('tick', () => {
        link
            .attr('x1', d => (d.source as GraphNode).x!)
            .attr('y1', d => (d.source as GraphNode).y!)
            .attr('x2', d => (d.target as GraphNode).x!)
            .attr('y2', d => (d.target as GraphNode).y!);
        node.attr('cx', d => d.x!).attr('cy', d => d.y!);
        labels.attr('x', d => d.x! + 18).attr('y', d => d.y! + 6);

        if (isAggregated && hull) {
          hull.attr('d', d => {
            const points: [number, number][] = d[1].map(node => [node.x!, node.y!]);
            if (points.length < 3) return null;
            const hullPoints = d3.polygonHull(points);
            return hullPoints ? `M${hullPoints.join('L')}Z` : null;
          });
        }
    });

  }, [nodes, links, hoveredNode, layout, isAggregated]);

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
        setNodes(data.nodes);
        setLinks(data.links);
      }
    } catch (err: any) {
      console.error('Failed to trace graph:', err);
      setError(`Failed to trace graph: ${err.message}`);
    } finally {
      setIsLoading(false);
      setContextMenu(null);
    }
  };

  const drag = (simulation: d3.Simulation<GraphNode, undefined>) => {
    // drag functions remain the same
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    return d3.drag<SVGCircleElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
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
    </div>
  );
};

export default GraphVisualization; 