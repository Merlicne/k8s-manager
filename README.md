# K8s Manager

A simple, Kubernetes management system built with Rust and React. This application runs locally on your machine and leverages your existing `kubeconfig` file to interact with your Kubernetes clusters.

## Features

*   **Cluster Context Switching**: Easily switch between different Kubernetes contexts defined in your local configuration.
*   **Pod Management**: View running pods, their status, namespace, and node assignment.
*   **Real-time Updates**: Auto-refresh capability with user-configurable intervals (5s, 10s, 30s, 1m).
*   **Modern UI**: Clean, responsive interface built with React, Tailwind CSS, and Lucide icons.
*   **High Performance**: Backend powered by Rust for efficient Kubernetes API interactions.

## Tech Stack

### Backend
*   **Language**: Rust
*   **Framework**: Axum
*   **Kubernetes Client**: `kube-rs`
*   **API**: RESTful API

### Frontend
*   **Framework**: React (Vite)
*   **Runtime/Package Manager**: Bun
*   **Styling**: Tailwind CSS
*   **State Management**: TanStack Query (React Query)

## Prerequisites

*   **Rust**: Ensure you have Rust installed (`cargo`).
*   **Bun**: Install Bun for frontend dependency management and running the dev server.
*   **Kubernetes Config**: A valid `~/.kube/config` file (or equivalent pointed to by `KUBECONFIG` env var) with access to at least one cluster.

## Getting Started

### Option 1: Script (Windows/Linux/Mac)

**Development Mode:**
Runs the backend with `cargo run` and frontend with `vite` (hot reload).

*Windows (PowerShell):*
```powershell
.\dev.ps1
```

*Linux/Mac/Git Bash:*
```bash
chmod +x dev.sh
./dev.sh
```

**Production Mode:**
Builds optimized binaries/assets and runs them.

*Windows (PowerShell):*
```powershell
.\prod.ps1
```

*Linux/Mac/Git Bash:*
```bash
chmod +x prod.sh
./prod.sh
```

### Option 2: Manual Setup

#### 1. Backend Setup

Navigate to the backend directory and run the server:

```bash
cd backend
cargo run
```

### 2. Frontend Setup

Navigate to the frontend directory, install dependencies, and start the development server:

```bash
cd frontend
bun install
bun run dev
```

## Project Structure

```
k8s-manager/
├── backend/           # Rust Axum API Server
│   ├── src/
│   │   ├── handlers/  # API Request Handlers
│   │   ├── services/  # Business Logic & K8s Client
│   │   └── ...
│   └── ...
└── frontend/          # React Vite Application
    ├── src/
    │   ├── components/# Reusable UI Components
    │   ├── hooks/     # Custom React Hooks
    │   ├── services/  # API Client
    │   └── ...
    └── ...
```