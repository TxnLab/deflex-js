# Deflex SDK

TypeScript/JavaScript SDK for [Deflex Order Router](https://txnlab.gitbook.io/deflex-api) - smart order routing and DEX aggregation on Algorand.

## Installation

```bash
npm install @txnlab/deflex
```

## Quick Start

```typescript
import { DeflexClient } from '@txnlab/deflex'
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

// Initialize the client
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
})

// Get a quote
const quote = await deflex.newQuote({
  address: activeAddress,
  fromAssetId: 0,      // ALGO
  toAssetId: 31566704, // USDC
  amount: 1_000_000,   // 1 ALGO (in microAlgos)
})

// Execute the swap
const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute(transactionSigner)

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
  referrerAddress: '<referrer_address>', // Earns 25% of swap fees
  feeBps: 15,                            // 0.15% fee (max: 300 = 3%)
  autoOptIn: true,                       // Automatically handle asset opt-ins
})
```

### Get a Swap Quote

The [`newQuote()`](#deflexclientnewquote) method returns a [`DeflexQuote`](#deflexquote) instance:

```typescript
// Basic quote
const quote = await deflex.newQuote({
  fromAssetId: 0,       // ALGO
  toAssetId: 31566704,  // USDC
  amount: 1_000_000,    // 1 ALGO
  address: userAddress, // Required for auto opt-in detection
})
```

### Execute a Swap

The [`newSwap()`](#deflexclientnewswap) method returns a [`SwapComposer`](#swapcomposer) instance:

```typescript
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute(transactionSigner)

console.log(`Confirmed in round ${result.confirmedRound}`)
console.log('Transaction IDs:', result.txIds)
```

### Transaction Signing

The SDK supports two types of transaction signers for the `sign()`, `submit()`, and `execute()` methods:

#### 1. use-wallet Signer (Recommended)

Use the `@txnlab/use-wallet` library for wallet management in your dApp:

```typescript
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

await swap.execute(transactionSigner)
```

> **Tip**: The [`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet) library supports multiple wallet providers (Pera, Defly, Lute, WalletConnect, etc.) and provides a unified interface. Choose the framework-specific adapter for your project: `@txnlab/use-wallet-react`, `@txnlab/use-wallet-vue`, `@txnlab/use-wallet-solid`, or `@txnlab/use-wallet-svelte`.

#### 2. Custom Signer Function

```typescript
// Custom signer function signature:
// (txnGroup: Transaction[]) => Promise<Uint8Array[]>

const customSigner = async (txnGroup) => {
  // Your custom signing logic here
  const signedTxns = await yourWalletProvider.signTransactions(txnGroup)

  return signedTxns
}

await swap.execute(customSigner)
```

> **Note**: The custom signer function must return an array of `Uint8Array` where each element is a signed transaction.

### Advanced Transaction Composition

Build the transaction group by adding custom transactions before or after the swap using the [`SwapComposer`](#swapcomposer) instance:

```typescript
import { Transaction } from 'algosdk'
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

// Create your custom transactions
const customTxn1 = new Transaction({...})
const customTxn2 = new Transaction({...})

// Build and execute the transaction group
const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  slippage: 1,
})

const result = await swap
  .addTransaction(customTxn1)     // Add transaction before swap
  .addSwapTransactions()          // Add swap transactions
  .addTransaction(customTxn2)     // Add transaction after swap
  .execute(transactionSigner)     // Sign and execute entire group
```

### Manual Asset Opt-In Detection

If you're not using `autoOptIn: true`, you can manually check if opt-in is needed:

```typescript
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
  autoOptIn: false, // Default if not provided
})

// Check if user needs to opt into the output asset
const needsOptIn = await deflex.needsAssetOptIn(userAddress, toAssetId)

// Include opt-in in quote if needed
const quote = await deflex.newQuote({
  fromAssetId,
  toAssetId,
  amount,
  optIn: needsOptIn,
})
```

### Error Handling

```typescript
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

try {
  const quote = await deflex.newQuote({
    fromAssetId: 0,
    toAssetId: 31566704,
    amount: 1_000_000,
    address: activeAddress,
  })

  const swap = await deflex.newSwap({
    quote,
    address: activeAddress,
    slippage: 1,
  })
  const result = await swap.execute(transactionSigner)

  console.log('Swap successful:', result)
} catch (error) {
  console.error('Swap failed:', error.message)
}
```

## API Reference

### DeflexClient

The main client for interacting with the Deflex API.

```typescript
new DeflexClient(config: DeflexConfigParams)
```

| Option            | Description                                                  | Type               | Default                                |
| ----------------- | ------------------------------------------------------------ | ------------------ | -------------------------------------- |
| `apiKey`          | Your Deflex API key                                          | `string`           | **required**                           |
| `algodUri`        | Algod node URI                                               | `string`           | `https://mainnet-api.4160.nodely.dev/` |
| `algodToken`      | Algod node token                                             | `string`           | `''`                                   |
| `algodPort`       | Algod node port                                              | `string \| number` | `443`                                  |
| `referrerAddress` | Referrer address for fee sharing (receives 25% of swap fees) | `string`           | `undefined`                            |
| `feeBps`          | Fee in basis points (0.15%, max: 300 = 3.00%)                | `number`           | `15`                                   |
| `autoOptIn`       | Auto-detect and add required opt-in transactions             | `boolean`          | `false`                                |

> **Referral Program**: By providing a `referrerAddress`, you can earn 25% of the swap fees generated through your integration. The `feeBps` parameter sets the total fee charged (default: 0.15%). Learn more about the [Deflex Referral Program](https://txnlab.gitbook.io/deflex-api/referral-treasury/referral-program).

#### DeflexClient.newQuote()

Fetch a swap quote and return a [`DeflexQuote`](#deflexquote) instance.

```typescript
async newQuote(params: QuoteParams): Promise<DeflexQuote>
```

| Parameter           | Description                                | Type                              | Default         |
| ------------------- | ------------------------------------------ | --------------------------------- | --------------- |
| `fromAssetId`       | Input asset ID                             | `bigint \| number`                | **required**    |
| `toAssetId`         | Output asset ID                            | `bigint \| number`                | **required**    |
| `amount`            | Amount to swap in base units               | `bigint \| number`                | **required**    |
| `type`              | Quote type                                 | `'fixed-input' \| 'fixed-output'` | `'fixed-input'` |
| `address`           | User address (recommended for auto opt-in) | `string`                          | `undefined`     |
| `disabledProtocols` | Array of protocols to exclude              | `Protocol[]`                      | `[]`            |
| `maxGroupSize`      | Maximum transactions in atomic group       | `number`                          | `16`            |
| `maxDepth`          | Maximum swap hops                          | `number`                          | `4`             |
| `optIn`             | Override auto opt-in behavior              | `boolean`                         | `undefined`     |

#### DeflexClient.newSwap()

Returns a [`SwapComposer`](#swapcomposer) instance for building and executing swaps.

```typescript
async newSwap(config: SwapComposerConfig): Promise<SwapComposer>
```

| Parameter  | Description                                       | Type                                |
| ---------- | ------------------------------------------------- | ----------------------------------- |
| `quote`    | Quote instance or response object                 | `DeflexQuote \| FetchQuoteResponse` |
| `address`  | Signer address                                    | `string`                            |
| `slippage` | Slippage tolerance as percentage (e.g., 1 for 1%) | `number`                            |

#### DeflexClient.needsAssetOptIn()

Checks if an address needs to opt into an asset.

```typescript
async needsAssetOptIn(address: string, assetId: bigint | number): Promise<boolean>
```

| Parameter | Description               | Type               |
| --------- | ------------------------- | ------------------ |
| `address` | Algorand address to check | `string`           |
| `assetId` | Asset ID to check         | `bigint \| number` |

### DeflexQuote

Wrapper class for quote responses returned by [`newQuote()`](#deflexclientnewquote).

| Property            | Description                                      | Type                     |
| ------------------- | ------------------------------------------------ | ------------------------ |
| `quote`             | Quoted amount                                    | `bigint`                 |
| `amount`            | Original request amount                          | `bigint`                 |
| `address`           | User address (if provided)                       | `string \| undefined`    |
| `createdAt`         | Timestamp when quote was created                 | `number`                 |
| `fromAssetId`       | Input asset ID                                   | `number`                 |
| `toAssetId`         | Output asset ID                                  | `number`                 |
| `type`              | Quote type (`'fixed-input'` or `'fixed-output'`) | `string`                 |
| `profit`            | Profit information                               | `Profit`                 |
| `priceBaseline`     | Baseline price without fees                      | `number`                 |
| `userPriceImpact`   | Price impact for the user                        | `number \| undefined`    |
| `marketPriceImpact` | Overall market price impact                      | `number \| undefined`    |
| `usdIn`             | USD value of input                               | `number`                 |
| `usdOut`            | USD value of output                              | `number`                 |
| `route`             | Routing path information                         | `Route[]`                |
| `flattenedRoute`    | Flattened routing percentages                    | `Record<string, number>` |
| `quotes`            | Individual DEX quotes                            | `DexQuote[]`             |
| `requiredAppOptIns` | Required app opt-ins                             | `number[]`               |
| `txnPayload`        | Encrypted transaction payload                    | `TxnPayload \| null`     |
| `protocolFees`      | Fees by protocol                                 | `Record<string, number>` |
| `response`          | Raw API response                                 | `FetchQuoteResponse`     |

#### DeflexQuote.getSlippageAmount()

Calculates the slippage-adjusted amount.

- For **fixed-input** swaps: Returns minimum output amount
- For **fixed-output** swaps: Returns maximum input amount

```typescript
getSlippageAmount(slippage: number): bigint
```

| Parameter  | Description                                       | Type     |
| ---------- | ------------------------------------------------- | -------- |
| `slippage` | Slippage tolerance as percentage (e.g., 1 for 1%) | `number` |

**Example:**
```typescript
const quote = await deflex.newQuote({
  fromAssetId: 0,
  toAssetId: 31566704,
  amount: 1_000_000,
  type: 'fixed-input',
})

// Get minimum output with 1% slippage
const minOutput = quote.getSlippageAmount(1)
console.log(`Minimum you'll receive: ${minOutput}`)
```

### SwapComposer

Builder for constructing and executing atomic swap transaction groups, returned by [`newSwap()`](#deflexclientnewswap).

| Method                         | Description                                                                    | Parameters                                            | Returns                               |
| ------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------- |
| `addTransaction(transaction)`  | Add a transaction to the atomic group                                          | `transaction: Transaction`                            | `SwapComposer`                        |
| `addSwapTransactions()`        | Add swap transactions to the group (includes required app opt-ins)             | None                                                  | `Promise<SwapComposer>`               |
| `sign(signer)`                 | Sign the transaction group                                                     | `signer: TransactionSigner`                           | `Promise<Uint8Array[]>`               |
| `submit(signer)`               | Sign and submit the transaction group                                          | `signer: TransactionSigner`                           | `Promise<string[]>`                   |
| `execute(signer, waitRounds?)` | Sign, submit, and wait for confirmation                                        | `signer: TransactionSigner`<br/>`waitRounds?: number` | `Promise<PendingTransactionResponse>` |
| `getStatus()`                  | Get current status: `BUILDING`, `BUILT`, `SIGNED`, `SUBMITTED`, or `COMMITTED` | None                                                  | `ComposerStatus`                      |
| `count()`                      | Get the number of transactions in the group                                    | None                                                  | `number`                              |

## Documentation

For more information about the Deflex Order Router protocol, visit the [official documentation](https://txnlab.gitbook.io/deflex-api).

## License

MIT

## Support

- [GitHub Issues](https://github.com/TxnLab/deflex-js/issues)
- [Discord](https://discord.gg/Ek3dNyzG)
- [TxnLab](https://txnlab.dev)
