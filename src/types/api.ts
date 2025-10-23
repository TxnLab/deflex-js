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
