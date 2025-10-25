import type { QuoteResponse } from './api'
import type { Protocol } from '@/utils/constants'

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
