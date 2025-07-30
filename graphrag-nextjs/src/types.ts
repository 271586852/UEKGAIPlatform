import * as d3 from 'd3';

/**
 * Extends d3's SimulationNodeDatum to include application-specific properties.
 * This is used for nodes in the graph visualization.
 */
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type?: string;
  description?: string;
  group?: string; // Used for coloring nodes when aggregated
}

/**
 * Extends d3's SimulationLinkDatum to include application-specific properties.
 * The source and target properties will be populated by d3 with GraphNode objects
 * after the simulation starts.
 */
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  label: string;
}

/**
 * Represents the overall structure of the graph data.
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Represents a single chat session in the history sidebar.
 */
export interface ChatSession {
  session_id: string;
  first_message: string;
  last_updated: string;
}
