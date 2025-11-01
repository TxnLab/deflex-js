# Deflex SDK

This repository contains the Deflex SDK and example implementations for integrating Deflex Order Router into your applications.

## Packages

### [@txnlab/deflex](./packages/deflex)

TypeScript/JavaScript SDK for [Deflex Order Router](https://txnlab.gitbook.io/deflex-api) - smart order routing and DEX aggregation on Algorand.

- **Documentation**: [packages/deflex/README.md](./packages/deflex/README.md)
- **npm**: [@txnlab/deflex](https://www.npmjs.com/package/@txnlab/deflex)

## Examples

The [examples](./examples) directory contains complete working implementations:

### [React](./examples/react)

Simple React application demonstrating basic Deflex SDK integration.

- React 18 with TypeScript and Vite
- Multiple wallet support (Pera, Defly, Lute)
- Complete swap UI with quote display

### [React Query](./examples/react-query)

Advanced React application showcasing TanStack Query integration.

- Automatic quote fetching with debouncing
- Real-time quote updates (refreshes every 15 seconds)
- Optimistic UI updates with mutations
- Demonstrates modern data fetching patterns

### [Node.js CLI](./examples/node-cli)

Command-line tool for executing swaps without a browser.

- Custom signer implementation
- Environment variable configuration
- Detailed console output
- Perfect for automation and scripts

## Development Setup

This is a pnpm workspace monorepo. All packages and examples share dependencies and can reference each other.

### Prerequisites

- **Deflex API Key** - Request an API key by emailing [support@txnlab.dev](mailto:support@txnlab.dev)
- algosdk 3.0.0 or later (peer dependency)
- Node.js >= 20
- pnpm 10.20.0 or later

### Installation

Install all dependencies:

```bash
pnpm install
```

### Building the SDK

Build the SDK package:

```bash
pnpm build
```

### Running Examples

Each example can be run independently. Navigate to the example directory and follow its README:

```bash
# React
cd examples/react
pnpm dev

# React Query
cd examples/react-query
pnpm dev

# Node.js CLI
cd examples/node-cli
pnpm dev
```

## Quick Start

Install the SDK in your project:

```bash
npm install @txnlab/deflex algosdk
```

Basic usage:

```typescript
import { DeflexClient } from '@txnlab/deflex'
import { useWallet } from '@txnlab/use-wallet-react'

const { activeAddress, transactionSigner } = useWallet()

// Initialize client
const deflex = new DeflexClient({
	apiKey: 'your-api-key',
})

// Get quote
const quote = await deflex.newQuote({
	fromASAID: 0, // ALGO
	toASAID: 31566704, // USDC
	amount: 1_000_000, // 1 ALGO
	address: activeAddress,
})

// Execute swap
const swap = await deflex.newSwap({
	quote,
	address: activeAddress,
	signer: transactionSigner,
	slippage: 1, // 1%
})
const result = await swap.execute()
```

## Testing

Run SDK tests:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

## Scripts

Root-level scripts:

- `pnpm build` - Build the SDK package
- `pnpm test` - Run SDK tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage
- `pnpm lint` - Lint SDK code
- `pnpm format` - Check code formatting
- `pnpm format:fix` - Fix code formatting
- `pnpm typecheck` - Type check SDK
- `pnpm ci` - Run all CI checks (build, lint, format, test)
- `pnpm release` - Release a new version

## Documentation

- **SDK Documentation**: [packages/deflex/README.md](./packages/deflex/README.md)
- **Examples Guide**: [examples/README.md](./examples/README.md)
- **Deflex API Docs**: [https://txnlab.gitbook.io/deflex-api](https://txnlab.gitbook.io/deflex-api)

## Contributing

Contributions are welcome! The monorepo structure makes it easy to:

1. Make changes to the SDK in `packages/deflex/`
2. Test changes immediately in any example project
3. Examples automatically use the local SDK via workspace protocol

All examples reference the SDK using `"@txnlab/deflex": "workspace:*"` in their package.json.

## License

MIT - see [LICENSE](./LICENSE) for details

## Support

- [GitHub Issues](https://github.com/TxnLab/deflex-js/issues)
- [Discord](https://discord.gg/Ek3dNyzG)
- [TxnLab](https://txnlab.dev)

---

Built by [TxnLab](https://txnlab.dev)
