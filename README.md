# HR Workflow Designer — Tredence Studio Case Study

**Developed by:** Jothi R  
**Role:** Full Stack Engineering Intern  

---

## 📌 Project Overview

The **HR Workflow Designer** is a visual workflow builder designed to model, configure, and simulate HR processes such as leave approvals.

Built using **React + Vite** and powered by **React Flow**, this application allows users to:
- Design workflows using drag-and-connect nodes
- Configure node-specific properties dynamically
- Simulate execution with validation and step-by-step tracing
- Export workflows as JSON

---

## 🧠 Architecture

- ⚛️ React (Functional Components + Hooks)
- 🔄 Custom Hooks (`useSimulation`, `useNodeForm`, `useAutomations`)
- 🧩 Modular Node Components
- 🌐 Mock API Layer (Simulated backend)
- 🎨 Editorial UI Theme (Playfair Display + IBM Plex)

---

## 🧩 Node Types

The workflow supports the following node types:

- 🔹 **Trigger (Start Node)** — Entry point of workflow  
- 🔹 **Task Node** — Human task assignment  
- 🔹 **Approval Node** — Decision-making step  
- 🔹 **Automated Node** — System-triggered actions  
- 🔹 **End Node** — Workflow completion  

---

## ⚙️ Key Features

### 🔗 Visual Workflow Builder
- Drag-and-connect nodes using **React Flow**
- Dynamic edge creation with color-coded paths
- MiniMap and controls for navigation

---

### 📝 Dynamic Configuration Panel
- Node-specific forms:
  - Task details
  - Approval roles
  - Automation parameters
- Custom fields editor (key-value pairs)
- Real-time updates using state management

---

### 🔁 Workflow Simulation Engine

Simulates workflow execution using:
- Topological sorting (Kahn’s Algorithm)
- Validation checks:
  - Missing start/end nodes
  - Circular dependencies
  - Disconnected nodes

---

### 📊 Execution Trace

- Step-by-step workflow execution
- Active node highlighting
- Detailed logs for each step
- Success / error feedback

---

### 🔌 Mock API Layer

Simulated endpoints:
- `GET /automations`
- `POST /simulate`

Includes actions like:
- Send Email
- Generate Document
- Notify Slack
- Update HRIS
- Send SMS

---

### 📤 Export Feature

- Export workflow as JSON file
- Includes nodes, edges, and metadata

---

## 🎯 Default Workflow

Preloaded workflow:
**Leave Approval Process**

Flow:
Trigger → Task → Approval → Automation → Completion

---

## 🚀 Getting Started

Install dependencies:
```bash
npm install
