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
}

/**
 * Configuration for DeflexClient
 */
export interface DeflexConfigParams {
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
   * API key for Deflex API
   */
  readonly apiKey: string
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
