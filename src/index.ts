// Main client
export { DeflexClient } from './client'

// Client types
export type {
  DeflexConfigParams,
  GetQuoteParams,
  FetchSwapParams,
  SignSwapParams,
  TransactionSigner,
  QuoteType,
} from './types/client'

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
export type { ProcessSwapResult, ProcessedTransaction } from './types/swap'

// Constants
export { Protocol } from './utils/constants'

// Utilities
export { HTTPError } from './utils/request'
