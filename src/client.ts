import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import type { QuoteResponse, SwapTxnsResponse } from '@/types/api'
import type {
  DeflexConfig,
  DeflexConfigParams,
  FetchSwapParams,
  GetQuoteParams,
  SignSwapParams,
} from '@/types/client'
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
} from '@/utils/constants'
import { request } from '@/utils/request'
import {
  assignGroupId,
  processRequiredAppOptIns,
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
   * @param params.address - The address of the account that will perform the swap (optional, required if `config.autoOptIn` is true)
   * @param params.optIn - Whether to include asset opt-in transaction
   *   - If true: API reduces maxGroupSize by 1 and includes opt-in (always included, even if not needed)
   *   - If false: No opt-in transaction included
   *   - If undefined: Falls back to `config.autoOptIn` behavior with account check (if `params.address` is provided)
   * @returns A QuoteResponse object with routing information
   *
   * @example
   * ```typescript
   * const quote = await client.getQuote({
   *   address: 'ABC...',
   *   fromAssetId: 0,           // ALGO
   *   toAssetId: 31566704,      // USDC
   *   amount: 1_000_000,        // 1 ALGO
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
          'autoOptIn is enabled but no address provided to getQuote(). Asset opt-in check skipped.',
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

    return request<QuoteResponse>(url.toString())
  }

  /**
   * Check if asset opt-in is required
   *
   * @param address - The address to check
   * @param assetId - The asset ID to check
   * @returns True if asset opt-in is required, false otherwise
   *
   * @example
   * ```typescript
   * const needsAssetOptIn = await deflex.needsAssetOptIn('ABC...', 31566704)
   * console.log(needsAssetOptIn) // true or false
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
   * @param params - Parameters for the swap transaction request
   * @param params.quote - The quote response from getQuote()
   * @param params.signerAddress - The address of the signer
   * @param params.slippage - The slippage tolerance
   * @returns A SwapTxnsResponse object with transaction data
   *
   * @example
   * ```typescript
   * const quote = await deflex.getQuote({ ... })
   * const swap = await deflex.fetchSwapTransactions({
   *   quote,
   *   signerAddress: 'ABC...',
   *   slippage: 1,
   * })
   * ```
   */
  async fetchSwapTransactions(
    params: FetchSwapParams,
  ): Promise<SwapTxnsResponse> {
    const { quote, signerAddress, slippage } = params

    // Validate signer address
    this.validateAddress(signerAddress)

    const url = new URL(`${this.baseUrl}/fetchExecuteSwapTxns`)

    const body: {
      apiKey: string
      address: string
      txnPayloadJSON: typeof quote.txnPayload
      slippage: number
    } = {
      apiKey: this.config.apiKey,
      address: signerAddress,
      txnPayloadJSON: quote.txnPayload,
      slippage,
    }

    return request<SwapTxnsResponse>(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * Sign swap transactions ready for submission to the network
   *
   * @param params - Parameters for the swap signing request
   * @param params.quote - The quote response from getQuote()
   * @param params.signerAddress - The address of the signer
   * @param params.slippage - The slippage tolerance
   * @param params.signer - Transaction signer function
   * @returns Array of signed transaction blobs ready to submit
   *
   * @example
   * ```typescript
   * const quote = await deflex.getQuote({ ... })
   * const signedTxns = await deflex.signSwap({
   *   quote,
   *   signerAddress: 'ABC...',
   *   slippage: 1,
   *   signer: transactionSigner,
   * })
   *
   * // Submit to network
   * await algorand.client.algod
   *   .sendRawTransaction(signedTxns)
   *   .do()
   * ```
   */
  async signSwap(params: SignSwapParams): Promise<Uint8Array[]> {
    const { quote, signerAddress, slippage, signer } = params

    // Validate signer address
    this.validateAddress(signerAddress)

    // Fetch swap transactions from API
    const swapResponse = await this.fetchSwapTransactions({
      quote,
      signerAddress,
      slippage,
    })

    // Process required app opt-ins
    const processedAppOptInTxns = await processRequiredAppOptIns({
      algorand: this.algorand,
      signerAddress: signerAddress,
      requiredAppOptIns: quote.requiredAppOptIns,
    })

    // Process swap transactions
    const processedSwapTxns = processSwapTransactions(swapResponse.txns)
    const allProcessedTxns = [...processedAppOptInTxns, ...processedSwapTxns]

    // Assign new group ID to all transactions
    assignGroupId(allProcessedTxns)

    // Separate user transactions and pre-signed transactions
    const userTransactions: algosdk.Transaction[] = []
    const userTransactionIndexes: number[] = []
    const preSignedTxns: Uint8Array[] = []

    for (let i = 0; i < allProcessedTxns.length; i++) {
      const item = allProcessedTxns[i]
      if (!item) continue

      if (!item.deflexSignature) {
        userTransactions.push(item.txn)
        userTransactionIndexes.push(userTransactions.length - 1)
      } else {
        // Re-sign this transaction with the provided signature
        const signedTxnBlob = reSignTransaction(item.txn, item.deflexSignature)
        preSignedTxns.push(signedTxnBlob)
      }
    }

    // Sign user transactions
    let userSignedTxns: Uint8Array[] = []
    if (userTransactions.length > 0) {
      userSignedTxns = await signer(userTransactions, userTransactionIndexes)
    }

    // Combine user-signed and pre-signed transactions in correct order
    const result: Uint8Array[] = []
    let userSignedIndex = 0
    let preSignedIndex = 0

    for (const item of allProcessedTxns) {
      if (!item.deflexSignature) {
        const signedTxn = userSignedTxns[userSignedIndex]
        if (signedTxn) {
          result.push(signedTxn)
        }
        userSignedIndex++
      } else {
        const preSignedTxn = preSignedTxns[preSignedIndex]
        if (preSignedTxn) {
          result.push(preSignedTxn)
        }
        preSignedIndex++
      }
    }

    return result
  }
}
