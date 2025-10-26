import type { Protocol } from './constants'
import type algosdk from 'algosdk'

/**
 * Configuration for DeflexClient
 */
export interface DeflexConfigParams {
  /**
   * API key for Deflex API
   */
  readonly apiKey: string

  /**
   * Algod node URI (default: https://mainnet-api.4160.nodely.dev/)
   */
  readonly algodUri?: string

  /**
   * Algod node token (can be empty string for public nodes)
   */
  readonly algodToken?: string

  /**
   * Algod node port (default: 443)
   */
  readonly algodPort?: string | number

  /**
   * Referrer address for fee sharing
   */
  readonly referrerAddress?: string

  /**
   * Fee in basis points (default: 22 = 0.22%)
   */
  readonly feeBps?: number

  /**
   * Automatically detect and add required opt-in transactions (default: true)
   */
  readonly autoOptIn?: boolean
}

/**
 * Internal configuration (all required, validated)
 */
export type DeflexConfig = Omit<
  Required<DeflexConfigParams>,
  'referrerAddress'
> & {
  readonly referrerAddress: string | undefined
}

/**
 * Swap quote type
 */
export type QuoteType = 'fixed-input' | 'fixed-output'

/**
 * Parameters for requesting a swap quote
 */
export interface GetQuoteParams {
  /**
   * Input asset ID
   */
  readonly fromAssetId: bigint | number

  /**
   * Output asset ID
   */
  readonly toAssetId: bigint | number

  /**
   * Amount to swap (in base units)
   */
  readonly amount: bigint | number

  /**
   * Quote type (default: 'fixed-input')
   */
  readonly type?: QuoteType

  /**
   * Protocols to exclude from routing (default: [])
   */
  readonly disabledProtocols?: readonly Protocol[]

  /**
   * Maximum transaction group size (default: 16)
   */
  readonly maxGroupSize?: number

  /**
   * Maximum depth of the route (default: 4)
   */
  readonly maxDepth?: number

  /**
   * Only allow atomic (single block) swaps (default: true)
   */
  readonly atomicOnly?: boolean

  /**
   * Whether to include asset opt-in transaction (overrides config.autoOptIn if set)
   */
  readonly optIn?: boolean

  /**
   * Address of the account that will perform the swap
   */
  readonly address?: string
}

/**
 * Parameters for fetching swap transactions
 */
export interface FetchSwapParams {
  /**
   * Quote response from getQuote()
   */
  readonly quote: QuoteResponse

  /**
   * Algorand address that will sign the transactions
   */
  readonly signerAddress: string

  /**
   * Slippage tolerance as a percentage (e.g., 5 for 5%)
   */
  readonly slippage: number
}

/**
 * Asset information
 */
export interface Asset {
  readonly id: number
  readonly decimals: number
  readonly unit_name: string
  readonly name: string
  readonly price_algo: number
  readonly price_usd: number
}

/**
 * Profit information
 */
export interface Profit {
  readonly amount: number
  readonly asa: Asset
}

/**
 * Path element in a route
 */
export interface PathElement {
  readonly name: string
  readonly class: string[][]
  readonly in: Asset
  readonly out: Asset
}

/**
 * Route with percentage split
 */
export interface Route {
  readonly percentage: number
  readonly path: PathElement[]
}

/**
 * Quote from a specific DEX
 */
export interface DexQuote {
  readonly class: string
  readonly name: string
  readonly value: number
}

/**
 * Transaction payload (encrypted)
 */
export interface TxnPayload {
  readonly iv: string
  readonly data: string
}

/**
 * Quote response from the Deflex API
 */
export interface QuoteResponse {
  readonly quote: string | number
  readonly profit: Profit
  readonly priceBaseline: number
  readonly userPriceImpact?: number
  readonly marketPriceImpact?: number
  readonly usdIn: number
  readonly usdOut: number
  readonly route: Route[]
  readonly flattenedRoute: Record<string, number>
  readonly quotes: DexQuote[]
  readonly requiredAppOptIns: number[]
  readonly txnPayload: TxnPayload | null
  readonly protocolFees: Record<string, number>
  readonly fromASAID: number
  readonly toASAID: number
  readonly type: string
  readonly timing?: unknown
}

/**
 * Transaction signature from swap API
 */
export interface SwapTxnSignature {
  readonly type: 'logic_signature' | 'secret_key'
  readonly value: unknown
}

/**
 * Transaction from swap API
 */
export interface SwapTxn {
  readonly data: string
  readonly group: string
  readonly logicSigBlob: unknown | false
  readonly signature: SwapTxnSignature | false
}

/**
 * Swap transactions response from the Deflex API
 */
export interface SwapTxnsResponse {
  readonly txns: SwapTxn[]
}

/**
 * Processed transaction with signature metadata
 */
export interface ProcessedTransaction {
  readonly txn: algosdk.Transaction
  readonly deflexSignature?: SwapTxnSignature
}
