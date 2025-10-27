import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { isValidAddress } from 'algosdk'
import { SwapComposer } from './composer'
import {
  DEFAULT_ALGOD_PORT,
  DEFAULT_ALGOD_TOKEN,
  DEFAULT_ALGOD_URI,
  DEFAULT_API_BASE_URL,
  DEFAULT_ATOMIC_ONLY,
  DEFAULT_AUTO_OPT_IN,
  DEFAULT_FEE_BPS,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_GROUP_SIZE,
  DEPRECATED_PROTOCOLS,
  MAX_FEE_BPS,
} from './constants'
import { request } from './utils'
import type {
  DeflexQuote,
  FetchSwapTxnsResponse,
  DeflexConfig,
  DeflexConfigParams,
  FetchSwapTxnsParams,
  FetchQuoteParams,
} from './types'

/**
 * Client for interacting with the Deflex order router API
 *
 * @param config - The configuration for the client
 * @param config.apiKey - An API key for the Deflex API (required)
 * @param config.algodUri - The URI of the Algod node (default: https://mainnet-api.4160.nodely.dev/)
 * @param config.algodToken - The token for the Algod node (default: '')
 * @param config.algodPort - The port of the Algod node (default: 443)
 * @param config.referrerAddress - The address of the referrer, receives 25% of swap fees (optional)
 * @param config.feeBps - The output fee in basis points (default: 15 = 0.15%, max: 300 = 3.00%)
 * @param config.autoOptIn - Automatically detect and add required opt-in transactions (default: false)
 * @returns A new DeflexClient instance
 *
 * @example
 * ```typescript
 * const deflex = new DeflexClient({
 *   apiKey: 'your-api-key', // required
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
 *   referrerAddress: 'your-referrer-address',
 *   feeBps: 15,
 *   autoOptIn: false,
 * })
 * ```
 */
export class DeflexClient {
  private readonly baseUrl: string = DEFAULT_API_BASE_URL
  private readonly config: DeflexConfig
  private readonly algorand: AlgorandClient

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
   * @param params - Parameters for the quote request
   * @param params.fromAssetId - The ID of the asset to swap from
   * @param params.toAssetId - The ID of the asset to swap to
   * @param params.amount - The amount of the asset to swap in base units
   * @param params.type - The type of the quote (default: 'fixed-input')
   * @param params.disabledProtocols - List of protocols to disable (default: [])
   * @param params.maxGroupSize - The maximum group size (default: 16)
   * @param params.maxDepth - The maximum depth (default: 4)
   * @param params.atomicOnly - Whether to only use atomic swaps (default: true)
   * @param params.address - The address of the account that will perform the swap (optional, required if `config.autoOptIn` is true)
   * @param params.optIn - Whether to include asset opt-in transaction
   *   - If true: API reduces maxGroupSize by 1 and includes opt-in (always included, even if not needed)
   *   - If false: No opt-in transaction included
   *   - If undefined: Falls back to `config.autoOptIn` behavior with account check (if `params.address` is provided)
   * @returns A DeflexQuote object with routing information
   *
   * @example
   * ```typescript
   * const quote = await client.fetchQuote({
   *   address: 'ABC...',
   *   fromAssetId: 0,           // ALGO
   *   toAssetId: 31566704,      // USDC
   *   amount: 1_000_000,        // 1 ALGO
   * })
   * ```
   */
  async fetchQuote(params: FetchQuoteParams): Promise<DeflexQuote> {
    const {
      fromAssetId,
      toAssetId,
      amount,
      type = 'fixed-input',
      disabledProtocols = [],
      maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
      maxDepth = DEFAULT_MAX_DEPTH,
      atomicOnly = DEFAULT_ATOMIC_ONLY,
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
          toAssetId,
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
    url.searchParams.append('fromASAID', BigInt(fromAssetId).toString())
    url.searchParams.append('toASAID', BigInt(toAssetId).toString())
    url.searchParams.append('amount', BigInt(amount).toString())
    url.searchParams.append('type', type)
    url.searchParams.append('disabledProtocols', allDisabledProtocols.join(','))
    url.searchParams.append('maxGroupSize', maxGroupSize.toString())
    url.searchParams.append('maxDepth', maxDepth.toString())
    url.searchParams.append('atomicOnly', String(atomicOnly))
    url.searchParams.append('optIn', String(includeOptIn))

    if (this.config.referrerAddress) {
      url.searchParams.append('referrerAddress', this.config.referrerAddress)
    }

    return request<DeflexQuote>(url.toString())
  }

  /**
   * Check if asset opt-in is required
   *
   * @param address - The address to check
   * @param assetId - The asset ID to check
   * @returns True if asset opt-in is required, false otherwise
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
   * @param params - Parameters for the swap transaction request
   * @param params.quote - The quote response from fetchQuote()
   * @param params.address - The address of the signer
   * @param params.slippage - The slippage tolerance
   * @returns A FetchSwapTxnsResponse object with transaction data
   */
  async fetchSwapTransactions(
    params: FetchSwapTxnsParams,
  ): Promise<FetchSwapTxnsResponse> {
    const { quote, address, slippage } = params

    // Validate signer address
    this.validateAddress(address)

    const url = new URL(`${this.baseUrl}/fetchExecuteSwapTxns`)

    const body: {
      apiKey: string
      address: string
      txnPayloadJSON: typeof quote.txnPayload
      slippage: number
    } = {
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
   * Create a SwapComposer instance
   *
   * This factory method creates a composer that allows you to add custom transactions
   * before and after the swap transactions, with automatic handling of pre-signed transactions
   * and opt-ins.
   *
   * @param config.quote - The quote response from fetchQuote()
   * @param config.address - The address of the signer
   * @param config.slippage - The slippage tolerance
   * @returns A SwapComposer instance ready for building transaction groups
   *
   * @example
   * ```typescript
   * // Basic swap
   * const quote = await deflex.fetchQuote({ ... })
   * await deflex.newSwap({ quote, slippage, address })
   *   .execute(signer)
   * ```
   *
   * @example
   * ```typescript
   * // Advanced swap with custom transactions
   * const quote = await deflex.fetchQuote({ ... })
   * const swap = await deflex.newSwap({
   *   quote,
   *   slippage,
   *   address,
   * })
   *
   * console.log(swap.getStatus()) // BUILDING
   *
   * const signedTxns = await swap
   *   .addTransaction(beforeTxn)
   *   .addSwapTransactions() // Adds swap transactions to the group
   *   .addTransaction(afterTxn)
   *   .sign(signer) // algosdk.TransactionSigner or (txns) => Promise<Uint8Array[]>
   *
   * console.log(swap.getStatus()) // SIGNED
   *
   * const result = await swap.execute(signer, waitRounds)
   * console.log(result.confirmedRound, result.txIds)
   *
   * console.log(swap.getStatus()) // COMMITTED
   * ```
   */
  async newSwap(config: {
    quote: DeflexQuote
    address: string
    slippage: number
  }): Promise<SwapComposer> {
    const { quote, address, slippage } = config

    const swapResponse = await this.fetchSwapTransactions({
      quote,
      address,
      slippage,
    })

    // Create the composer
    const composer = new SwapComposer({
      quote,
      deflexTxns: swapResponse.txns,
      algorand: this.algorand,
      address,
    })

    return composer
  }

  /**
   * Validates the API key
   *
   * @param apiKey - The API key to validate
   * @returns The validated API key
   * @throws An error if the API key is not provided
   */
  private validateApiKey(apiKey: string): string {
    if (!apiKey) {
      throw new Error('API key is required')
    }
    return apiKey
  }

  /**
   * Validates an Algorand address
   *
   * @param address - The address to validate
   * @returns The validated address
   * @throws An error if the address is not a valid Algorand address
   */
  private validateAddress(address: string): string {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid Algorand address: ${address}`)
    }
    return address
  }

  /**
   * Validates the fee in basis points
   *
   * @param feeBps - The fee in basis points to validate
   * @returns The validated fee in basis points
   * @throws An error if the fee in basis points is not within the valid range
   */
  private validateFeeBps(feeBps: number): number {
    if (feeBps < 0 || feeBps > MAX_FEE_BPS) {
      throw new Error(`Invalid fee in basis points: ${feeBps}`)
    }
    return feeBps
  }
}
