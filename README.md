# Deflex SDK

TypeScript/JavaScript SDK for [Deflex Order Router](https://txnlab.gitbook.io/deflex-api) - smart order routing and DEX aggregation on Algorand.

## Installation

```bash
npm install @txnlab/deflex
```

## Features

- 🔄 **Smart Order Routing** - Automatically finds the best swap routes across multiple DEXs
- 💰 **Fee Sharing** - Optional referrer address to earn 25% of swap fees
- 🎯 **Slippage Protection** - Built-in slippage tolerance controls
- 🔐 **Type Safety** - Full TypeScript support with comprehensive type definitions
- ⚡ **Atomic Swaps** - All swaps execute atomically with automatic opt-in handling
- 🛠️ **Transaction Composer** - Flexible API for building complex transaction groups

## Quick Start

```typescript
import { DeflexClient } from '@txnlab/deflex'
import algosdk from 'algosdk'

// Initialize the client
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
})

// Get a quote for swapping 1 ALGO to USDC
const quote = await deflex.fetchQuote({
  address: 'YOUR_ADDRESS...',
  fromAssetId: 0,      // ALGO
  toAssetId: 31566704, // USDC
  amount: 1_000_000,   // 1 ALGO (in microAlgos)
})

console.log(`You will receive approximately ${quote.quote} USDC`)

// Execute the swap
const signer = algosdk.makeBasicAccountTransactionSigner(account)
const swap = await deflex.newSwap({
  quote,
  address: account.addr,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute(signer)

console.log(`Swap completed in round ${result.confirmedRound}`)
```

## Usage

### Initialize the Client

```typescript
import { DeflexClient } from '@txnlab/deflex'

// Basic initialization
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
})

// Advanced configuration
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
  algodUri: 'https://mainnet-api.4160.nodely.dev/',
  algodToken: '',
  algodPort: 443,
  referrerAddress: 'REFERRER_ADDRESS...', // Earns 25% of swap fees
  feeBps: 15,                             // 0.15% fee (max: 300 = 3%)
  autoOptIn: true,                        // Automatically handle asset opt-ins
})
```

### Get a Swap Quote

```typescript
// Basic quote
const quote = await deflex.fetchQuote({
  fromAssetId: 0,       // ALGO
  toAssetId: 31566704,  // USDC
  amount: 1_000_000,    // 1 ALGO
  address: userAddress, // Required for auto opt-in detection
})

// Fixed-output quote (specify exact output amount)
const quote = await deflex.fetchQuote({
  fromAssetId: 0,
  toAssetId: 31566704,
  amount: 5_000_000, // Receive exactly 5 USDC
  type: 'fixed-output',
  address: userAddress,
})

// Advanced routing options
const quote = await deflex.fetchQuote({
  fromAssetId: 0,
  toAssetId: 31566704,
  amount: 1_000_000,
  address: userAddress,
  maxGroupSize: 16,              // Maximum transactions in atomic group
  maxDepth: 4,                   // Maximum number of swap hops
  disabledProtocols: ['Algofi'], // Exclude specific protocols
})
```

### Execute a Swap

```typescript
import algosdk from 'algosdk'

// Using algosdk signer
const account = algosdk.generateAccount()
const signer = algosdk.makeBasicAccountTransactionSigner(account)

const swap = await deflex.newSwap({
  quote,
  address: account.addr,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute(signer)

console.log(`Confirmed in round ${result.confirmedRound}`)
console.log('Transaction IDs:', result.txIds)
```

### Advanced Transaction Composition

Build complex transaction groups by adding custom transactions before and after swaps:

```typescript
import { Transaction } from 'algosdk'

// Create your custom transactions
const customTxn1 = new Transaction({...})
const customTxn2 = new Transaction({...})

// Build and execute the transaction group
const swap = await deflex.newSwap({
  quote,
  address: account.addr,
  slippage: 1,
})

const result = await swap
  .addTransaction(customTxn1)  // Add transaction before swap
  .addSwapTransactions()       // Add swap transactions
  .addTransaction(customTxn2)  // Add transaction after swap
  .execute(signer)             // Sign and execute entire group
```

### Transaction Group Lifecycle

The `SwapComposer` provides fine-grained control over the transaction lifecycle:

```typescript
const swap = await deflex.newSwap({ quote, address, slippage })

console.log(swap.getStatus()) // BUILDING

// Add transactions to the group
await swap
  .addTransaction(customTxn)
  .addSwapTransactions()

console.log(swap.count()) // Total number of transactions

// Sign the group
const signedTxns = await swap.sign(signer)
console.log(swap.getStatus()) // SIGNED

// Submit to network (without waiting for confirmation)
const txIds = await swap.submit(signer)
console.log(swap.getStatus()) // SUBMITTED

// Or execute (sign + submit + wait for confirmation)
const result = await swap.execute(signer)
console.log(swap.getStatus()) // COMMITTED
```

### Manual Asset Opt-In Detection

If you're not using `autoOptIn: true`, you can manually check if opt-in is needed:

```typescript
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
  autoOptIn: false,
})

// Check if user needs to opt into the output asset
const needsOptIn = await deflex.needsAssetOptIn(userAddress, toAssetId)

// Include opt-in in quote if needed
const quote = await deflex.fetchQuote({
  fromAssetId,
  toAssetId,
  amount,
  optIn: needsOptIn,
})
```

### Inspecting Quote Details

```typescript
const quote = await deflex.fetchQuote({...})

// Output amount
console.log(`Quote: ${quote.quote}`)

// Price impact
console.log(`User price impact: ${quote.userPriceImpact}%`)
console.log(`Market price impact: ${quote.marketPriceImpact}%`)

// USD values
console.log(`USD in: $${quote.usdIn}`)
console.log(`USD out: $${quote.usdOut}`)

// Routing information
console.log('Route:', quote.route)
console.log('Flattened route:', quote.flattenedRoute)

// Required opt-ins
console.log('Required app opt-ins:', quote.requiredAppOptIns)

// Protocol fees
console.log('Protocol fees:', quote.protocolFees)
```

### Error Handling

```typescript
try {
  const quote = await deflex.fetchQuote({
    fromAssetId: 0,
    toAssetId: 31566704,
    amount: 1_000_000,
    address: userAddress,
  })

  const swap = await deflex.newSwap({
    quote,
    address: userAddress,
    slippage: 1,
  })
  const result = await swap.execute(signer)

  console.log('Swap successful:', result)
} catch (error) {
  console.error('Swap failed:', error.message)
}
```

## API Reference

### DeflexClient

The main client for interacting with the Deflex API.

#### Constructor Options

- `apiKey` (required): Your Deflex API key
- `algodUri`: Algod node URI (default: `https://mainnet-api.4160.nodely.dev/`)
- `algodToken`: Algod node token (default: `''`)
- `algodPort`: Algod node port (default: `443`)
- `referrerAddress`: Referrer address for fee sharing (receives 25% of swap fees)
- `feeBps`: Fee in basis points (default: `15` = 0.15%, max: `300` = 3.00%)
- `autoOptIn`: Auto-detect and add required opt-in transactions (default: `false`)

#### Methods

##### `fetchQuote(params)`

Fetch a swap quote from the Deflex API.

##### `fetchSwapTransactions(params)`

Fetch executable swap transactions for a quote.

##### `newSwap(config)`

Create a `SwapComposer` instance for building and executing swaps.

##### `needsAssetOptIn(address, assetId)`

Check if an address needs to opt into an asset.

### SwapComposer

Builder for constructing and executing atomic swap transaction groups.

#### Methods

##### `addTransaction(transaction)`

Add a transaction to the atomic group.

##### `addSwapTransactions()`

Add swap transactions to the group (automatically includes required app opt-ins).

##### `sign(signer)`

Sign the transaction group.

##### `submit(signer)`

Sign and submit the transaction group to the network.

##### `execute(signer, waitRounds?)`

Sign, submit, and wait for confirmation.

##### `getStatus()`

Get the current status: `BUILDING`, `BUILT`, `SIGNED`, `SUBMITTED`, or `COMMITTED`.

##### `count()`

Get the number of transactions in the group.

## Documentation

For more information about the Deflex Order Router protocol, visit the [official documentation](https://txnlab.gitbook.io/deflex-api).

## License

MIT

## Support

- [GitHub Issues](https://github.com/TxnLab/deflex-js/issues)
- [Discord](https://discord.gg/Ek3dNyzG)
- [TxnLab](https://txnlab.dev)
