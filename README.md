# HR Workflow Designer

This project is a visual tool to design and simulate HR workflows like leave approval.

## 🚀 Features

- Create workflows using nodes
- Connect steps visually
- Configure each node (task, approval, action)
- Run simulation to check workflow
- Export workflow as JSON

## 🧩 Node Types

- Start (Trigger)
- Task
- Approval
- Action (Automated)
- End

## 🔁 Simulation

- Checks errors (missing start/end, loops)
- Shows step-by-step execution
- Highlights active nodes

## 🛠 Tech Stack

- React + Vite
- React Flow
- Custom Hooks
- Mock API

## ▶️ Run Project

```bash
npm install
npm run dev
