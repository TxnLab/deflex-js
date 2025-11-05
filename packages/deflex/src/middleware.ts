import type { DeflexQuote, FetchQuoteParams } from './types'
import type {
  Algodv2,
  SuggestedParams,
  TransactionSigner,
  TransactionWithSigner,
} from 'algosdk'

/**
 * Context provided to middleware hooks during swap composition
 */
export interface SwapContext {
  /** The quote result from newQuote() */
  readonly quote: DeflexQuote
  /** The address of the account performing the swap */
  readonly address: string
  /** Algodv2 client instance for making additional queries/transactions */
  readonly algodClient: Algodv2
  /** Suggested transaction parameters from the network */
  readonly suggestedParams: SuggestedParams
  /** Input asset ID (always bigint for precision and future-proofing) */
  readonly fromASAID: bigint
  /** Output asset ID (always bigint for precision and future-proofing) */
  readonly toASAID: bigint
  /** Transaction signer for transactions that need to be signed by the user */
  readonly signer: TransactionSigner
}

/**
 * Middleware interface for extending Deflex swap functionality
 *
 * Middleware allows you to modify quote parameters and inject additional transactions
 * into the atomic swap group. This is useful for assets that require special handling,
 * such as those with transfer restrictions, taxes, or custom smart contract logic.
 *
 * @example
 * ```typescript
 * class CustomAssetMiddleware implements SwapMiddleware {
 *   readonly name = 'CustomAsset'
 *   readonly version = '1.0.0'
 *
 *   async shouldApply(params) {
 *     return params.fromASAID === CUSTOM_ASSET_ID || params.toASAID === CUSTOM_ASSET_ID
 *   }
 *
 *   async adjustQuoteParams(params) {
 *     // Reduce maxGroupSize to account for extra transactions
 *     return { ...params, maxGroupSize: params.maxGroupSize - 3 }
 *   }
 *
 *   async beforeSwap(context) {
 *     // Return transactions to add before the swap
 *     return [unfreezeTransaction]
 *   }
 *
 *   async afterSwap(context) {
 *     // Return transactions to add after the swap
 *     return [taxTransaction, refreezeTransaction]
 *   }
 * }
 * ```
 */
export interface SwapMiddleware {
  /** Unique identifier for the middleware */
  readonly name: string

  /** Semantic version of the middleware */
  readonly version: string

  /**
   * Determines if this middleware should be applied to the given swap
   *
   * Called during both quote and swap phases. Use this to check if either
   * the input or output asset requires special handling.
   *
   * @param params - Asset IDs being swapped
   * @returns True if middleware should be applied
   *
   * @example
   * ```typescript
   * async shouldApply(params) {
   *   // Check if asset is registered in our smart contract
   *   const assetInfo = await this.getAssetInfo(params.fromASAID)
   *   return assetInfo !== null
   * }
   * ```
   */
  shouldApply(params: { fromASAID: bigint; toASAID: bigint }): Promise<boolean>

  /**
   * Modify quote parameters before fetching the quote
   *
   * **IMPORTANT**: If your middleware adds transactions via `beforeSwap` or `afterSwap`,
   * you MUST reduce `maxGroupSize` accordingly to prevent failures. The Deflex API may
   * return routes that use all 16 available transaction slots.
   *
   * Use this to adjust the quote request based on your asset's requirements.
   * Common adjustments include:
   * - Reducing `maxGroupSize` to account for additional transactions (REQUIRED if adding txns)
   * - Adjusting `amount` to account for fees/taxes
   * - Modifying `disabledProtocols` if certain DEXs are incompatible
   *
   * @param params - Original quote parameters
   * @returns Modified quote parameters
   *
   * @example
   * ```typescript
   * async adjustQuoteParams(params) {
   *   const [fromTaxed, toTaxed] = await Promise.all([
   *     this.isAssetTaxed(params.fromASAID),
   *     this.isAssetTaxed(params.toASAID),
   *   ])
   *
   *   // 3 extra transactions per taxed asset
   *   let maxGroupSize = params.maxGroupSize ?? 16
   *   if (fromTaxed) maxGroupSize -= 3
   *   if (toTaxed) maxGroupSize -= 3
   *
   *   // Adjust amount for input tax
   *   let amount = params.amount
   *   if (fromTaxed) {
   *     const taxRate = await this.getTaxRate(params.fromASAID)
   *     amount = this.applyTax(amount, taxRate)
   *   }
   *
   *   return { ...params, maxGroupSize, amount }
   * }
   * ```
   */
  adjustQuoteParams?(params: FetchQuoteParams): Promise<FetchQuoteParams>

  /**
   * Add transactions before the swap transactions
   *
   * Called when building the swap transaction group. Transactions are added
   * to the group in the order they appear in the returned array.
   *
   * Transaction order in final group: [beforeSwap] → [swap txns] → [afterSwap]
   *
   * @param context - Swap context with quote, address, and algod client
   * @returns Array of transactions with signers to add before swap
   *
   * @example
   * ```typescript
   * async beforeSwap(context) {
   *   const txns: TransactionWithSigner[] = []
   *
   *   // Unfreeze user account before swap
   *   if (await this.needsUnfreeze(context.fromASAID)) {
   *     const unfreezeCall = makeApplicationNoOpTxn(
   *       context.address,
   *       this.appId,
   *       ...,
   *       context.suggestedParams
   *     )
   *
   *     txns.push({
   *       txn: unfreezeCall,
   *       signer: context.signer, // Use the signer from context
   *     })
   *   }
   *
   *   return txns
   * }
   * ```
   */
  beforeSwap?(context: SwapContext): Promise<TransactionWithSigner[]>

  /**
   * Add transactions after the swap transactions
   *
   * Called when building the swap transaction group. Transactions are added
   * to the group in the order they appear in the returned array.
   *
   * Transaction order in final group: [beforeSwap] → [swap txns] → [afterSwap]
   *
   * @param context - Swap context with quote, address, and algod client
   * @returns Array of transactions with signers to add after swap
   *
   * @example
   * ```typescript
   * async afterSwap(context) {
   *   const txns: TransactionWithSigner[] = []
   *
   *   // Pay tax and refreeze account
   *   if (await this.isTaxed(context.fromASAID)) {
   *     const taxAmount = await this.calculateTax(context)
   *     const taxPayment = makeAssetTransferTxn(
   *       context.address,
   *       this.taxReceiver,
   *       taxAmount,
   *       context.fromASAID,
   *       context.suggestedParams
   *     )
   *     const refreezeCall = makeApplicationNoOpTxn(
   *       context.address,
   *       this.appId,
   *       ...,
   *       context.suggestedParams
   *     )
   *
   *     txns.push(
   *       { txn: taxPayment, signer: context.signer },
   *       { txn: refreezeCall, signer: context.signer },
   *     )
   *   }
   *
   *   return txns
   * }
   * ```
   */
  afterSwap?(context: SwapContext): Promise<TransactionWithSigner[]>
}
