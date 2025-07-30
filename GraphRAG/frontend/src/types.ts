import * as d3 from 'd3';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  group?: string;
  // 在这里可以添加更多你希望在侧边栏展示的属性
  // 例如: description, file_path, etc.
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
} 