// Main client
export { DeflexClient } from './client'

// Swap composer
export { SwapComposer } from './composer'

// Client types
export type {
  DeflexConfigParams,
  GetQuoteParams,
  FetchSwapParams,
  QuoteType,
} from './types'

// Composer types
export type {
  SignerFunction,
  SwapComposerConfig,
  SwapComposerStatus,
  TransactionSigner,
} from './composer'

// API types
export type {
  QuoteResponse,
  Asset,
  Profit,
  PathElement,
  Route,
  DexQuote,
  TxnPayload,
  SwapTxn,
  SwapTxnsResponse,
  SwapTxnSignature,
} from './types'

// Swap processing types
export type { ProcessedTransaction } from './types'

// Constants
export { Protocol } from './constants'

// Utilities
export { HTTPError } from './request'
