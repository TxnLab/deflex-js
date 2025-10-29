import type { Protocol } from './constants'
import type algosdk from 'algosdk'

/**
 * Configuration parameters for initializing DeflexClient
 */
export interface DeflexConfigParams {
  /** API key for Deflex API (required) */
  readonly apiKey: string

  /** Algod node URI (default: https://mainnet-api.4160.nodely.dev/) */
  readonly algodUri?: string

  /** Algod node token (can be empty string for public nodes) */
  readonly algodToken?: string

  /** Algod node port (default: 443) */
  readonly algodPort?: string | number

  /** Referrer address for fee sharing (receives 25% of swap fees) */
  readonly referrerAddress?: string

  /** Fee in basis points (default: 15 = 0.15%, max: 300 = 3.00%) */
  readonly feeBps?: number

  /** Automatically detect and add required opt-in transactions (default: false) */
  readonly autoOptIn?: boolean
}

/**
 * Internal configuration with all required fields validated
 *
 * @internal
 */
export type DeflexConfig = Omit<
  Required<DeflexConfigParams>,
  'referrerAddress'
> & {
  readonly referrerAddress: string | undefined
}

/**
 * Swap quote type determining which amount is fixed
 */
export type QuoteType = 'fixed-input' | 'fixed-output'

/**
 * Parameters for requesting a swap quote from the Deflex API (raw API method)
 */
export interface FetchQuoteParams {
  /** Input asset ID */
  readonly fromASAID: bigint | number

  /** Output asset ID */
  readonly toASAID: bigint | number

  /** Amount to swap (in base units) */
  readonly amount: bigint | number

  /** Quote type (default: 'fixed-input') */
  readonly type?: QuoteType

  /** Protocols to exclude from routing (default: []) */
  readonly disabledProtocols?: readonly Protocol[]

  /** Maximum transaction group size (default: 16) */
  readonly maxGroupSize?: number

  /** Maximum depth of the route (default: 4) */
  readonly maxDepth?: number

  /** Whether to include asset opt-in transaction (overrides config.autoOptIn if set) */
  readonly optIn?: boolean

  /** Address of the account that will perform the swap (required if autoOptIn is enabled) */
  readonly address?: string | null
}

/**
 * Asset information from the Deflex API
 */
export interface Asset {
  /** Asset ID */
  readonly id: number
  /** Number of decimal places */
  readonly decimals: number
  /** Unit name */
  readonly unit_name: string
  /** Full asset name */
  readonly name: string
  /** Price in ALGO */
  readonly price_algo: number
  /** Price in USD */
  readonly price_usd: number
}

/**
 * Profit information for a swap
 */
export interface Profit {
  /** Profit amount in base units */
  readonly amount: number
  /** The asset in which profit is denominated */
  readonly asa: Asset
}

/**
 * A single step in a swap route path
 */
export interface PathElement {
  /** Protocol name and fee tier */
  readonly name: string
  /** Protocol class identifier */
  readonly class: string[][]
  /** Input asset */
  readonly in: Asset
  /** Output asset */
  readonly out: Asset
}

/**
 * A route with its percentage of the total swap amount
 */
export interface Route {
  /** Percentage of total swap amount routed through this path */
  readonly percentage: number
  /** The sequence of swaps in this route */
  readonly path: PathElement[]
}

/**
 * Quote from a specific DEX protocol
 */
export interface DexQuote {
  /** Protocol name and fee tier */
  readonly name: string
  /** Protocol class */
  readonly class: string
  /** Quoted output value */
  readonly value: number
}

/**
 * Encrypted transaction payload from the quote
 */
export interface TxnPayload {
  /** Initialization vector for decryption */
  readonly iv: string
  /** Encrypted transaction data */
  readonly data: string
}

/**
 * Quote response from the Deflex API
 */
export interface FetchQuoteResponse {
  /** The quoted output amount or input amount (depending on quote type) */
  readonly quote: string | number
  /** Profit information for the swap */
  readonly profit: Profit
  /** Baseline price without fees */
  readonly priceBaseline: number
  /** Price impact for the user */
  readonly userPriceImpact?: number
  /** Overall market price impact */
  readonly marketPriceImpact?: number
  /** USD value of input amount */
  readonly usdIn: number
  /** USD value of output amount */
  readonly usdOut: number
  /** The routing path(s) for the swap */
  readonly route: Route[]
  /** Flattened view of routing percentages by protocol */
  readonly flattenedRoute: Record<string, number>
  /** Individual quotes from each DEX */
  readonly quotes: DexQuote[]
  /** App IDs that require opt-in for this swap */
  readonly requiredAppOptIns: number[]
  /** Encrypted transaction payload for generating swap transactions */
  readonly txnPayload: TxnPayload | null
  /** Fees charged by each protocol */
  readonly protocolFees: Record<string, number>
  /** Input asset ID */
  readonly fromASAID: number
  /** Output asset ID */
  readonly toASAID: number
  /** Quote type */
  readonly type: string
  /** Performance timing data */
  readonly timing?: unknown
}

/**
 * Enhanced quote result returned by DeflexClient.newQuote()
 *
 * Extends the raw API response with additional metadata and type normalization.
 */
export type DeflexQuote = Omit<FetchQuoteResponse, 'quote'> & {
  /**
   * The quoted output amount or input amount (coerced to bigint)
   *
   * For fixed-input swaps: This is the output amount you'll receive
   * For fixed-output swaps: This is the input amount you'll need to provide
   */
  readonly quote: bigint

  /** The original amount from the quote request (in base units) */
  readonly amount: bigint

  /** The address parameter from the quote request (if provided) */
  readonly address?: string

  /** Timestamp when the quote was created (in milliseconds) */
  readonly createdAt: number
}

/**
 * Transaction signature from the Deflex API
 */
export interface DeflexSignature {
  /** Signature type */
  readonly type: 'logic_signature' | 'secret_key'
  /** Signature data */
  readonly value: unknown
}

/**
 * Transaction data from the Deflex API
 */
export interface DeflexTransaction {
  /** Base64-encoded transaction data */
  readonly data: string
  /** Group ID for the transaction */
  readonly group: string
  /** Logic signature blob (if applicable) */
  readonly logicSigBlob: unknown | false
  /** Signature data (false if user must sign) */
  readonly signature: DeflexSignature | false
}

/**
 * Parameters for fetching executable swap transactions
 */
export interface FetchSwapTxnsParams {
  /** Quote response from fetchQuote() or newQuote() */
  readonly quote: FetchQuoteResponse | DeflexQuote

  /** Algorand address that will sign the transactions */
  readonly address: string

  /** Slippage tolerance as a percentage (e.g., 1 for 1%) */
  readonly slippage: number
}

/**
 * Request body for fetching swap transactions
 *
 * @internal
 */
export interface FetchSwapTxnsBody {
  /** API key for authentication */
  readonly apiKey: string
  /** Address of the account that will sign the transactions */
  readonly address: string
  /** Encrypted transaction payload from the quote */
  readonly txnPayloadJSON: TxnPayload | null
  /** Slippage tolerance as a percentage */
  readonly slippage: number
}

/**
 * Response from fetching swap transactions
 */
export interface FetchSwapTxnsResponse {
  /** Array of transaction data */
  readonly txns: DeflexTransaction[]
}

/**
 * Processed transaction with optional pre-signature
 *
 * @internal
 */
export interface SwapTransaction {
  /** The Algorand transaction */
  readonly txn: algosdk.Transaction
  /** Pre-signature from Deflex (if applicable) */
  readonly deflexSignature?: DeflexSignature
}
