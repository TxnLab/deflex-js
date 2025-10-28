import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { isValidAddress } from 'algosdk'
import { SwapComposer, type SignerFunction } from './composer'
import {
  DEFAULT_ALGOD_PORT,
  DEFAULT_ALGOD_TOKEN,
  DEFAULT_ALGOD_URI,
  DEFAULT_API_BASE_URL,
  DEFAULT_AUTO_OPT_IN,
  DEFAULT_FEE_BPS,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_GROUP_SIZE,
  DEPRECATED_PROTOCOLS,
  MAX_FEE_BPS,
} from './constants'
import { DeflexQuote } from './quote'
import { request } from './utils'
import type {
  FetchQuoteResponse,
  FetchSwapTxnsResponse,
  DeflexConfig,
  DeflexConfigParams,
  FetchSwapTxnsParams,
  FetchSwapTxnsBody,
  FetchQuoteParams,
  QuoteParams,
} from './types'

/**
 * Client for interacting with the Deflex order router API
 *
 * The DeflexClient provides methods to fetch swap quotes and create transaction composers
 * for executing swaps on the Algorand blockchain. It handles API communication, transaction
 * validation, and automatic asset/app opt-in detection.
 *
 * @example
 * ```typescript
 * const deflex = new DeflexClient({
 *   apiKey: 'your-api-key',
 * })
 * ```
 *
 * @example
 * ```typescript
 * const deflex = new DeflexClient({
 *   apiKey: 'your-api-key',
 *   algodUri: 'https://mainnet-api.4160.nodely.dev/',
 *   algodToken: '',
 *   algodPort: 443,
 *   referrerAddress: 'REFERRER_ADDRESS...',
 *   feeBps: 15,
 *   autoOptIn: false,
 * })
 * ```
 */
export class DeflexClient {
  private readonly baseUrl: string = DEFAULT_API_BASE_URL
  private readonly config: DeflexConfig
  private readonly algorand: AlgorandClient

  /**
   * Create a new DeflexClient instance
   *
   * @param config - Configuration parameters
   * @param config.apiKey - API key for Deflex API (required)
   * @param config.algodUri - Algod node URI (default: https://mainnet-api.4160.nodely.dev/)
   * @param config.algodToken - Algod node token (default: '')
   * @param config.algodPort - Algod node port (default: 443)
   * @param config.referrerAddress - Referrer address for fee sharing (receives 25% of swap fees)
   * @param config.feeBps - Fee in basis points (default: 15 = 0.15%, max: 300 = 3.00%)
   * @param config.autoOptIn - Automatically detect and add required opt-in transactions (default: false)
   */
  constructor(config: DeflexConfigParams) {
    // Validate and set config
    this.config = {
      apiKey: this.validateApiKey(config.apiKey),
      algodUri: config.algodUri ?? DEFAULT_ALGOD_URI,
      algodToken: config.algodToken ?? DEFAULT_ALGOD_TOKEN,
      algodPort: config.algodPort ?? DEFAULT_ALGOD_PORT,
      referrerAddress: config.referrerAddress
        ? this.validateAddress(config.referrerAddress)
        : undefined,
      feeBps: this.validateFeeBps(config.feeBps ?? DEFAULT_FEE_BPS),
      autoOptIn: config.autoOptIn ?? DEFAULT_AUTO_OPT_IN,
    }

    // Create AlgorandClient
    this.algorand = AlgorandClient.fromConfig({
      algodConfig: {
        server: this.config.algodUri,
        port: this.config.algodPort,
        token: this.config.algodToken,
      },
    })
  }

  /**
   * Fetch a swap quote from the Deflex API
   *
   * Requests optimal swap routing from the Deflex API. The quote includes routing
   * information, price impact, required opt-ins, and an encrypted transaction payload.
   *
   * @param params - Parameters for the quote request
   * @param params.fromASAID - The ID of the asset to swap from
   * @param params.toASAID - The ID of the asset to swap to
   * @param params.amount - The amount of the asset to swap in base units
   * @param params.type - The type of the quote (default: 'fixed-input')
   * @param params.disabledProtocols - List of protocols to disable (default: [])
   * @param params.maxGroupSize - The maximum group size (default: 16)
   * @param params.maxDepth - The maximum depth (default: 4)
   * @param params.address - The address of the account that will perform the swap (recommended when using `config.autoOptIn` or `params.optIn`)
   * @param params.optIn - Whether to include asset opt-in transaction
   *   - If true: API reduces maxGroupSize by 1 and includes opt-in (always included, even if not needed)
   *   - If false: No opt-in transaction included
   *   - If undefined: Falls back to `config.autoOptIn` behavior with account check (if `params.address` is provided)
   * @returns A FetchQuoteResponse object with routing information
   *
   * @example
   * ```typescript
   * const quote = await deflex.fetchQuote({
   *   address: 'ABC...',
   *   fromASAID: 0,           // ALGO
   *   toASAID: 31566704,      // USDC
   *   amount: 1_000_000,      // 1 ALGO
   * })
   * ```
   */
  async fetchQuote(params: FetchQuoteParams): Promise<FetchQuoteResponse> {
    const {
      fromASAID,
      toASAID,
      amount,
      type = 'fixed-input',
      disabledProtocols = [],
      maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
      maxDepth = DEFAULT_MAX_DEPTH,
      optIn,
      address,
    } = params

    // Always include deprecated protocols in disabled list
    const allDisabledProtocols = [
      ...new Set([...DEPRECATED_PROTOCOLS, ...disabledProtocols]),
    ]

    let includeOptIn = optIn
    if (includeOptIn === undefined && this.config.autoOptIn) {
      if (address) {
        includeOptIn = await this.needsAssetOptIn(
          this.validateAddress(address),
          toASAID,
        )
      } else {
        console.warn(
          'autoOptIn is enabled but no address provided to fetchQuote(). Asset opt-in check skipped.',
        )
      }
    }

    const url = new URL(`${this.baseUrl}/fetchQuote`)

    url.searchParams.append('apiKey', this.config.apiKey)
    url.searchParams.append('algodUri', this.config.algodUri)
    url.searchParams.append('algodToken', this.config.algodToken)
    url.searchParams.append('algodPort', String(this.config.algodPort))
    url.searchParams.append('feeBps', this.config.feeBps.toString())
    url.searchParams.append('fromASAID', BigInt(fromASAID).toString())
    url.searchParams.append('toASAID', BigInt(toASAID).toString())
    url.searchParams.append('amount', BigInt(amount).toString())
    url.searchParams.append('type', type)
    url.searchParams.append('disabledProtocols', allDisabledProtocols.join(','))
    url.searchParams.append('maxGroupSize', maxGroupSize.toString())
    url.searchParams.append('maxDepth', maxDepth.toString())
    url.searchParams.append('optIn', String(includeOptIn))

    if (this.config.referrerAddress) {
      url.searchParams.append('referrerAddress', this.config.referrerAddress)
    }

    return request<FetchQuoteResponse>(url.toString())
  }

  /**
   * Check if asset opt-in is required for the output asset
   *
   * Convenience method to determine if an address needs to opt into the output asset
   * of a swap. This is useful when you want to get a quote without requiring wallet
   * connection upfront, but need to know whether to set `optIn: true` in fetchQuote()
   * to ensure proper routing (as opt-ins reduce maxGroupSize by 1).
   *
   * Note: If you enable `config.autoOptIn`, this check is handled automatically when
   * an address is provided to fetchQuote().
   *
   * @param address - The address to check
   * @param assetId - The output asset ID to check
   * @returns True if asset opt-in is required, false otherwise (always false for ALGO)
   *
   * @example
   * ```typescript
   * // Check if opt-in needed for output asset before fetching quote
   * const needsOptIn = await deflex.needsAssetOptIn(userAddress, toAssetId)
   * const quote = await deflex.fetchQuote({
   *   fromAssetId,
   *   toAssetId,
   *   amount,
   *   optIn: needsOptIn,
   * })
   * ```
   */
  async needsAssetOptIn(
    address: string,
    assetId: number | bigint,
  ): Promise<boolean> {
    // Fetch account information
    const accountInfo = await this.algorand.account.getInformation(address)

    // Check if asset opt-in is required
    return (
      BigInt(assetId) !== 0n &&
      accountInfo?.assets?.find(
        (asset) => asset.assetId === BigInt(assetId),
      ) === undefined
    )
  }

  /**
   * Fetch swap transactions from the Deflex API
   *
   * Decrypts the quote payload and generates executable swap transactions for the
   * specified signer address with the given slippage tolerance.
   *
   * @param params - Parameters for the swap transaction request
   * @param params.quote - The quote response from fetchQuote()
   * @param params.address - The address of the signer
   * @param params.slippage - The slippage tolerance as a percentage (e.g., 1 for 1%)
   * @returns A FetchSwapTxnsResponse object with transaction data
   */
  async fetchSwapTransactions(
    params: FetchSwapTxnsParams,
  ): Promise<FetchSwapTxnsResponse> {
    const { quote, address, slippage } = params

    // Validate signer address
    this.validateAddress(address)

    const url = new URL(`${this.baseUrl}/fetchExecuteSwapTxns`)

    const body: FetchSwapTxnsBody = {
      apiKey: this.config.apiKey,
      address,
      txnPayloadJSON: quote.txnPayload,
      slippage,
    }

    return request<FetchSwapTxnsResponse>(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * Fetch a quote and return a DeflexQuote wrapper instance
   *
   * This is the recommended way to fetch quotes. It wraps the raw API response
   * in a DeflexQuote class that provides convenient methods for accessing quote data.
   *
   * @param params - Parameters for the quote request
   * @param params.fromAssetId - The ID of the asset to swap from
   * @param params.toAssetId - The ID of the asset to swap to
   * @param params.amount - The amount of the asset to swap in base units
   * @param params.type - The type of the quote (default: 'fixed-input')
   * @param params.disabledProtocols - List of protocols to disable (default: [])
   * @param params.maxGroupSize - The maximum group size (default: 16)
   * @param params.maxDepth - The maximum depth (default: 4)
   * @param params.address - The address of the account that will perform the swap (recommended when using `config.autoOptIn` or `params.optIn`)
   * @param params.optIn - Whether to include asset opt-in transaction
   * @returns A DeflexQuote instance with convenience methods
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
   * // Access quote data
   * console.log(quote.quote)                 // bigint (quoted amount)
   * console.log(quote.fromAssetId)           // number
   * console.log(quote.toAssetId)             // number
   *
   * // Access metadata
   * console.log(quote.amount)                // bigint (original request amount)
   * console.log(quote.address)               // string | undefined
   * console.log(quote.createdAt)             // number
   *
   * // Use convenience methods
   * const minReceivedAmount = quote.getSlippageAmount(slippage) // fixed-input swap
   * const maxSentAmount = quote.getSlippageAmount(slippage) // fixed-output swap
   * ```
   */
  async newQuote(params: QuoteParams): Promise<DeflexQuote> {
    const response = await this.fetchQuote({
      fromASAID: params.fromAssetId,
      toASAID: params.toAssetId,
      amount: params.amount,
      type: params.type,
      disabledProtocols: params.disabledProtocols,
      maxGroupSize: params.maxGroupSize,
      maxDepth: params.maxDepth,
      optIn: params.optIn,
      address: params.address,
    })

    // Create the quote wrapper
    const quote = new DeflexQuote({
      response,
      amount: params.amount,
      address: params.address,
    })

    return quote
  }

  /**
   * Create a SwapComposer instance
   *
   * This factory method creates a composer that allows you to add custom transactions
   * before and after the swap transactions, with automatic handling of pre-signed transactions
   * and opt-ins.
   *
   * @param config.quote - The quote response from fetchQuote() or a DeflexQuote instance
   * @param config.address - The address of the signer
   * @param config.slippage - The slippage tolerance
   * @param config.signer - Transaction signer function
   * @returns A SwapComposer instance ready for building transaction groups
   *
   * @example
   * ```typescript
   * // Basic swap
   * const quote = await deflex.newQuote({ ... })
   * await deflex.newSwap({ quote, address, slippage, signer })
   *   .execute()
   * ```
   *
   * @example
   * ```typescript
   * // Advanced swap with custom transactions
   * const quote = await deflex.newQuote({ ... })
   * const swap = await deflex.newSwap({
   *   quote,
   *   address,
   *   slippage,
   *   signer,
   * })
   *
   * console.log(swap.getStatus()) // BUILDING
   *
   * const signedTxns = await swap
   *   .addTransaction(beforeTxn)
   *   .addSwapTransactions() // Adds swap transactions to the group
   *   .addTransaction(afterTxn)
   *   .sign()
   *
   * console.log(swap.getStatus()) // SIGNED
   *
   * const result = await swap.execute(waitRounds)
   * console.log(result.confirmedRound, result.txIds)
   *
   * console.log(swap.getStatus()) // COMMITTED
   * ```
   */
  async newSwap(config: {
    quote: DeflexQuote | FetchQuoteResponse
    address: string
    slippage: number
    signer: SignerFunction
  }): Promise<SwapComposer> {
    const { quote, address, slippage, signer } = config

    const quoteResponse = quote instanceof DeflexQuote ? quote.response : quote

    const swapResponse = await this.fetchSwapTransactions({
      quote: quoteResponse,
      address,
      slippage,
    })

    // Create the composer
    const composer = new SwapComposer({
      quote: quoteResponse,
      deflexTxns: swapResponse.txns,
      algorand: this.algorand,
      address,
      signer,
    })

    return composer
  }

  /**
   * Validates the API key
   */
  private validateApiKey(apiKey: string): string {
    if (!apiKey) {
      throw new Error('API key is required')
    }
    return apiKey
  }

  /**
   * Validates an Algorand address
   */
  private validateAddress(address: string): string {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid Algorand address: ${address}`)
    }
    return address
  }

  /**
   * Validates the fee in basis points (max 300 = 3.00%)
   */
  private validateFeeBps(feeBps: number): number {
    if (feeBps < 0 || feeBps > MAX_FEE_BPS) {
      throw new Error(
        `Invalid fee: ${feeBps} basis points (must be between 0 and ${MAX_FEE_BPS})`,
      )
    }
    return feeBps
  }
}
