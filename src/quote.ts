import type {
  FetchQuoteResponse,
  Profit,
  Route,
  DexQuote,
  TxnPayload,
} from './types'

/**
 * Configuration for creating a DeflexQuote instance
 */
export interface DeflexQuoteConfig {
  /** The raw quote response from the Deflex API */
  response: FetchQuoteResponse
  /** The original amount from the quote request */
  amount: bigint | number
  /** Optional address parameter from the quote request */
  address?: string
}

/**
 * Wrapper class for Deflex quote responses with convenience methods
 *
 * The DeflexQuote class provides a developer-friendly interface for working with
 * swap quotes from the Deflex API. It exposes all quote properties via getters
 * and provides additional convenience methods for derived data.
 *
 * @example
 * ```typescript
 * const quote = await deflex.newQuote({
 *   address: 'ABC...',
 *   fromAssetId: 0,
 *   toAssetId: 31566704,
 *   amount: 1_000_000,
 * })
 *
 * // Access quote properties directly
 * console.log(quote.quote)              // bigint (quoted amount)
 * console.log(quote.fromAssetId)        // number
 * console.log(quote.toAssetId)          // number
 *
 * // Access metadata
 * console.log(quote.amount)             // bigint (original request amount)
 * console.log(quote.address)            // string | undefined
 * console.log(quote.createdAt)          // number
 *
 * // Use convenience methods for derived data
 * const minReceivedAmount = quote.getSlippageAmount(slippage) // fixed-input swap
 * const maxSentAmount = quote.getSlippageAmount(slippage) // fixed-output swap
 * ```
 */
export class DeflexQuote {
  private readonly _response: FetchQuoteResponse
  private readonly _amount: bigint
  private readonly _address?: string
  private readonly _createdAt: number

  /**
   * Create a new DeflexQuote instance
   *
   * Note: Most developers should use DeflexClient.newQuote() instead of constructing
   * this directly, as the factory method handles fetching the quote automatically.
   *
   * @param config - Configuration for the quote instance
   * @param config.response - The raw quote response from the Deflex API
   * @param config.amount - The original amount from the quote request
   * @param config.address - Optional address parameter from the quote request
   */
  constructor(config: DeflexQuoteConfig) {
    if (!config?.response) {
      throw new Error('Quote response is required')
    }
    if (config.amount === undefined || config.amount === null) {
      throw new Error('Amount is required')
    }
    this._response = config.response
    this._amount = BigInt(config.amount)
    this._address = config.address
    this._createdAt = Date.now()
  }

  /**
   * Get the raw quote response from the Deflex API
   *
   * @returns The raw quote response from the Deflex API
   */
  get response(): FetchQuoteResponse {
    return this._response
  }

  // ============================================================================
  // Quote Metadata (not from API response)
  // ============================================================================

  /**
   * The original amount from the quote request (in base units)
   *
   * This is the amount that was provided when fetching the quote.
   * For fixed-input swaps, this is the input amount.
   * For fixed-output swaps, this is the desired output amount.
   *
   * @example
   * ```typescript
   * const quote = await deflex.newQuote({
   *   fromAssetId: 0,
   *   toAssetId: 31566704,
   *   amount: 1_000_000, // 1 ALGO
   *   type: 'fixed-input'
   * })
   * console.log(quote.amount) // 1000000n (input amount)
   * console.log(quote.quote)  // 5000000n (output amount quoted)
   * ```
   */
  get amount(): bigint {
    return this._amount
  }

  /**
   * The address parameter from the quote request
   *
   * This is the address that was provided when fetching the quote (if any).
   * Useful for tracking which account the quote was fetched for, especially
   * when using autoOptIn functionality.
   */
  get address(): string | undefined {
    return this._address
  }

  /**
   * Timestamp when the quote was created (in milliseconds)
   *
   * Can be used to determine quote freshness. Quotes may become stale
   * over time as market conditions change.
   *
   * @example
   * ```typescript
   * const ageInSeconds = (Date.now() - quote.createdAt) / 1000
   * if (ageInSeconds > 30) {
   *   console.log('Quote may be stale, consider refreshing')
   * }
   * ```
   */
  get createdAt(): number {
    return this._createdAt
  }

  // ============================================================================
  // Quote Response Properties (exposed via getters)
  // ============================================================================

  /**
   * The quoted output amount or input amount (depending on quote type)
   *
   * For fixed-input swaps: This is the output amount you'll receive
   * For fixed-output swaps: This is the input amount you'll need to provide
   *
   * @returns The quote amount as a bigint in base units
   */
  get quote(): bigint {
    const rawQuote = this._response.quote
    return rawQuote === '' ? 0n : BigInt(rawQuote)
  }

  /**
   * Profit information for the swap
   */
  get profit(): Profit {
    return this._response.profit
  }

  /**
   * Baseline price without fees
   */
  get priceBaseline(): number {
    return this._response.priceBaseline
  }

  /**
   * Price impact for the user
   */
  get userPriceImpact(): number | undefined {
    return this._response.userPriceImpact
  }

  /**
   * Overall market price impact
   */
  get marketPriceImpact(): number | undefined {
    return this._response.marketPriceImpact
  }

  /**
   * USD value of input amount
   */
  get usdIn(): number {
    return this._response.usdIn
  }

  /**
   * USD value of output amount
   */
  get usdOut(): number {
    return this._response.usdOut
  }

  /**
   * The routing path(s) for the swap
   */
  get route(): Route[] {
    return this._response.route
  }

  /**
   * Flattened view of routing percentages by protocol
   */
  get flattenedRoute(): Record<string, number> {
    return this._response.flattenedRoute
  }

  /**
   * Individual quotes from each DEX
   */
  get quotes(): DexQuote[] {
    return this._response.quotes
  }

  /**
   * App IDs that require opt-in for this swap
   */
  get requiredAppOptIns(): number[] {
    return this._response.requiredAppOptIns
  }

  /**
   * Encrypted transaction payload for generating swap transactions
   */
  get txnPayload(): TxnPayload | null {
    return this._response.txnPayload
  }

  /**
   * Fees charged by each protocol
   */
  get protocolFees(): Record<string, number> {
    return this._response.protocolFees
  }

  /**
   * Input asset ID
   */
  get fromAssetId(): number {
    return this._response.fromASAID
  }

  /**
   * Output asset ID
   */
  get toAssetId(): number {
    return this._response.toASAID
  }

  /**
   * Quote type
   */
  get type(): string {
    return this._response.type
  }

  /**
   * Performance timing data
   */
  get timing(): unknown | undefined {
    return this._response.timing
  }

  // ============================================================================
  // Convenience Methods (derived/computed properties)
  // ============================================================================

  /**
   * Calculate the slippage-adjusted amount
   *
   * For fixed-input swaps: Returns the minimum amount you'll receive after slippage
   * For fixed-output swaps: Returns the maximum amount you'll need to send after slippage
   *
   * @param slippage - Slippage tolerance as a percentage (e.g., 1 for 1%)
   * @returns The slippage-adjusted amount as a bigint
   *
   * @example
   * ```typescript
   * // Fixed-input swap: 1 ALGO -> USDC
   * const quote = await deflex.newQuote({
   *   fromAssetId: 0,
   *   toAssetId: 31566704,
   *   amount: 1_000_000,
   *   type: 'fixed-input'
   * })
   *
   * // Get minimum output with 1% slippage
   * const minOutput = quote.getSlippageAmount(1)
   * console.log(`Minimum you'll receive: ${minOutput}`)
   * ```
   *
   * @example
   * ```typescript
   * // Fixed-output swap: ALGO -> 10 USDC
   * const quote = await deflex.newQuote({
   *   fromAssetId: 0,
   *   toAssetId: 31566704,
   *   amount: 10_000_000,
   *   type: 'fixed-output'
   * })
   *
   * // Get maximum input with 1% slippage
   * const maxInput = quote.getSlippageAmount(1)
   * console.log(`Maximum you'll need to send: ${maxInput}`)
   * ```
   */
  getSlippageAmount(slippage: number): bigint {
    const quoteAmount = this.quote
    const slippageBps = BigInt(Math.floor(slippage * 100))

    if (this._response.type === 'fixed-input') {
      // For fixed-input: reduce output by slippage (minimum received)
      return (quoteAmount * (10000n - slippageBps)) / 10000n
    } else {
      // For fixed-output: increase input by slippage (maximum sent)
      return (quoteAmount * (10000n + slippageBps)) / 10000n
    }
  }
}
