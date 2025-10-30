# Deflex SDK

TypeScript/JavaScript SDK for [Deflex Order Router](https://txnlab.gitbook.io/deflex-api) - smart order routing and DEX aggregation on Algorand.

## Prerequisites

- **Deflex API Key** - Request an API key by emailing [support@txnlab.dev](mailto:support@txnlab.dev)

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
  fromAssetId: 0, // ALGO
  toAssetId: 31566704, // USDC
  amount: 1_000_000, // 1 ALGO (in microAlgos)
})

// Execute the swap
const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  signer: transactionSigner,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute()

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

// Custom Algod configuration
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
  algodUri: 'https://mainnet-api.4160.nodely.dev/',
  algodToken: '',
  algodPort: 443,
  autoOptIn: true, // Automatically handle asset opt-ins
})

// Earn fees with the referral program
const deflex = new DeflexClient({
  apiKey: 'your-api-key',
  referrerAddress: 'YOUR_ALGORAND_ADDRESS', // Earns 25% of swap fees
  feeBps: 15, // 0.15% fee (max: 300 = 3%)
})
```

By providing your Algorand address as the `referrerAddress` when initializing the client, you can earn 25% of the swap fees generated through your integration. Set the `feeBps` parameter to specify the total fee charged to users (default: 0.15%, max: 3.00%). Learn more about the [Deflex Referral Program](https://txnlab.gitbook.io/deflex-api/referral-treasury/referral-program).

### Get a Swap Quote

The [`newQuote()`](#deflexclientnewquote) method returns a [`DeflexQuote`](#deflexquote) object:

```typescript
// Basic quote
const quote = await deflex.newQuote({
  fromASAID: 0, // ALGO
  toASAID: 31566704, // USDC
  amount: 1_000_000, // 1 ALGO
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
  signer: transactionSigner,
  slippage: 1, // 1% slippage tolerance
})
const result = await swap.execute()

console.log(`Confirmed in round ${result.confirmedRound}`)
console.log('Transaction IDs:', result.txIds)
```

### Transaction Signing

The SDK supports both standard `algosdk.TransactionSigner` and ARC-1 compliant signer functions.

#### 1. use-wallet Signer (Recommended)

Use the `@txnlab/use-wallet` library for wallet management in your dApp:

```typescript
import { useWallet } from '@txnlab/use-wallet-*' // react, vue, solid, or svelte

const { activeAddress, transactionSigner } = useWallet()

const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  signer: transactionSigner,
  slippage: 1,
})
await swap.execute()
```

> **Tip**: The [`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet) library supports multiple wallet providers (Pera, Defly, Lute, WalletConnect, etc.) and provides a unified interface. Choose the framework-specific adapter for your project: `@txnlab/use-wallet-react`, `@txnlab/use-wallet-vue`, `@txnlab/use-wallet-solid`, or `@txnlab/use-wallet-svelte`.

#### 2. Custom Signer Function

The SDK accepts custom signer functions that receive the complete transaction group and an array of indexes indicating which transactions need signing:

```typescript
import { Address, encodeUnsignedTransaction, type Transaction } from 'algosdk'

// Example: Wrapping an ARC-1 compliant wallet
const customSigner = async (
  txnGroup: Transaction[],
  indexesToSign: number[],
) => {
  // Convert to wallet's expected format
  const walletTxns = txnGroup.map((txn, index) => ({
    txn: Buffer.from(encodeUnsignedTransaction(txn)).toString('base64'),
    signers: indexesToSign.includes(index)
      ? [Address.fromString(activeAddress)]
      : [],
  }))

  // Sign with wallet provider
  const signedTxns = await walletProvider.signTxns(walletTxns)

  return signedTxns
}

const swap = await deflex.newSwap({
  quote,
  address: activeAddress,
  signer: customSigner,
  slippage: 1,
})
await swap.execute()
```

The signer function supports two return patterns:
- **Pattern 1** (Pera, Defly, algosdk): Returns only the signed transactions as `Uint8Array[]`
- **Pattern 2** (Lute, ARC-1 compliant): Returns an array matching the transaction group length with `null` for unsigned transactions as `(Uint8Array | null)[]`

Both patterns are automatically handled by the SDK.

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
  signer: transactionSigner,
  slippage: 1,
})

const result = await swap
  .addTransaction(customTxn1)     // Add transaction before swap
  .addSwapTransactions()          // Add swap transactions
  .addTransaction(customTxn2)     // Add transaction after swap
  .execute()                      // Sign and execute entire group
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
    signer: transactionSigner,
    slippage: 1,
  })
  const result = await swap.execute()

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
| `apiBaseUrl`      | Base URL for the Deflex API                                  | `string`           | `https://deflex.txnlab.dev`            |
| `algodUri`        | Algod node URI                                               | `string`           | `https://mainnet-api.4160.nodely.dev/` |
| `algodToken`      | Algod node token                                             | `string`           | `''`                                   |
| `algodPort`       | Algod node port                                              | `string \| number` | `443`                                  |
| `referrerAddress` | Referrer address for fee sharing (receives 25% of swap fees) | `string`           | `undefined`                            |
| `feeBps`          | Fee in basis points (0.15%, max: 300 = 3.00%)                | `number`           | `15`                                   |
| `autoOptIn`       | Auto-detect and add required opt-in transactions             | `boolean`          | `false`                                |

> **Referral Program**: By providing a `referrerAddress`, you can earn 25% of the swap fees generated through your integration. The `feeBps` parameter sets the total fee charged (default: 0.15%). Learn more about the [Deflex Referral Program](https://txnlab.gitbook.io/deflex-api/referral-treasury/referral-program).

#### DeflexClient.newQuote()

Fetch a swap quote and return a [`DeflexQuote`](#deflexquote) object.

```typescript
async newQuote(params: FetchQuoteParams): Promise<DeflexQuote>
```

| Parameter           | Description                                | Type                              | Default         |
| ------------------- | ------------------------------------------ | --------------------------------- | --------------- |
| `fromASAID`         | Input asset ID                             | `bigint \| number`                | **required**    |
| `toASAID`           | Output asset ID                            | `bigint \| number`                | **required**    |
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

| Parameter  | Description                                       | Type                                                                                                                                    |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `quote`    | Quote result or raw API response                  | `DeflexQuote \| FetchQuoteResponse`                                                                                                     |
| `address`  | Signer address                                    | `string`                                                                                                                                |
| `slippage` | Slippage tolerance as percentage (e.g., 1 for 1%) | `number`                                                                                                                                |
| `signer`   | Transaction signer function                       | `algosdk.TransactionSigner \| ((txnGroup: Transaction[], indexesToSign: number[]) => Promise<(Uint8Array \| null)[]>)` |

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

Plain object returned by [`newQuote()`](#deflexclientnewquote). Extends the raw API response with additional metadata.

**Additional properties added by SDK:**

| Property    | Description                         | Type                  |
| ----------- | ----------------------------------- | --------------------- |
| `quote`     | Quoted amount (coerced to `bigint`) | `bigint`              |
| `amount`    | Original request amount             | `bigint`              |
| `address`   | User address (if provided)          | `string \| undefined` |
| `createdAt` | Timestamp when quote was created    | `number`              |

**All properties from API response:**

| Property            | Description                                      | Type                     |
| ------------------- | ------------------------------------------------ | ------------------------ |
| `fromASAID`         | Input asset ID                                   | `number`                 |
| `toASAID`           | Output asset ID                                  | `number`                 |
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
| `timing`            | Performance timing data                          | `unknown \| undefined`   |

### SwapComposer

Builder for constructing and executing atomic swap transaction groups, returned by [`newSwap()`](#deflexclientnewswap).

| Method                        | Description                                                                    | Parameters                         | Returns                               |
| ----------------------------- | ------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------- |
| `addTransaction(transaction)` | Add a transaction to the atomic group                                          | `transaction: algosdk.Transaction` | `SwapComposer`                        |
| `addSwapTransactions()`       | Add swap transactions to the group (includes required app opt-ins)             | None                               | `Promise<SwapComposer>`               |
| `sign()`                      | Sign the transaction group                                                     | None                               | `Promise<Uint8Array[]>`               |
| `submit()`                    | Sign and submit the transaction group                                          | None                               | `Promise<string[]>`                   |
| `execute(waitRounds?)`        | Sign, submit, and wait for confirmation                                        | `waitRounds?: number` (default: 4) | `Promise<PendingTransactionResponse>` |
| `getStatus()`                 | Get current status: `BUILDING`, `BUILT`, `SIGNED`, `SUBMITTED`, or `COMMITTED` | None                               | `ComposerStatus`                      |
| `count()`                     | Get the number of transactions in the group                                    | None                               | `number`                              |

## Documentation

For more information about the Deflex Order Router protocol, visit the [official documentation](https://txnlab.gitbook.io/deflex-api).

## License

MIT

## Support

- [GitHub Issues](https://github.com/TxnLab/deflex-js/issues)
- [Discord](https://discord.gg/Ek3dNyzG)
- [TxnLab](https://txnlab.dev)
