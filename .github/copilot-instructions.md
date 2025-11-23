# K8s Manager Project Instructions

## Architecture Overview
- **Monorepo**: `backend/` (Rust/Axum) and `frontend/` (React/Vite).
- **Core Pattern**: Generic resource handling. The system is designed to handle any Kubernetes resource type uniformly via a shared enum mapping.
  - **Backend**: `K8sResourceType` enum maps to `GroupVersionKind` (GVK). Resources are fetched as `kube::api::DynamicObject`.
  - **Frontend**: Routing is structure as `/:context/:resourceType`.

## Backend Development (Rust)
- **Development Workflow (TDD)**:
  1. **Define Trait**: Start by defining or updating the trait definition (e.g., in `services/k8s.rs`).
  2. **Write Test**: Write a failing test case that uses the new trait method (e.g., in `services/tests.rs` or `handlers/tests.rs`).
  3. **Implement Logic**: Implement the logic to satisfy the test.
  4. **Verify**: Run `cargo test` to ensure the implementation is correct. Repeat until passing.
- **Adding Resources**:
  1. Add variant to `K8sResourceType` in `backend/src/models.rs`.
  2. Define GVK mapping in `get_api_resource` impl in `backend/src/models.rs`.
  3. No handler changes needed; `list_resources` and `get_resource` in `services/k8s.rs` handle generic types dynamically.
- **Testing**:
  - Use `mockall` for service mocking (`MockK8sService`).
  - Run tests: `cd backend && cargo test`.

## Frontend Development (React)
- **Package Manager**: Use `bun` for all commands (`bun install`, `bun add`).
- **Routing**:
  - `/:context` -> Redirects to default resource (Pod).
  - `/:context/:resourceType` -> `ResourcesPage` (Generic List).
  - `/:context/:resourceType/:name` -> `ResourceDetailsPage` (YAML/JSON View).
- **Resource Views**:
  - `ResourcesPage` (`pages/context/resources.tsx`) is the main entry.
  - Specialized views (e.g., `PodsView`) are conditionally rendered inside `ResourcesPage` based on `resourceType`.
  - When adding a new specialized view, update `ResourcesPage` to import and render it.
- **Data Fetching**:
  - Use `useK8s.ts` hooks (`useResources`, `useResource`).
  - Ensure `K8sResourceType` in `frontend/src/types/k8s.ts` stays synced with backend.

## Key Files
- `backend/src/models.rs`: Central definition of supported K8s resources and GVK mapping.
- `backend/src/services/k8s.rs`: Generic K8s client logic using `DynamicObject`.
- `frontend/src/pages/context/resources.tsx`: Router for resource list views.
- `frontend/src/types/k8s.ts`: Frontend mirror of backend resource enum.

## Workflows
- **Start Dev**: Run `./dev.sh` (or `dev.ps1` on Windows) to start both services.
- **Frontend Deps**: `cd frontend && bun add <package>`.

## Communication Guidelines
- **Ask for Clarification**: When requirements are ambiguous, incomplete, or could be interpreted in multiple ways, ALWAYS ask clarifying questions before writing code.
- **Confirm Intent**: If a request implies a significant architectural change or deviation from established patterns (like the generic resource handling), verify the user's intent first.
- **Propose Alternatives**: If a requested feature could be implemented in a simpler or more idiomatic way given the current architecture, suggest the alternative before proceeding.
