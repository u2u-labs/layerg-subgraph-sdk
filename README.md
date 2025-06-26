# Subgraph CLI Toolkit

Supports entity generation, query client scaffolding, and event verification.

---

## Features

- **Deploy Subgraphs** using a streamlined CLI interface.
- **Generate Entities** from GraphQL schema definitions.
- **Auto-generate Query Clients** for TypeScript integration.
- **Verify Handlers** to ensure schema and logic alignment.
- **Streaming database onchange data**.

---

## Installation

```bash
npm install -g your-subgraph-cli
# or local
npm install your-subgraph-cli
```

---

## Usage

### CLI Entrypoint

```bash
subgraph-cli [command] [...options]
#or local
npx subgraph-cli [command] [...options]
```

### Commands

#### `generate-entity`

Generate entity classes from your GraphQL schema:

```bash
subgraph-cli generate-entity --schema <graphql schema file path> --out <target folder to generate entities>
#or local
npx subgraph-cli generate-entity --schema <graphql schema file path> --out <target folder to generate entities>
```

#### `generate-query-client`

Create a query client to query and stream subgraph's data:

```bash
subgraph-cli generate-query-client --id <subgraph id> --apiKey <your api key>
#or local
npx subgraph-cli generate-query-client --id <subgraph id> --apiKey <your api key>
```

#### `verifier`

Verify your config to make sure it works before deploying. Your `config.yaml` file must be placed in root: 

```bash
subgraph-cli verify
#or local
npx subgraph-cli verify
```

#### `deploy`

Deploy your subgraph to Layerg's nodes. Your `config.yaml` file must be placed in root:

```bash
subgraph-cli deploy
#or local
npx subgraph-cli deploy
```

---

## Configuration

Most commands support flags like `--schema`, `--out`, and `--config`.  
Ensure your `config.yaml` matches the following format:

```yaml
name: My Subgraph
slug: my-subgraph
apiKey: <your-api-key>
resource:
  schema: ./resources/schema.graphql
  handler: ./resources/handler.ts
dataSources:
  - chainId: 1
    contractAddress: 0x...
    startBlock: 123456
eventHandlers:
  - event: MyEvent
    handler: handleMyEvent
```

---

## License

[MIT](https://opensource.org/licenses/MIT)
