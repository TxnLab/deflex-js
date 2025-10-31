# Deflex SDK - Node.js CLI Example

This example demonstrates how to use the Deflex SDK in a Node.js command-line application with a custom transaction signer.

## Features

- Command-line interface for executing swaps
- Custom signer implementation using `algosdk.Account`
- Environment variable configuration
- Detailed console output with swap progress
- TypeScript with strict mode enabled

## Prerequisites

- **Deflex API Key** - Request an API key by emailing [support@txnlab.dev](mailto:support@txnlab.dev)
- Node.js >= 20
- pnpm 10.20.0 or later

## Setup

1. Install dependencies from the repository root:

```bash
pnpm install
```

2. Create a `.env` file in this directory:

```bash
cp .env.example .env
```

3. Configure your `.env` file:

```env
# Required: Your Deflex API key
DEFLEX_API_KEY=your-api-key-here

# Required: Your 25-word account mnemonic
# WARNING: Keep this file private and never commit it!
ACCOUNT_MNEMONIC="your twenty five word mnemonic phrase goes here"

# Optional: Swap parameters (defaults shown)
FROM_ASSET_ID=0           # ALGO
TO_ASSET_ID=31566704      # USDC
AMOUNT=1000000            # 1 ALGO (in microAlgos)
SLIPPAGE=1                # 1% slippage tolerance
```

**⚠️ SECURITY WARNING**: Never commit your `.env` file or share your mnemonic phrase!

## Development

Build and run:

```bash
pnpm dev
```

Or build separately:

```bash
pnpm build
pnpm start
```

## Usage

Once configured, simply run:

```bash
pnpm dev
```

The CLI will:
1. Load configuration from `.env`
2. Display swap parameters
3. Fetch a quote from Deflex API
4. Show quote details (output amount, price impact, routing)
5. Execute the swap
6. Display transaction IDs and confirmation

### Example Output

```
🚀 Deflex CLI Swap Tool

📋 Configuration:
   From Asset: 0
   To Asset: 31566704
   Amount: 1.000000 (1000000 microunits)
   Slippage: 1%

💼 Using account: ABCD...XYZ

📊 Fetching quote...
✅ Quote received:
   Expected output: 0.123456 tokens
   Price impact: 0.0123%
   USD In: $1.00
   USD Out: $0.99
   Route paths: 2
   Flattened route: { 'Tinyman': 0.6, 'Folks': 0.4 }

🔄 Executing swap...
✨ Swap completed successfully!
   Confirmed in round: 12345678
   Transaction IDs:
     1. ABC123...
     2. DEF456...

🔗 View on allo: https://allo.info/tx/ABC123...
```

## Custom Signer Implementation

This example shows how to implement a custom transaction signer without using `@txnlab/use-wallet`:

```typescript
async function createAccountSigner(mnemonic: string) {
  const account = algosdk.mnemonicToSecretKey(mnemonic)

  return async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    return indexesToSign.map((index) => {
      return algosdk.signTransaction(txnGroup[index], account.sk).blob
    })
  }
}
```

The signer receives:
- `txnGroup`: The complete transaction group (for wallet validation)
- `indexesToSign`: Array of indexes indicating which transactions need signing

This pattern can be adapted for other signing methods (KMD, hardware wallets, etc.).

## Notes

- This example uses mainnet by default
- Make sure you have sufficient ALGO/assets in your account
- The SDK automatically handles asset opt-ins when needed
- All swap parameters can be configured via environment variables
- Never commit your `.env` file with real credentials
