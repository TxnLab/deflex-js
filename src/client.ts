import algosdk from 'algosdk'
import type { QuoteResponse } from '@/types/api'
import type {
  DeflexConfig,
  DeflexConfigParams,
  GetQuoteParams,
} from '@/types/client'
import {
  DEFAULT_ALGOD_PORT,
  DEFAULT_ALGOD_TOKEN,
  DEFAULT_ALGOD_URI,
  DEFAULT_API_BASE_URL,
  DEFAULT_ATOMIC_ONLY,
  DEFAULT_FEE_BPS,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_GROUP_SIZE,
  DEPRECATED_PROTOCOLS,
  MAX_FEE_BPS,
} from '@/utils/constants'
import { request } from '@/utils/request'
import {
  assignGroupId,
  analyzeOptInRequirements,
  processSwapTransactions,
  reSignTransaction,
} from '@/utils/transactions'

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
 * })
 * ```
 */
export class DeflexClient {
  private readonly baseUrl: string = DEFAULT_API_BASE_URL
  private readonly config: DeflexConfig

  constructor(config: DeflexConfigParams) {
    this.config = {
      apiKey: this.validateApiKey(config.apiKey),
      algodUri: config.algodUri ?? DEFAULT_ALGOD_URI,
      algodToken: config.algodToken ?? DEFAULT_ALGOD_TOKEN,
      algodPort: config.algodPort ?? DEFAULT_ALGOD_PORT,
      referrerAddress: config.referrerAddress
        ? this.validateAddress(config.referrerAddress)
        : undefined,
      feeBps: this.validateFeeBps(config.feeBps ?? DEFAULT_FEE_BPS),
    }
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
    if (!algosdk.isValidAddress(address)) {
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
   * @returns A QuoteResponse object with routing information
   *
   * @example
   * ```typescript
   * const quote = await client.getQuote({
   *   fromAssetId: 0,           // ALGO
   *   toAssetId: 31566704,      // USDC
   *   amount: 1_000_000,        // 1 ALGO
   *   type: 'fixed-input',
   * })
   * ```
   */
  async getQuote(params: GetQuoteParams): Promise<QuoteResponse> {
    const {
      fromAssetId,
      toAssetId,
      amount,
      type = 'fixed-input',
      disabledProtocols = [],
      maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
      maxDepth = DEFAULT_MAX_DEPTH,
      atomicOnly = DEFAULT_ATOMIC_ONLY,
    } = params

    // Always include deprecated protocols in disabled list
    const allDisabledProtocols = [
      ...new Set([...DEPRECATED_PROTOCOLS, ...disabledProtocols]),
    ]

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

    if (this.config.referrerAddress) {
      url.searchParams.append('referrerAddress', this.config.referrerAddress)
    }

    return request<QuoteResponse>(url.toString())
  }
}
