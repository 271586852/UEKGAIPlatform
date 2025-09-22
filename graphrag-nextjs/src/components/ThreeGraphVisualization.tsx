'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { forceSimulation as forceSimulation2d, forceLink as forceLink2d, forceManyBody as forceManyBody2d, forceCenter as forceCenter2d } from 'd3-force';
import { forceSimulation as forceSimulation3d, forceLink as forceLink3d, forceManyBody as forceManyBody3d, forceCenter as forceCenter3d } from 'd3-force-3d';
import { GraphData, GraphNode } from '@/types';

interface ThreeGraphVisualizationProps {
  graphData: GraphData;
  setSelectedNode: (node: GraphNode | null) => void;
  setContextMenu: (menu: { node: GraphNode; x: number; y: number } | null) => void;
}

export default function ThreeGraphVisualization({
  graphData,
  setSelectedNode,
  setContextMenu,
}: ThreeGraphVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const is3D = true; // Keep this true for 3D simulation
  const controlsRef = useRef<OrbitControls>(); // Ref to store controls instance

  useEffect(() => {
    if (!mountRef.current || !graphData.nodes.length) {
        return;
    }

    const mount = mountRef.current;
    
    // Clean up previous canvas if any
    while (mount.firstChild) {
        mount.removeChild(mount.firstChild);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Set a dark background color

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 3000);
    camera.position.z = 200;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 200);
    scene.add(directionalLight);


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls; // Store controls in ref

    const nodeObjects = new Map<string, THREE.Mesh>();
    const linkObjects = new Map<string, THREE.Mesh>();
    
    const color = new THREE.Color();
    const colorScale = (d: GraphNode) => {
        // A more aesthetic color palette
        const typeColorMap: { [key: string]: string } = {
            'Unreal Class': '#00bfff',  // DeepSkyBlue
            'Function': '#ff6347',      // Tomato
            'Struct': '#32cd32',        // LimeGreen
            'Enum': '#ffd700',          // Gold
            'Module': '#9370db',        // MediumPurple
            'Plugin': '#ff69b4',        // HotPink
            'Property': '#87ceeb',      // SkyBlue
            'default': '#a9a9a9'        // DarkGray
        };
        return typeColorMap[d.type || 'default'] || typeColorMap['default'];
    };

    graphData.nodes.forEach(node => {
      const geometry = new THREE.SphereGeometry(2.5, 32, 32); // Increased segments for smoother spheres
      color.set(colorScale(node));
      // Use MeshStandardMaterial for realistic lighting
      const material = new THREE.MeshStandardMaterial({ 
          color,
          metalness: 0.3,
          roughness: 0.6
      });
      const sphere = new THREE.Mesh(geometry, material);
      (sphere.userData as any).node = node;
      nodeObjects.set(node.id, sphere);
      scene.add(sphere);
    });

    // Use Cylinders for links to give them volume
    const linkMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source as string;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target as string;
        
        const geometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8); // Radius, height, segments
        const cylinder = new THREE.Mesh(geometry, linkMaterial);
        linkObjects.set(`${sourceId}-${targetId}`, cylinder);
        scene.add(cylinder);
    });

    const simulation = is3D ? forceSimulation3d(graphData.nodes as any)
      .force('link', forceLink3d(graphData.links).id((d: any) => d.id).distance(50))
      .force('charge', forceManyBody3d().strength(-100))
      .force('center', forceCenter3d(0, 0, 0))
      : forceSimulation2d(graphData.nodes as any)
      .force('link', forceLink2d(graphData.links).id((d: any) => d.id).distance(50))
      .force('charge', forceManyBody2d().strength(-100))
      .force('center', forceCenter2d(0, 0));

    simulation.on('tick', () => {
      nodeObjects.forEach((sphere, id) => {
        const node = graphData.nodes.find(n => n.id === id);
        if (node) {
          sphere.position.set(node.x ?? 0, node.y ?? 0, (node as any).z ?? 0);
        }
      });

      // Update cylinder links
      const sourcePos = new THREE.Vector3();
      const targetPos = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);

      linkObjects.forEach((cylinder, key) => {
        const [sourceId, targetId] = key.split('-');
        const sourceNode = graphData.nodes.find(n => n.id === sourceId);
        const targetNode = graphData.nodes.find(n => n.id === targetId);
        if (sourceNode && targetNode) {
            sourcePos.set(sourceNode.x ?? 0, sourceNode.y ?? 0, (sourceNode as any).z ?? 0);
            targetPos.set(targetNode.x ?? 0, targetNode.y ?? 0, (targetNode as any).z ?? 0);

            const distance = sourcePos.distanceTo(targetPos);
            cylinder.position.copy(sourcePos).add(targetPos).divideScalar(2);
            cylinder.scale.y = distance;
            cylinder.quaternion.setFromUnitVectors(up, targetPos.clone().sub(sourcePos).normalize());
        }
      });
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let draggedNode: GraphNode | null = null;
    
    // State for different drag modes
    let dragMode: 'xy' | 'z' | null = null;
    let plane = new THREE.Plane();
    let intersection = new THREE.Vector3();
    let offset = new THREE.Vector3();
    let initialY = 0;
    let initialDistance = 0;


    // Variables to distinguish click from drag
    let pointerDownTime = 0;
    const clickThreshold = 200; // ms
    let pointerDownPosition = new THREE.Vector2();


    const handlePointerDown = (event: PointerEvent) => {
      pointerDownTime = Date.now();
      pointerDownPosition.set(event.clientX, event.clientY);
      
      const { top, left, width, height } = mount.getBoundingClientRect();
      mouse.x = ((event.clientX - left) / width) * 2 - 1;
      mouse.y = -((event.clientY - top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(nodeObjects.values()));

      if (intersects.length > 0) {
        if(controlsRef.current) controlsRef.current.enabled = false;
        draggedNode = (intersects[0].object.userData as any).node as GraphNode;

        simulation.alpha(1).restart();
        if(draggedNode) {
          (draggedNode as any).fx = draggedNode.x;
          (draggedNode as any).fy = draggedNode.y;
          (draggedNode as any).fz = (draggedNode as any).z;
        }

        if (event.button === 0) { // Left Click for XY Drag
          dragMode = 'xy';
          plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(plane.normal), intersects[0].point);
          if(raycaster.ray.intersectPlane(plane, intersection)) {
              offset.copy(intersects[0].object.position).sub(intersection);
          }
        } else if (event.button === 2) { // Right Click for Z Drag
          dragMode = 'z';
          initialY = event.clientY;
          initialDistance = camera.position.distanceTo(intersects[0].object.position);
        }
      }
    };
    
    const handlePointerMove = (event: PointerEvent) => {
        if (!draggedNode) return;

        const { top, left, width, height } = mount.getBoundingClientRect();
        mouse.x = ((event.clientX - left) / width) * 2 - 1;
        mouse.y = -((event.clientY - top) / height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (dragMode === 'xy') {
            if (raycaster.ray.intersectPlane(plane, intersection)) {
                const newPos = intersection.add(offset);
                (draggedNode as any).fx = newPos.x;
                (draggedNode as any).fy = newPos.y;
                (draggedNode as any).fz = (draggedNode as any).z; // Keep Z constant
            }
        } else if (dragMode === 'z') {
            const deltaY = event.clientY - initialY;
            let newDistance = initialDistance - deltaY * 0.2; // Sensitivity factor
            newDistance = Math.max(10, Math.min(1000, newDistance)); // Clamp distance

            const newPos = new THREE.Vector3();
            raycaster.ray.at(newDistance, newPos);
            
            (draggedNode as any).fx = newPos.x;
            (draggedNode as any).fy = newPos.y;
            (draggedNode as any).fz = newPos.z;
        }
    };

    const handlePointerUp = (event: PointerEvent) => {
        const timeElapsed = Date.now() - pointerDownTime;
        const distanceMoved = pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY));

        if (draggedNode && timeElapsed < clickThreshold && distanceMoved < 5) {
            // It's a CLICK
            if (event.button === 0) { // Left click
                setSelectedNode(draggedNode);
            } else if (event.button === 2) { // Right click
                const { top, left } = mount.getBoundingClientRect();
                setContextMenu({
                    node: draggedNode,
                    x: event.clientX - left,
                    y: event.clientY - top,
                });
            }
        } else if (!draggedNode && timeElapsed < clickThreshold && distanceMoved < 5) {
             // Clicked on empty space
            setSelectedNode(null);
            setContextMenu(null);
        }


        if (draggedNode) {
            // Unfix the node (end of drag)
            (draggedNode as any).fx = null;
            (draggedNode as any).fy = null;
            (draggedNode as any).fz = null;
            
            simulation.alphaTarget(0); // "Cool down" simulation
        }
        
        if(controlsRef.current) controlsRef.current.enabled = true; // Re-enable camera controls
        draggedNode = null;
        dragMode = null;
    };


    const handleInteraction = (event: PointerEvent) => {
      event.preventDefault();

      const { top, left, width, height } = mount.getBoundingClientRect();
      mouse.x = ((event.clientX - left) / width) * 2 - 1;
      mouse.y = -((event.clientY - top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(nodeObjects.values()));

      if (intersects.length > 0) {
        const intersectedNode = (intersects[0].object.userData as any).node as GraphNode;
        if (event.button === 0) { // Left click
          setSelectedNode(intersectedNode);
        } else if (event.button === 2) { // Right click
          setContextMenu({
            node: intersectedNode,
            x: event.clientX - left,
            y: event.clientY - top,
          });
        }
      } else {
        setSelectedNode(null);
        setContextMenu(null);
      }
    };
    
    // Add new event listeners for drag
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent default right-click menu


    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('contextmenu', (e) => e.preventDefault());
      resizeObserver.unobserve(mount);
      if(renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [graphData, setSelectedNode, setContextMenu, is3D]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
