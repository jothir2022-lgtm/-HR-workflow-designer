// ============================================================
// HR WORKFLOW DESIGNER — Tredence Studio Case Study
// Jothi.R - Full stack Engineering Intern
// Architecture: Custom hooks | Modular nodes | Mock API layer
// Theme: Light editorial | Playfair Display + IBM Plex Mono
// Default workflow: Leave Approval Process
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
  getBezierPath,
  BaseEdge,
} from "reactflow";
import "reactflow/dist/style.css";

// ─────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS & TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────

/** @typedef {'startNode'|'taskNode'|'approvalNode'|'automatedNode'|'endNode'} NodeType */

const NODE_META = {
  startNode:     { label: "Trigger",    icon: "▷", color: "#2D7D6F", light: "#E8F5F3", desc: "Workflow trigger point"  },
  taskNode:      { label: "Task",       icon: "□",  color: "#1A5FA8", light: "#E8F0FB", desc: "Human task assignment"  },
  approvalNode:  { label: "Approval",   icon: "◈",  color: "#8B3A8B", light: "#F5EBF5", desc: "Review & approval gate" },
  automatedNode: { label: "Action",     icon: "◎",  color: "#C05C1A", light: "#FDF0E8", desc: "Automated system action"},
  endNode:       { label: "Complete",   icon: "◉",  color: "#B02040", light: "#FDEAED", desc: "Workflow completion"    },
};

const PALETTE_ORDER = ["startNode","taskNode","approvalNode","automatedNode","endNode"];

// ─────────────────────────────────────────────────────────
// SECTION 2: MOCK API LAYER
// ─────────────────────────────────────────────────────────

const MockAPI = {
  /** GET /automations */
  getAutomations: () =>
    new Promise((res) =>
      setTimeout(() => res([
        { id: "send_email",      label: "Send Email",           params: [{ key:"to",       type:"text" }, { key:"subject", type:"text" }, { key:"body", type:"textarea" }] },
        { id: "generate_doc",    label: "Generate Document",    params: [{ key:"template", type:"select", options:["leave_letter","approval_cert","rejection_note"] }, { key:"recipient", type:"text" }] },
        { id: "notify_slack",    label: "Notify Slack",         params: [{ key:"channel",  type:"text" }, { key:"message", type:"textarea" }] },
        { id: "update_hris",     label: "Update HRIS Record",   params: [{ key:"employee_id", type:"text" }, { key:"field", type:"text" }, { key:"value", type:"text" }] },
        { id: "create_calendar", label: "Block Calendar",       params: [{ key:"from_date", type:"text" }, { key:"to_date", type:"text" }, { key:"title", type:"text" }] },
        { id: "send_sms",        label: "Send SMS Alert",       params: [{ key:"phone", type:"text" }, { key:"message", type:"textarea" }] },
      ]), 280)
    ),

  /** POST /simulate */
  simulate: (workflow) =>
    new Promise((res) =>
      setTimeout(() => {
        const { nodes, edges } = workflow;
        const adj = {};
        const inDegree = {};
        nodes.forEach((n) => { adj[n.id] = []; inDegree[n.id] = 0; });
        edges.forEach((e) => { adj[e.source]?.push(e.target); inDegree[e.target] = (inDegree[e.target]||0)+1; });

        const errors = [];
        const starts = nodes.filter((n) => n.type === "startNode");
        const ends   = nodes.filter((n) => n.type === "endNode");
        if (!starts.length) errors.push({ type:"error", msg:"No Trigger node found. Every workflow needs a starting point." });
        if (starts.length > 1) errors.push({ type:"warn", msg:`${starts.length} Trigger nodes found. Only one is recommended.` });
        if (!ends.length) errors.push({ type:"error", msg:"No Completion node found. Workflow has no end state." });

        // Kahn's topological sort
        const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
        const order = [];
        const deg   = { ...inDegree };
        while (queue.length) {
          const id = queue.shift();
          order.push(id);
          (adj[id]||[]).forEach((nxt) => { deg[nxt]--; if (deg[nxt]===0) queue.push(nxt); });
        }
        if (order.length !== nodes.length)
          errors.push({ type:"error", msg:"Circular connection detected. Remove the loop to make this workflow executable." });

        const connected = new Set([...edges.map(e=>e.source), ...edges.map(e=>e.target)]);
        if (nodes.length > 1)
          nodes.forEach((n) => { if (!connected.has(n.id) && n.type!=="startNode") errors.push({ type:"warn", msg:`"${n.data?.title||n.data?.startTitle||n.type}" is not connected to any other node.` }); });

        const detailOf = (node) => {
          const d = node.data;
          return {
            startNode:     `Workflow triggered: "${d.startTitle||"Untitled"}"`,
            taskNode:      `Assigned to: ${d.assignee||"Unassigned"} · Deadline: ${d.dueDate||"None set"}`,
            approvalNode:  `Awaiting ${d.approverRole||"Approver"} · Auto-approve in ${d.autoApproveThreshold??"∞"} day(s)`,
            automatedNode: `Running: ${d.actionLabel||d.actionId||"No action"} · ${Object.entries(d.actionParams||{}).map(([k,v])=>`${k}=${v}`).join(", ")||"No params set"}`,
            endNode:       `${d.endMessage||"Workflow complete"} · Summary report: ${d.summaryFlag?"Yes":"No"}`,
          }[node.type] || "";
        };

        const steps = order.map((id, i) => {
          const node = nodes.find((n) => n.id === id);
          if (!node) return null;
          return { id, stepNum:i+1, type:node.type, label:node.data.title||node.data.startTitle||node.data.endMessage||NODE_META[node.type].label, detail:detailOf(node), color:NODE_META[node.type].color, icon:NODE_META[node.type].icon };
        }).filter(Boolean);

        res({ success: errors.filter(e=>e.type==="error").length===0, errors, steps });
      }, 850)
    ),
};

// ─────────────────────────────────────────────────────────
// SECTION 3: CUSTOM HOOKS
// ─────────────────────────────────────────────────────────

function useAutomations() {
  const [automations, setAutomations] = useState([]);
  useEffect(() => { MockAPI.getAutomations().then(setAutomations); }, []);
  return automations;
}

function useNodeForm(selectedNode, setNodes) {
  const updateField = useCallback((key, value) => {
    if (!selectedNode) return;
    setNodes((ns) => ns.map((n) => n.id===selectedNode.id ? { ...n, data:{ ...n.data, [key]:value } } : n));
  }, [selectedNode, setNodes]);
  return { updateField };
}

function useSimulation(nodes, edges, setNodes) {
  const [state, setState] = useState({ open:false, loading:false, result:null, activeId:null });
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current=[]; };

  const resetStatus = () => setNodes((ns) => ns.map((n) => ({ ...n, data:{ ...n.data, _status:null } })));

  const open  = () => setState((s) => ({ ...s, open:true, result:null, activeId:null }));
  const close = () => { clearTimers(); resetStatus(); setState({ open:false, loading:false, result:null, activeId:null }); };

  const run = async () => {
    clearTimers(); resetStatus();
    setState((s) => ({ ...s, loading:true, result:null, activeId:null }));
    const result = await MockAPI.simulate({ nodes, edges });
    setState((s) => ({ ...s, loading:false, result }));
    result.steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setState((s) => ({ ...s, activeId: step.id }));
        setNodes((ns) => ns.map((n) => {
          if (n.id === step.id) return { ...n, data:{ ...n.data, _status:"active" } };
          if (n.data._status === "active") return { ...n, data:{ ...n.data, _status:"done" } };
          return n;
        }));
        if (i === result.steps.length-1) {
          const t2 = setTimeout(() => setNodes((ns) => ns.map((n) => ({ ...n, data:{ ...n.data, _status:"done" } }))), 500);
          timers.current.push(t2);
        }
      }, i * 650);
      timers.current.push(t);
    });
  };

  return { simState:state, openSim:open, closeSim:close, runSim:run };
}

// ─────────────────────────────────────────────────────────
// SECTION 4: SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────

const F = {
  display: "'Playfair Display', serif",
  mono:    "'IBM Plex Mono', monospace",
  sans:    "'IBM Plex Sans', sans-serif",
};

const inputStyle = {
  width:"100%", background:"#FFFFFF", border:"1.5px solid #D8D8D8",
  borderRadius:6, color:"#1A1A1A", padding:"8px 11px", fontSize:12,
  fontFamily:F.sans, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s",
};

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom:13 }}>
      <label style={{ display:"block", fontSize:10, color:"#888", textTransform:"uppercase", letterSpacing:1.2, marginBottom:4, fontFamily:F.mono, fontWeight:500 }}>
        {label}{required && <span style={{ color:"#B02040", marginLeft:2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SInput({ value, onChange, placeholder, type="text" }) {
  const [f, setF] = useState(false);
  return <input type={type} value={value||""} placeholder={placeholder} onChange={e=>onChange(e.target.value)} onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={{ ...inputStyle, borderColor:f?"#2D7D6F":"#D8D8D8" }} />;
}

function STextarea({ value, onChange, placeholder }) {
  const [f, setF] = useState(false);
  return <textarea value={value||""} placeholder={placeholder} onChange={e=>onChange(e.target.value)} onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={{ ...inputStyle, minHeight:64, resize:"vertical", borderColor:f?"#2D7D6F":"#D8D8D8" }} />;
}

function SSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={{ ...inputStyle, cursor:"pointer", background:"#FFFFFF" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => typeof o==="string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={()=>onChange(!value)}>
      <div style={{ width:42, height:22, borderRadius:11, background:value?"#2D7D6F":"#D8D8D8", position:"relative", transition:"background 0.2s", border:"1.5px solid "+(value?"#2D7D6F":"#C0C0C0") }}>
        <div style={{ position:"absolute", top:2, left:value?21:2, width:14, height:14, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px #0004" }} />
      </div>
      <span style={{ fontSize:12, color:value?"#2D7D6F":"#999", fontFamily:F.mono }}>{value?"Yes":"No"}</span>
    </div>
  );
}

function KVEditor({ pairs=[], onChange }) {
  const add    = () => onChange([...pairs, { key:"", value:"" }]);
  const update = (i,f,v) => { const p=[...pairs]; p[i]={ ...p[i],[f]:v }; onChange(p); };
  const remove = (i) => onChange(pairs.filter((_,idx)=>idx!==i));
  return (
    <div>
      {pairs.map((p,i) => (
        <div key={i} style={{ display:"flex", gap:5, marginBottom:5 }}>
          <input placeholder="key" value={p.key} onChange={e=>update(i,"key",e.target.value)} style={{ ...inputStyle, flex:1, padding:"6px 8px" }} />
          <input placeholder="value" value={p.value} onChange={e=>update(i,"value",e.target.value)} style={{ ...inputStyle, flex:1, padding:"6px 8px" }} />
          <button onClick={()=>remove(i)} style={{ background:"#FFF0F2", border:"1.5px solid #F0B0B8", color:"#B02040", borderRadius:6, width:28, cursor:"pointer", fontSize:12, flexShrink:0 }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{ width:"100%", padding:"5px", background:"#FAFAFA", border:"1.5px dashed #D0D0D0", color:"#999", borderRadius:6, cursor:"pointer", fontSize:11, fontFamily:F.mono }}>+ Add field</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SECTION 5: CUSTOM NODE COMPONENTS  (paper-card style)
// ─────────────────────────────────────────────────────────

function WorkflowNode({ data, type, selected }) {
  const meta   = NODE_META[type] || NODE_META.taskNode;
  const status = data._status;
  const isStart = type === "startNode";
  const isEnd   = type === "endNode";

  const border = selected
    ? `2px solid ${meta.color}`
    : status === "active"
    ? `2px solid ${meta.color}`
    : "1.5px solid #E0E0E0";

  const shadow = selected
    ? `0 4px 20px ${meta.color}33, 0 1px 4px #0001`
    : status === "active"
    ? `0 4px 24px ${meta.color}44`
    : "0 2px 8px rgba(0,0,0,0.08)";

  return (
    <div style={{
      background: status === "active" ? meta.light : "#FFFFFF",
      border, borderRadius:10, minWidth:200, maxWidth:230,
      padding:"13px 15px", boxShadow:shadow,
      transition:"all 0.25s ease", position:"relative", overflow:"hidden",
    }}>
      {/* colored left accent bar */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:meta.color, borderRadius:"10px 0 0 10px" }} />

      {!isStart && <Handle type="target" position={Position.Top} style={{ background:meta.color, border:`2px solid #fff`, width:11, height:11, top:-6, boxShadow:`0 0 0 2px ${meta.color}44` }} />}

      <div style={{ paddingLeft:8 }}>
        {/* type badge row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:meta.light, border:`1px solid ${meta.color}44`, borderRadius:20, padding:"2px 9px" }}>
            <span style={{ fontSize:10, color:meta.color }}>{meta.icon}</span>
            <span style={{ fontSize:9, color:meta.color, fontFamily:F.mono, letterSpacing:0.8, fontWeight:600 }}>{meta.label.toUpperCase()}</span>
          </div>
          {status==="done"   && <span style={{ fontSize:12, color:"#2D7D6F" }}>✓</span>}
          {status==="active" && <span style={{ width:7, height:7, borderRadius:"50%", background:meta.color, display:"inline-block", animation:"nodePulse 1s infinite" }} />}
        </div>

        {/* title */}
        <div style={{ fontSize:13, color:"#1A1A1A", fontFamily:F.display, fontWeight:700, lineHeight:1.3, marginBottom:5 }}>
          {data.title||data.startTitle||data.endMessage||<span style={{ color:"#CCC" }}>Untitled</span>}
        </div>

        {/* meta chips */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {data.assignee   && <Chip color={NODE_META.taskNode.color}>👤 {data.assignee}</Chip>}
          {data.approverRole && <Chip color={NODE_META.approvalNode.color}>🔐 {data.approverRole}</Chip>}
          {data.actionLabel && <Chip color={NODE_META.automatedNode.color}>⚙ {data.actionLabel}</Chip>}
          {data.dueDate     && <Chip color={NODE_META.taskNode.color}>📅 {data.dueDate}</Chip>}
          {data.summaryFlag && <Chip color={NODE_META.endNode.color}>∑ Summary</Chip>}
        </div>
      </div>

      {!isEnd && <Handle type="source" position={Position.Bottom} style={{ background:meta.color, border:`2px solid #fff`, width:11, height:11, bottom:-6, boxShadow:`0 0 0 2px ${meta.color}44` }} />}
    </div>
  );
}

function Chip({ color, children }) {
  return <span style={{ fontSize:9, color, background:`${color}12`, border:`1px solid ${color}33`, borderRadius:20, padding:"2px 7px", fontFamily:F.mono, lineHeight:1.8 }}>{children}</span>;
}

function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return <BaseEdge id={id} path={path} style={{ stroke:selected?"#2D7D6F":"#C8C8C8", strokeWidth:selected?2:1.5 }} />;
}

const nodeTypes = {
  startNode:     (p) => <WorkflowNode {...p} type="startNode" />,
  taskNode:      (p) => <WorkflowNode {...p} type="taskNode" />,
  approvalNode:  (p) => <WorkflowNode {...p} type="approvalNode" />,
  automatedNode: (p) => <WorkflowNode {...p} type="automatedNode" />,
  endNode:       (p) => <WorkflowNode {...p} type="endNode" />,
};
const edgeTypes = { default: FlowEdge };

// ─────────────────────────────────────────────────────────
// SECTION 6: NODE CONFIGURATION FORMS
// ─────────────────────────────────────────────────────────

function StartForm({ data, onChange }) {
  return (<>
    <Field label="Workflow Title" required><SInput value={data.startTitle} onChange={v=>onChange("startTitle",v)} placeholder="e.g. Leave Approval Request" /></Field>
    <Field label="Metadata"><KVEditor pairs={data.metadata||[]} onChange={v=>onChange("metadata",v)} /></Field>
  </>);
}
function TaskForm({ data, onChange }) {
  return (<>
    <Field label="Task Title" required><SInput value={data.title} onChange={v=>onChange("title",v)} placeholder="e.g. Submit Leave Application" /></Field>
    <Field label="Description"><STextarea value={data.description} onChange={v=>onChange("description",v)} placeholder="Describe what needs to be done..." /></Field>
    <Field label="Assignee"><SInput value={data.assignee} onChange={v=>onChange("assignee",v)} placeholder="e.g. Employee" /></Field>
    <Field label="Due Date"><SInput type="date" value={data.dueDate} onChange={v=>onChange("dueDate",v)} /></Field>
    <Field label="Custom Fields"><KVEditor pairs={data.customFields||[]} onChange={v=>onChange("customFields",v)} /></Field>
  </>);
}
function ApprovalForm({ data, onChange }) {
  return (<>
    <Field label="Step Title"><SInput value={data.title} onChange={v=>onChange("title",v)} placeholder="e.g. Manager Review" /></Field>
    <Field label="Approver Role"><SSelect value={data.approverRole} onChange={v=>onChange("approverRole",v)} placeholder="Select role..." options={["Manager","HRBP","Director","VP of HR","Legal","C-Suite"]} /></Field>
    <Field label="Auto-approve after (days)">
      <SInput type="number" value={data.autoApproveThreshold} onChange={v=>onChange("autoApproveThreshold",Number(v))} placeholder="0 = never" />
      <div style={{ fontSize:10, color:"#AAA", marginTop:3, fontFamily:F.mono }}>Auto-approves if no action taken within N days</div>
    </Field>
  </>);
}
function AutomatedForm({ data, onChange, automations }) {
  const selected = automations.find(a=>a.id===data.actionId);
  return (<>
    <Field label="Step Title"><SInput value={data.title} onChange={v=>onChange("title",v)} placeholder="e.g. Notify Employee" /></Field>
    <Field label="Action">
      <SSelect value={data.actionId} onChange={v=>{ const a=automations.find(x=>x.id===v); onChange("actionId",v); onChange("actionLabel",a?.label||""); onChange("actionParams",{}); }} placeholder="Choose an action..." options={automations.map(a=>({ value:a.id, label:a.label }))} />
    </Field>
    {selected && (
      <Field label="Parameters">
        <div style={{ background:"#FDF8F0", border:"1.5px solid #E8D5B0", borderRadius:8, padding:10 }}>
          {selected.params.map(p=>(
            <div key={p.key} style={{ marginBottom:8 }}>
              <label style={{ display:"block", fontSize:10, color:"#C05C1A", fontFamily:F.mono, marginBottom:3 }}>{p.key}</label>
              {p.type==="textarea" ? <STextarea value={(data.actionParams||{})[p.key]} onChange={v=>onChange("actionParams",{...(data.actionParams||{}),[p.key]:v})} placeholder={p.key} />
              : p.type==="select"   ? <SSelect value={(data.actionParams||{})[p.key]} onChange={v=>onChange("actionParams",{...(data.actionParams||{}),[p.key]:v})} options={p.options} placeholder={`Select ${p.key}...`} />
              : <SInput value={(data.actionParams||{})[p.key]} onChange={v=>onChange("actionParams",{...(data.actionParams||{}),[p.key]:v})} placeholder={p.key} />}
            </div>
          ))}
        </div>
      </Field>
    )}
  </>);
}
function EndForm({ data, onChange }) {
  return (<>
    <Field label="Completion Message"><SInput value={data.endMessage} onChange={v=>onChange("endMessage",v)} placeholder="e.g. Leave Approved!" /></Field>
    <Field label="Generate Summary Report"><Toggle value={data.summaryFlag} onChange={v=>onChange("summaryFlag",v)} /></Field>
  </>);
}

function ConfigPanel({ node, automations, updateField }) {
  if (!node) return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#CCC", gap:10, padding:20 }}>
      <div style={{ fontSize:28, fontFamily:F.display }}>◈</div>
      <div style={{ fontSize:12, fontFamily:F.sans, textAlign:"center", lineHeight:1.6 }}>Select a node on the canvas to configure its settings</div>
    </div>
  );
  const meta = NODE_META[node.type];
  const FormMap = { startNode:StartForm, taskNode:TaskForm, approvalNode:ApprovalForm, automatedNode:AutomatedForm, endNode:EndForm };
  const Form = FormMap[node.type];
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"0 16px 16px" }}>
      {/* sticky header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 0", borderBottom:"1.5px solid #EBEBEB", marginBottom:14, position:"sticky", top:0, background:"#FAFAFA", zIndex:1 }}>
        <div style={{ width:28, height:28, borderRadius:6, background:meta.light, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${meta.color}44` }}>
          <span style={{ fontSize:13, color:meta.color }}>{meta.icon}</span>
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:meta.color, fontFamily:F.mono, letterSpacing:0.8 }}>{meta.label.toUpperCase()}</div>
          <div style={{ fontSize:10, color:"#AAA", fontFamily:F.sans }}>{meta.desc}</div>
        </div>
      </div>
      {Form && <Form data={node.data} onChange={updateField} automations={automations} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SECTION 7: SIMULATION DRAWER (slides from right)
// ─────────────────────────────────────────────────────────

function SimDrawer({ simState, onClose, onRun, totalNodes, totalEdges }) {
  const { loading, result, activeId, open } = simState;
  return (
    <div style={{
      position:"fixed", top:0, right:0, bottom:0, width:400,
      background:"#FFFFFF", borderLeft:"1.5px solid #E0E0E0",
      display:"flex", flexDirection:"column", zIndex:1000,
      transform:open?"translateX(0)":"translateX(100%)",
      transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      boxShadow:open?"-8px 0 40px rgba(0,0,0,0.12)":"none",
    }}>
      {/* header */}
      <div style={{ padding:"18px 20px", borderBottom:"1.5px solid #EBEBEB", background:"#FAFAFA" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:16, fontFamily:F.display, fontWeight:700, color:"#1A1A1A" }}>Workflow Simulation</div>
            <div style={{ fontSize:10, color:"#AAA", fontFamily:F.mono, marginTop:2 }}>POST /simulate · {totalNodes} nodes · {totalEdges} edges</div>
          </div>
          <button onClick={onClose} style={{ background:"#F0F0F0", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:14, color:"#666", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <button onClick={onRun} disabled={loading} style={{
          width:"100%", marginTop:14, padding:"10px", borderRadius:8, border:"none",
          background:loading?"#F0F0F0":"#2D7D6F",
          color:loading?"#AAA":"#FFFFFF", fontWeight:700, fontSize:12,
          cursor:loading?"not-allowed":"pointer", fontFamily:F.sans,
          letterSpacing:0.5, transition:"all 0.2s",
          boxShadow:loading?"none":"0 2px 12px rgba(45,125,111,0.35)",
        }}>
          {loading ? "▶  Running Simulation..." : "▶  Run Simulation"}
        </button>
      </div>

      {/* body */}
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {/* validation errors */}
        {result?.errors?.length > 0 && (
          <div style={{ marginBottom:16 }}>
            {result.errors.map((e,i) => (
              <div key={i} style={{ display:"flex", gap:8, padding:"9px 12px", background:e.type==="error"?"#FFF0F2":"#FFF8EC", border:`1px solid ${e.type==="error"?"#F0B0B8":"#E8D0A0"}`, borderRadius:8, marginBottom:7 }}>
                <span style={{ color:e.type==="error"?"#B02040":"#C05C1A", fontSize:12, flexShrink:0 }}>{e.type==="error"?"✖":"⚠"}</span>
                <span style={{ fontSize:11, color:e.type==="error"?"#B02040":"#C05C1A", fontFamily:F.sans, lineHeight:1.5 }}>{e.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* execution steps */}
        {result?.steps?.length > 0 && (
          <div>
            <div style={{ fontSize:10, color:"#AAA", fontFamily:F.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>
              Execution Trace · {result.steps.length} steps
            </div>
            {result.steps.map((step, i) => {
              const isActive = step.id === activeId;
              return (
                <div key={step.id} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
                  {/* step indicator */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:isActive?step.color:NODE_META[step.type]?.light||"#F0F0F0", border:`2px solid ${isActive?step.color:"#E0E0E0"}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.3s", boxShadow:isActive?`0 2px 10px ${step.color}55`:"none" }}>
                      <span style={{ fontSize:13, color:isActive?step.color:"#AAA" }}>{step.icon}</span>
                    </div>
                    {i < result.steps.length-1 && <div style={{ width:1, height:14, background:"#E8E8E8", marginTop:2 }} />}
                  </div>
                  {/* content card */}
                  <div style={{ flex:1, background:isActive?NODE_META[step.type]?.light||"#F8F8F8":"#FAFAFA", border:`1px solid ${isActive?step.color+"44":"#EBEBEB"}`, borderRadius:8, padding:"9px 12px", transition:"all 0.3s" }}>
                    <div style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:"#BBB", fontFamily:F.mono }}>STEP {step.stepNum}</span>
                      <span style={{ fontSize:9, color:step.color, background:`${step.color}15`, padding:"1px 6px", borderRadius:10, fontFamily:F.mono }}>{step.type?.replace("Node","").toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize:13, color:"#1A1A1A", fontFamily:F.display, fontWeight:700, marginBottom:3 }}>{step.label}</div>
                    <div style={{ fontSize:11, color:"#888", fontFamily:F.sans, lineHeight:1.5 }}>{step.detail}</div>
                  </div>
                </div>
              );
            })}

            {result && (
              <div style={{ marginTop:12, padding:"10px 14px", borderRadius:8, background:result.success?"#E8F5F3":"#FFF0F2", border:`1px solid ${result.success?"#A0D0C8":"#F0B0B8"}`, display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:result.success?"#2D7D6F":"#B02040", fontSize:14 }}>{result.success?"✓":"✖"}</span>
                <span style={{ fontSize:12, color:result.success?"#2D7D6F":"#B02040", fontFamily:F.sans }}>{result.success?"Workflow is valid and ready to deploy":"Workflow has errors — fix them before deploying"}</span>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign:"center", color:"#CCC", marginTop:40 }}>
            <div style={{ fontSize:32, marginBottom:8, fontFamily:F.display }}>◎</div>
            <div style={{ fontSize:12, fontFamily:F.sans }}>Click Run Simulation to test your workflow</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SECTION 8: INITIAL DATA  (Leave Approval workflow)
// ─────────────────────────────────────────────────────────

const INITIAL_NODES = [
  { id:"n1", type:"startNode",     position:{ x:280, y:40  }, data:{ startTitle:"Leave Approval Request", metadata:[{ key:"type", value:"annual_leave" }] } },
  { id:"n2", type:"taskNode",      position:{ x:280, y:190 }, data:{ title:"Submit Leave Application", assignee:"Employee", description:"Employee fills out the leave request form with dates and reason", dueDate:"", customFields:[] } },
  { id:"n3", type:"approvalNode",  position:{ x:280, y:340 }, data:{ title:"Manager Review", approverRole:"Manager", autoApproveThreshold:5 } },
  { id:"n4", type:"automatedNode", position:{ x:280, y:490 }, data:{ title:"Notify Employee via Email", actionId:"send_email", actionLabel:"Send Email", actionParams:{ to:"employee@company.com", subject:"Leave Request Update" } } },
  { id:"n5", type:"endNode",       position:{ x:280, y:640 }, data:{ endMessage:"Leave Approved Successfully!", summaryFlag:true } },
];

const INITIAL_EDGES = [
  { id:"e1", source:"n1", target:"n2", style:{ stroke:"#2D7D6F66", strokeWidth:1.5 } },
  { id:"e2", source:"n2", target:"n3", style:{ stroke:"#1A5FA866", strokeWidth:1.5 } },
  { id:"e3", source:"n3", target:"n4", style:{ stroke:"#8B3A8B66", strokeWidth:1.5 } },
  { id:"e4", source:"n4", target:"n5", style:{ stroke:"#C05C1A66", strokeWidth:1.5 } },
];

// ─────────────────────────────────────────────────────────
// SECTION 9: MAIN APP
// ─────────────────────────────────────────────────────────

let idCount = 300;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode]  = useState(null);
  const [workflowName, setWorkflowName]  = useState("Leave Approval Process");
  const [editingName,  setEditingName]   = useState(false);
  const [rightOpen,    setRightOpen]     = useState(true);

  const automations = useAutomations();
  const { updateField } = useNodeForm(selectedNode, setNodes);
  const { simState, openSim, closeSim, runSim } = useSimulation(nodes, edges, setNodes);

  // sync selected node with live state
  useEffect(() => {
    if (selectedNode) {
      const u = nodes.find(n=>n.id===selectedNode.id);
      if (u) setSelectedNode(u);
    }
  }, [nodes]);

  const onConnect = useCallback((params) => {
    const src = nodes.find(n=>n.id===params.source);
    const col = NODE_META[src?.type]?.color || "#999";
    setEdges(eds => addEdge({ ...params, style:{ stroke:`${col}66`, strokeWidth:1.5 } }, eds));
  }, [nodes, setEdges]);

  const onNodeClick  = useCallback((_,n) => { setSelectedNode(n); setRightOpen(true); }, []);
  const onPaneClick  = useCallback(() => setSelectedNode(null), []);

  const addNode = (type) => {
    const id = `n${++idCount}`;
    const defaults = {
      startNode:     { startTitle:"New Trigger", metadata:[] },
      taskNode:      { title:"New Task", assignee:"", description:"", dueDate:"", customFields:[] },
      approvalNode:  { title:"New Approval", approverRole:"Manager", autoApproveThreshold:0 },
      automatedNode: { title:"New Action", actionId:"", actionLabel:"", actionParams:{} },
      endNode:       { endMessage:"Complete", summaryFlag:false },
    };
    const n = { id, type, position:{ x:120+Math.random()*360, y:100+Math.random()*300 }, data:defaults[type] };
    setNodes(ns=>[...ns,n]);
    setSelectedNode(n);
    setRightOpen(true);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ name:workflowName, nodes, edges }, null, 2)], { type:"application/json" });
    Object.assign(document.createElement("a"), { href:URL.createObjectURL(blob), download:`${workflowName.replace(/\s+/g,"_")}.json` }).click();
  };

  const stats = useMemo(() => ({
    tasks:     nodes.filter(n=>n.type==="taskNode").length,
    approvals: nodes.filter(n=>n.type==="approvalNode").length,
    actions:   nodes.filter(n=>n.type==="automatedNode").length,
  }), [nodes]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F4F4F2", fontFamily:F.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#F0F0F0; }
        ::-webkit-scrollbar-thumb { background:#D0D0D0; border-radius:2px; }
        input, select, textarea { color-scheme: light; }
        input::placeholder, textarea::placeholder { color:#C0C0C0; }
        .react-flow__controls { box-shadow:none !important; background:#fff !important; border:1.5px solid #E0E0E0 !important; border-radius:10px !important; }
        .react-flow__controls-button { background:transparent !important; border:none !important; border-bottom:1px solid #F0F0F0 !important; color:#999 !important; }
        .react-flow__controls-button:hover { background:#F8F8F8 !important; color:#333 !important; }
        .react-flow__minimap { border-radius:10px !important; border:1.5px solid #E0E0E0 !important; }
        @keyframes nodePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.6)} }
      `}</style>

      {/* ── TOP TOOLBAR ── */}
      <div style={{ height:52, background:"#FFFFFF", borderBottom:"1.5px solid #E8E8E8", display:"flex", alignItems:"center", padding:"0 20px", gap:12, flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Brand */}
        <div style={{ marginRight:8 }}>
          <div style={{ fontSize:14, fontFamily:F.display, fontWeight:700, color:"#1A1A1A", lineHeight:1 }}>HR Flow</div>
          <div style={{ fontSize:8, color:"#2D7D6F", fontFamily:F.mono, letterSpacing:2, textTransform:"uppercase" }}>Workflow</div>
        </div>

        <div style={{ width:1, height:24, background:"#E8E8E8" }} />

        {/* Node add buttons */}
        {PALETTE_ORDER.map(type=>{
          const m = NODE_META[type];
          return (
            <button key={type} onClick={()=>addNode(type)} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, border:`1.5px solid ${m.color}44`, background:m.light, color:m.color, fontSize:11, cursor:"pointer", fontFamily:F.sans, fontWeight:600, transition:"all 0.15s", whiteSpace:"nowrap" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=m.color; e.currentTarget.style.boxShadow=`0 2px 8px ${m.color}33`; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${m.color}44`; e.currentTarget.style.boxShadow="none"; }}>
              <span>{m.icon}</span>{m.label}
            </button>
          );
        })}

        <div style={{ flex:1 }} />

        {/* Stats */}
        {[["Tasks", stats.tasks, NODE_META.taskNode.color], ["Approvals", stats.approvals, NODE_META.approvalNode.color], ["Actions", stats.actions, NODE_META.automatedNode.color]].map(([l,v,c])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:`${c}10`, border:`1px solid ${c}33`, borderRadius:20 }}>
            <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:F.display }}>{v}</span>
            <span style={{ fontSize:9, color:c, fontFamily:F.mono }}>{l.toUpperCase()}</span>
          </div>
        ))}

        <div style={{ width:1, height:24, background:"#E8E8E8" }} />

        {/* Test + Export */}
        <button onClick={openSim} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#2D7D6F", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:F.sans, letterSpacing:0.5, boxShadow:"0 2px 8px rgba(45,125,111,0.3)", transition:"all 0.2s" }}
          onMouseEnter={e=>e.currentTarget.style.background="#236660"}
          onMouseLeave={e=>e.currentTarget.style.background="#2D7D6F"}>
          ▶ Test
        </button>
        <button onClick={exportJSON} style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid #D8D8D8", background:"#fff", color:"#666", fontSize:11, cursor:"pointer", fontFamily:F.sans }}>↓ Export</button>
      </div>

      {/* ── BODY ROW ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* ── CANVAS ── */}
        <div style={{ flex:1, position:"relative" }}>
          {/* workflow name bar */}
          <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", zIndex:10, background:"rgba(255,255,255,0.92)", border:"1.5px solid #E8E8E8", borderRadius:10, padding:"6px 16px", backdropFilter:"blur(4px)", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            {editingName ? (
              <input autoFocus value={workflowName} onChange={e=>setWorkflowName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                style={{ ...inputStyle, width:240, padding:"3px 8px", fontSize:13, fontFamily:F.display, fontWeight:700, border:"none", outline:"none", background:"transparent" }} />
            ) : (
              <div onClick={()=>setEditingName(true)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <span style={{ fontSize:13, fontFamily:F.display, fontWeight:700, color:"#1A1A1A" }}>{workflowName}</span>
                <span style={{ fontSize:9, color:"#CCC", fontFamily:F.mono }}>click to rename</span>
              </div>
            )}
          </div>

          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes} deleteKeyCode={["Backspace","Delete"]}
            fitView fitViewOptions={{ padding:0.2 }} style={{ background:"transparent" }}>
            <Background color="#D8D8D8" gap={24} size={1} variant="dots" />
            <Controls showInteractive={false} />
            <MiniMap nodeColor={n=>NODE_META[n.type]?.color||"#CCC"} maskColor="rgba(244,244,242,0.85)" style={{ background:"#fff", bottom:16, right:rightOpen?420:16 }} />
          </ReactFlow>
        </div>

        {/* ── RIGHT CONFIG PANEL ── */}
        <div style={{ width:rightOpen?280:0, background:"#FAFAFA", borderLeft:"1.5px solid #E8E8E8", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", flexShrink:0 }}>
          <div style={{ width:280, display:"flex", flexDirection:"column", height:"100%", minWidth:280 }}>
            <div style={{ padding:"12px 16px 8px", borderBottom:"1.5px solid #EBEBEB", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <span style={{ fontSize:10, color:"#AAA", fontFamily:F.mono, letterSpacing:1.5, textTransform:"uppercase" }}>Node Config</span>
              <button onClick={()=>setRightOpen(false)} style={{ background:"none", border:"none", color:"#CCC", cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
            </div>
            <ConfigPanel node={selectedNode} automations={automations} updateField={updateField} />
          </div>
        </div>

        {/* toggle config panel open */}
        {!rightOpen && (
          <button onClick={()=>setRightOpen(true)} style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", background:"#FFFFFF", border:"1.5px solid #E8E8E8", borderRight:"none", borderRadius:"8px 0 0 8px", padding:"12px 6px", cursor:"pointer", color:"#999", fontSize:11, fontFamily:F.mono, writingMode:"vertical-rl", boxShadow:"-2px 0 8px rgba(0,0,0,0.04)", zIndex:10 }}>
            CONFIG ▸
          </button>
        )}
      </div>

      {/* ── SIMULATION DRAWER (slides from right) ── */}
      <SimDrawer simState={simState} onClose={closeSim} onRun={runSim} totalNodes={nodes.length} totalEdges={edges.length} />
    </div>
  );
}