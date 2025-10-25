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
} from './types/client'

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
} from './types/api'

// Swap processing types
export type { ProcessedTransaction } from './types/swap'

// Constants
export { Protocol } from './utils/constants'

// Utilities
export { HTTPError } from './utils/request'
