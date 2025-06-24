# LayerG Subgraph SDK CLI

`layerg-subgraph-sdk-6` is a command-line tool to help you generate entity classes and deploy subgraphs to the LayerG data indexing platform.

It provides two main capabilities:
- 📦 Generate TypeScript entity classes from your GraphQL schema
- 🚀 Deploy your subgraph project (schema + handlers) using a `config.yaml` definition

---

## ✨ Features

- Generate runtime-safe entity classes with built-in `save`, `get`, `getBy`, and `onInsert` logic
- Auto-zip and upload subgraph handlers to a pre-signed S3 endpoint
- Fully typed YAML-based deployment config
- Built for use with Docker and containerized handler runtimes

---

## 📦 Installation

### Option A: Use via `npx` (no install)

```bash
npx layerg-subgraph-sdk-6 deploy
npx layerg-subgraph-sdk-6 generate --schema ./schema.graphql --outDir ./generated
