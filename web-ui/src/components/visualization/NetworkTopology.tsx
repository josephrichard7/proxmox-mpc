import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Paper,
  Group,
  Text,
  ActionIcon,
  Select,
  Button,
  Modal,
  Stack,
  Badge,
  Card,
  Slider,
  Switch,
  Alert,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconSettings,
  IconMaximize,
  IconServer,
  IconContainer,
  IconNetworking,
  IconDatabase,
  IconAlertCircle,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';
import * as d3 from 'd3';

export interface NetworkNode {
  id: string;
  name: string;
  type: 'node' | 'vm' | 'container' | 'network' | 'storage';
  status: 'online' | 'offline' | 'running' | 'stopped' | 'error';
  group: number;
  properties: {
    cpu?: number;
    memory?: number;
    storage?: number;
    ip?: string;
    network?: string;
    uptime?: number;
  };
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'physical' | 'virtual' | 'storage' | 'network';
  strength: number;
  properties: {
    bandwidth?: string;
    latency?: number;
    protocol?: string;
  };
}

export interface NetworkTopologyProps {
  /** Network nodes data */
  nodes: NetworkNode[];
  /** Network links data */
  links: NetworkLink[];
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Whether the visualization is interactive */
  interactive?: boolean;
  /** Callback when a node is selected */
  onNodeSelect?: (node: NetworkNode) => void;
  /** Callback when the topology is updated */
  onTopologyUpdate?: (nodes: NetworkNode[], links: NetworkLink[]) => void;
}

/**
 * Network Topology Visualization component
 * Provides interactive D3.js-based network topology visualization
 */
export function NetworkTopology({
  nodes = [],
  links = [],
  width = 800,
  height = 600,
  interactive = true,
  onNodeSelect,
  onTopologyUpdate,
}: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [layoutType, setLayoutType] = useState('force');
  const [showLabels, setShowLabels] = useState(true);
  const [colorByStatus, setColorByStatus] = useState(true);
  
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [nodeModalOpened, { open: openNodeModal, close: closeNodeModal }] = useDisclosure(false);

  const notifications = useNotifications();

  // Color schemes
  const nodeColors = {
    node: '#2563eb',      // blue
    vm: '#059669',        // emerald
    container: '#dc2626', // red
    network: '#ea580c',   // orange
    storage: '#9333ea',   // violet
  };

  const statusColors = {
    online: '#10b981',    // emerald
    offline: '#ef4444',   // red
    running: '#10b981',   // emerald
    stopped: '#f59e0b',   // amber
    error: '#ef4444',     // red
  };

  const getNodeColor = useCallback((node: NetworkNode) => {
    if (colorByStatus) {
      return statusColors[node.status] || '#6b7280';
    }
    return nodeColors[node.type] || '#6b7280';
  }, [colorByStatus]);

  const getNodeSize = useCallback((node: NetworkNode) => {
    switch (node.type) {
      case 'node': return 12;
      case 'vm': return 10;
      case 'container': return 8;
      case 'network': return 8;
      case 'storage': return 8;
      default: return 6;
    }
  }, []);

  const getNodeIcon = useCallback((node: NetworkNode) => {
    switch (node.type) {
      case 'node': return '🖥️';
      case 'vm': return '💻';
      case 'container': return '📦';
      case 'network': return '🌐';
      case 'storage': return '💾';
      default: return '⚫';
    }
  }, []);

  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    // Create container for zoomable content
    const container = svg.append('g').attr('class', 'container');

    // Initialize simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    simulationRef.current = simulation;

    // Create links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#6b7280')
      .attr('stroke-width', (d) => d.strength * 2)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group');

    // Add circles for nodes
    node.append('circle')
      .attr('r', getNodeSize)
      .attr('fill', getNodeColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', interactive ? 'pointer' : 'default');

    // Add labels
    if (showLabels) {
      node.append('text')
        .text((d) => d.name)
        .attr('dx', 15)
        .attr('dy', 4)
        .style('font-size', '12px')
        .style('fill', '#374151')
        .style('pointer-events', 'none');
    }

    // Add icons (using emoji for simplicity)
    node.append('text')
      .text(getNodeIcon)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('font-size', '16px')
      .style('pointer-events', 'none');

    // Add interactivity
    if (interactive) {
      // Drag behavior
      const drag = d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          // Keep nodes fixed in place after dragging
          // d.fx = null;
          // d.fy = null;
        });

      node.call(drag as any);

      // Click behavior
      node.on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        if (onNodeSelect) {
          onNodeSelect(d);
        }
        openNodeModal();
      });

      // Hover behavior
      node.on('mouseover', function(event, d) {
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', getNodeSize(d) * 1.5);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', getNodeSize(d));
      });
    }

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

  }, [nodes, links, width, height, interactive, showLabels, colorByStatus, onNodeSelect, getNodeColor, getNodeSize, getNodeIcon]);

  useEffect(() => {
    initializeVisualization();
    
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [initializeVisualization]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1.5
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1 / 1.5
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current && simulationRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(500).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      );
      simulationRef.current.alpha(1).restart();
      setZoomLevel(1);
    }
  };

  const handleRefresh = () => {
    initializeVisualization();
    notifications.show({
      title: 'Topology Refreshed',
      message: 'Network topology has been updated with latest data',
      color: 'green',
    });
  };

  const nodeStats = {
    total: nodes.length,
    online: nodes.filter(n => n.status === 'online' || n.status === 'running').length,
    offline: nodes.filter(n => n.status === 'offline' || n.status === 'stopped').length,
    error: nodes.filter(n => n.status === 'error').length,
  };

  return (
    <Stack gap="md">
      {/* Controls */}
      <Paper p="sm" withBorder>
        <Group justify="space-between">
          <Group>
            <Text size="sm" fw={500}>Network Topology</Text>
            <Badge size="sm" color="blue">{nodeStats.total} nodes</Badge>
            <Badge size="sm" color="green">{nodeStats.online} online</Badge>
            {nodeStats.error > 0 && <Badge size="sm" color="red">{nodeStats.error} errors</Badge>}
          </Group>
          
          <Group gap="xs">
            <Text size="xs" c="dimmed">Zoom: {Math.round(zoomLevel * 100)}%</Text>
            <ActionIcon variant="light" size="sm" onClick={handleZoomIn}>
              <IconZoomIn size={14} />
            </ActionIcon>
            <ActionIcon variant="light" size="sm" onClick={handleZoomOut}>
              <IconZoomOut size={14} />
            </ActionIcon>
            <ActionIcon variant="light" size="sm" onClick={handleReset}>
              <IconRefresh size={14} />
            </ActionIcon>
            <ActionIcon variant="light" size="sm" onClick={openSettings}>
              <IconSettings size={14} />
            </ActionIcon>
            <Button size="xs" onClick={handleRefresh}>
              Refresh
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Visualization */}
      <Paper withBorder style={{ position: 'relative' }}>
        {nodes.length === 0 ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="No Network Data"
            style={{ margin: '2rem' }}
          >
            No network topology data available. Ensure your infrastructure is synchronized.
          </Alert>
        ) : (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ border: '1px solid #e9ecef', cursor: 'grab' }}
          />
        )}
      </Paper>

      {/* Legend */}
      <Paper p="sm" withBorder>
        <Text size="sm" fw={500} mb="xs">Legend</Text>
        <Group gap="lg">
          <Group gap="xs">
            <Text size="xs" fw={500}>Node Types:</Text>
            {Object.entries(nodeColors).map(([type, color]) => (
              <Group key={type} gap={4}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
                <Text size="xs">{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </Group>
            ))}
          </Group>
          
          <Group gap="xs">
            <Text size="xs" fw={500}>Status:</Text>
            {Object.entries(statusColors).map(([status, color]) => (
              <Group key={status} gap={4}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
                <Text size="xs">{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
              </Group>
            ))}
          </Group>
        </Group>
      </Paper>

      {/* Settings Modal */}
      <Modal opened={settingsOpened} onClose={closeSettings} title="Topology Settings">
        <Stack gap="md">
          <Switch
            label="Show Labels"
            description="Display node names next to nodes"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.currentTarget.checked)}
          />
          
          <Switch
            label="Color by Status"
            description="Color nodes by their status instead of type"
            checked={colorByStatus}
            onChange={(e) => setColorByStatus(e.currentTarget.checked)}
          />

          <Select
            label="Layout Type"
            description="Choose the visualization layout algorithm"
            value={layoutType}
            onChange={(value) => setLayoutType(value || 'force')}
            data={[
              { value: 'force', label: 'Force-directed' },
              { value: 'circular', label: 'Circular' },
              { value: 'hierarchical', label: 'Hierarchical' },
            ]}
          />

          <Group justify="flex-end">
            <Button onClick={() => {
              closeSettings();
              initializeVisualization();
            }}>
              Apply Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Node Details Modal */}
      <Modal
        opened={nodeModalOpened}
        onClose={closeNodeModal}
        title={selectedNode ? `${selectedNode.name} Details` : 'Node Details'}
        size="md"
      >
        {selectedNode && (
          <Stack gap="md">
            <Group>
              <Text size="sm" fw={500}>Type:</Text>
              <Badge color={nodeColors[selectedNode.type] || 'gray'}>
                {selectedNode.type.toUpperCase()}
              </Badge>
            </Group>

            <Group>
              <Text size="sm" fw={500}>Status:</Text>
              <Badge color={statusColors[selectedNode.status] || 'gray'}>
                {selectedNode.status.toUpperCase()}
              </Badge>
            </Group>

            {selectedNode.properties.ip && (
              <Group>
                <Text size="sm" fw={500}>IP Address:</Text>
                <Text size="sm" ff="monospace">{selectedNode.properties.ip}</Text>
              </Group>
            )}

            {selectedNode.properties.cpu !== undefined && (
              <Group>
                <Text size="sm" fw={500}>CPU Usage:</Text>
                <Text size="sm">{selectedNode.properties.cpu}%</Text>
              </Group>
            )}

            {selectedNode.properties.memory !== undefined && (
              <Group>
                <Text size="sm" fw={500}>Memory:</Text>
                <Text size="sm">{selectedNode.properties.memory} MB</Text>
              </Group>
            )}

            {selectedNode.properties.uptime !== undefined && (
              <Group>
                <Text size="sm" fw={500}>Uptime:</Text>
                <Text size="sm">{Math.floor(selectedNode.properties.uptime / 3600)} hours</Text>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}