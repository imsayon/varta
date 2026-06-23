'use client';

import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Zap, Mail, MessageSquare, Clock, Server, Check, ArrowRight } from 'lucide-react';
import styles from './WorkflowEditor.module.css';
import { toast } from 'sonner';

// ─── Custom Node Components ───

const TriggerNode = ({ data }: { data: any }) => {
  return (
    <div className={`${styles.node} ${styles.triggerNode}`}>
      <div className={styles.nodeHeader}>
        <div className={styles.iconCircle} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
          <Zap size={14} />
        </div>
        <span>{data.label}</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.subText}>Event: {data.event}</div>
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
};

const ActionNode = ({ data }: { data: any }) => {
  const Icon = data.type === 'email' ? Mail : MessageSquare;
  const color = data.type === 'email' ? '#10b981' : '#3b82f6';
  
  return (
    <div className={`${styles.node} ${styles.actionNode}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.nodeHeader}>
        <div className={styles.iconCircle} style={{ background: `${color}33`, color: color }}>
          <Icon size={14} />
        </div>
        <span>{data.label}</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.subText}>{data.description}</div>
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
};

const LogicNode = ({ data }: { data: any }) => {
  const Icon = data.type === 'delay' ? Clock : Server;
  const color = data.type === 'delay' ? '#eab308' : '#a855f7';

  return (
    <div className={`${styles.node} ${styles.logicNode}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.nodeHeader}>
        <div className={styles.iconCircle} style={{ background: `${color}33`, color: color }}>
          <Icon size={14} />
        </div>
        <span>{data.label}</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.subText}>{data.description}</div>
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
};

// ─── Initial Data ───

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 50, y: 200 },
    data: { label: 'Trigger', event: 'user.signup' },
  },
  {
    id: 'logic-1',
    type: 'logic',
    position: { x: 350, y: 200 },
    data: { label: 'Delay', type: 'delay', description: 'Wait 1 hour' },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 650, y: 200 },
    data: { label: 'Send Email', type: 'email', description: 'Welcome Email Template' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'logic-1', animated: true, style: { stroke: '#94a3b8' } },
  { id: 'e2-3', source: 'logic-1', target: 'action-1', animated: true, style: { stroke: '#94a3b8' } },
];

// ─── Main Editor Component ───

export function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)),
    [setEdges]
  );

  const onSave = () => {
    // In a real implementation, we'd save the AST to the backend here
    console.log('Saved Workflow AST:', { nodes, edges });
    toast.success('Workflow saved successfully!');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Visual Workflow Builder</h1>
          <p className={styles.subtitle}>Drag and drop components to orchestrate your notification pipelines.</p>
        </div>
        <button className={styles.saveBtn} onClick={onSave}>
          <Check size={16} /> Save Pipeline
        </button>
      </div>

      <div className={styles.editorWrapper}>
        {/* Node Palette */}
        <div className={styles.palette}>
          <h3 className={styles.paletteTitle}>Nodes</h3>
          
          <div className={styles.paletteSection}>
            <h4>Triggers</h4>
            <div className={styles.paletteItem}>
              <Zap size={14} color="#f59e0b" /> Custom Event
            </div>
          </div>
          
          <div className={styles.paletteSection}>
            <h4>Logic</h4>
            <div className={styles.paletteItem}>
              <Clock size={14} color="#eab308" /> Delay
            </div>
            <div className={styles.paletteItem}>
              <Server size={14} color="#a855f7" /> Digest
            </div>
            <div className={styles.paletteItem}>
              <ArrowRight size={14} color="#3b82f6" /> Branch
            </div>
          </div>
          
          <div className={styles.paletteSection}>
            <h4>Actions</h4>
            <div className={styles.paletteItem}>
              <Mail size={14} color="#10b981" /> Email
            </div>
            <div className={styles.paletteItem}>
              <MessageSquare size={14} color="#3b82f6" /> SMS
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="varta-theme"
          >
            <Background color="#334155" gap={16} />
            <Controls />
            <MiniMap 
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#f59e0b';
                if (n.type === 'action') return '#10b981';
                return '#a855f7';
              }} 
              style={{ backgroundColor: '#0f172a' }}
              maskColor="rgba(0,0,0,0.1)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function WorkflowEditorProvider() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}
