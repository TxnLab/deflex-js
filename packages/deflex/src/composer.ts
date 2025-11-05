import {
  AtomicTransactionComposer,
  decodeUnsignedTransaction,
  isValidAddress,
  LogicSigAccount,
  makeApplicationOptInTxnFromObject,
  msgpackRawDecode,
  signLogicSigTransactionObject,
  signTransaction,
  Transaction,
  type ABIResult,
  type Algodv2,
  type TransactionSigner,
  type TransactionWithSigner,
} from 'algosdk'
import { DEFAULT_CONFIRMATION_ROUNDS } from './constants'
import type { SwapMiddleware, SwapContext } from './middleware'
import type {
  FetchQuoteResponse,
  DeflexTransaction,
  DeflexSignature,
  DeflexQuote,
  MethodCall,
} from './types'

/**
 * A transaction signer function that supports both standard algosdk.TransactionSigner
 * and ARC-1 compliant signers that may return null for unsigned transactions.
 *
 * @param txnGroup - The complete transaction group to sign
 * @param indexesToSign - Array of indexes indicating which transactions need signing
 * @returns Array of signed transactions (may include nulls for ARC-1 compliant wallets)
 */
export type SignerFunction = (
  txnGroup: Transaction[],
  indexesToSign: number[],
) => Promise<(Uint8Array | null)[]>

/**
 * Status of the SwapComposer transaction group lifecycle
 */
export enum SwapComposerStatus {
  /** The atomic group is still under construction. */
  BUILDING,

  /** The atomic group has been finalized, but not yet signed. */
  BUILT,

  /** The atomic group has been finalized and signed, but not yet submitted to the network. */
  SIGNED,

  /** The atomic group has been finalized, signed, and submitted to the network. */
  SUBMITTED,

  /** The atomic group has been finalized, signed, submitted, and successfully committed to a block. */
  COMMITTED,
}

/**
 * Configuration for creating a SwapComposer instance
 */
export interface SwapComposerConfig {
  /** The quote response from fetchQuote() or newQuote() */
  readonly quote: FetchQuoteResponse | DeflexQuote
  /** The swap transactions from fetchSwapTransactions() */
  readonly deflexTxns: DeflexTransaction[]
  /** Algodv2 client instance */
  readonly algodClient: Algodv2
  /** The address of the account that will sign transactions */
  readonly address: string
  /** Transaction signer function */
  readonly signer: TransactionSigner | SignerFunction
  /** Middleware to apply during swap composition */
  readonly middleware?: SwapMiddleware[]
}

/**
 * Composer for building and executing atomic swap transaction groups
 *
 * The SwapComposer allows you to build complex transaction groups by adding custom
 * transactions before and after swap transactions. It handles pre-signed transactions,
 * automatic app opt-ins, and provides a fluent API for transaction group construction.
 *
 * @example
 * ```typescript
 * const quote = await deflex.fetchQuote({ ... })
 * const composer = await deflex.newSwap({ quote, address, slippage, signer })
 *
 * await composer
 *   .addTransaction(customTxn)
 *   .addSwapTransactions()
 *   .execute()
 * ```
 */
export class SwapComposer {
  /** The ATC used to compose the group */
  private atc = new AtomicTransactionComposer()

  /** The maximum size of an atomic transaction group. */
  static MAX_GROUP_SIZE: number = AtomicTransactionComposer.MAX_GROUP_SIZE

  /** Whether the swap transactions have been added to the atomic group. */
  private swapTransactionsAdded = false

  private readonly quote: FetchQuoteResponse | DeflexQuote
  private readonly requiredAppOptIns: number[]
  private readonly deflexTxns: DeflexTransaction[]
  private readonly algodClient: Algodv2
  private readonly address: string
  private readonly signer: TransactionSigner | SignerFunction
  private readonly middleware: SwapMiddleware[]

  /**
   * Create a new SwapComposer instance
   *
   * Note: Most developers should use DeflexClient.newSwap() instead of constructing
   * this directly, as the factory method handles fetching swap transactions automatically.
   *
   * @param config - Configuration for the composer
   * @param config.quote - The quote response from fetchQuote()
   * @param config.deflexTxns - The swap transactions from fetchSwapTransactions()
   * @param config.algodClient - Algodv2 client instance
   * @param config.address - The address of the account that will sign transactions
   * @param config.signer - Transaction signer function
   * @param config.middleware - Middleware to apply during swap composition
   */
  constructor(config: SwapComposerConfig) {
    // Validate required parameters
    if (!config.quote) {
      throw new Error('Quote is required')
    }
    if (!config.deflexTxns) {
      throw new Error('Swap transactions are required')
    }
    if (config.deflexTxns.length === 0) {
      throw new Error('Swap transactions array cannot be empty')
    }
    if (!config.algodClient) {
      throw new Error('Algodv2 client instance is required')
    }
    if (!config.signer) {
      throw new Error('Signer is required')
    }

    this.quote = config.quote
    this.requiredAppOptIns = config.quote.requiredAppOptIns
    this.deflexTxns = config.deflexTxns
    this.algodClient = config.algodClient
    this.address = this.validateAddress(config.address)
    this.signer = config.signer
    this.middleware = config.middleware ?? []
  }

  /**
   * Get the status of this composer's transaction group
   *
   * @returns The current status of the transaction group
   */
  getStatus(): SwapComposerStatus {
    return this.atc.getStatus() as unknown as SwapComposerStatus
  }

  /**
   * Get the number of transactions currently in this atomic group
   *
   * @returns The number of transactions in the group
   */
  count(): number {
    return this.atc.count()
  }

  /**
   * Add a transaction to the atomic group
   *
   * Transactions are added in the order methods are called. For example:
   * ```typescript
   * composer
   *   .addTransaction(txn1)      // Added first
   *   .addSwapTransactions()     // Added second
   *   .addTransaction(txn2)      // Added third
   * ```
   *
   * @param transaction - The transaction to add
   * @returns This composer instance for chaining
   * @throws Error if the composer is not in the BUILDING status
   * @throws Error if the maximum group size is exceeded
   */
  addTransaction(transaction: Transaction, signer = this.defaultSigner): this {
    this.atc.addTransaction({ txn: transaction, signer })
    return this
  }

  /**
   * Add a method call to the atomic group
   *
   * The `signer` property in the `methodCall` parameter is optional. If not provided,
   * the signer will default to the one passed as the second parameter, or the
   * configured signer from the constructor if no second parameter is provided.
   *
   * @param methodCall - The method call to add
   * @param signer - The signer to use for the method call (defaults to constructor signer)
   * @returns This composer instance for chaining
   */
  addMethodCall(methodCall: MethodCall, signer = this.defaultSigner): this {
    this.atc.addMethodCall({
      ...methodCall,
      signer: methodCall.signer ?? signer,
    })
    return this
  }

  /**
   * Add swap transactions to the atomic group
   *
   * This method automatically processes required app opt-ins, executes middleware hooks,
   * and adds all swap transactions from the quote. Can only be called once per composer instance.
   *
   * Middleware hooks are executed in this order:
   * 1. beforeSwap() - Add transactions before swap transactions
   * 2. Swap transactions (from API)
   * 3. afterSwap() - Add transactions after swap transactions
   *
   * @returns This composer instance for chaining
   * @throws Error if the swap transactions have already been added
   * @throws Error if the composer is not in the BUILDING status
   * @throws Error if the maximum group size is exceeded
   */
  async addSwapTransactions(): Promise<this> {
    if (this.swapTransactionsAdded) {
      throw new Error('Swap transactions have already been added')
    }

    if (this.getStatus() !== SwapComposerStatus.BUILDING) {
      throw new Error(
        'Cannot add swap transactions when composer status is not BUILDING',
      )
    }

    // Execute beforeSwap middleware hooks
    const beforeTxns = await this.executeMiddlewareHooks('beforeSwap')
    for (const txnWithSigner of beforeTxns) {
      this.atc.addTransaction(txnWithSigner)
    }

    // Add swap transactions (includes app opt-ins)
    const processedTxns = await this.processSwapTransactions()
    const totalLength =
      this.atc.count() + processedTxns.length + (await this.getAfterSwapCount())

    if (totalLength > SwapComposer.MAX_GROUP_SIZE) {
      throw new Error(
        `Adding swap transactions exceeds the maximum atomic group size of ${SwapComposer.MAX_GROUP_SIZE}`,
      )
    }

    for (const txnWithSigner of processedTxns) {
      this.atc.addTransaction(txnWithSigner)
    }

    // Execute afterSwap middleware hooks
    const afterTxns = await this.executeMiddlewareHooks('afterSwap')
    for (const txnWithSigner of afterTxns) {
      this.atc.addTransaction(txnWithSigner)
    }

    this.swapTransactionsAdded = true
    return this
  }

  /**
   * Finalize the transaction group by assigning group IDs
   *
   * This method builds the atomic transaction group, assigning group IDs to all transactions
   * if there is more than one transaction. After calling this method, the composer's status
   * will be at least BUILT.
   *
   * @returns Array of transactions with their associated signers
   *
   * @throws Error if the group contains 0 transactions
   *
   * @example
   * ```typescript
   * const composer = await deflex.newSwap({ quote, address, slippage, signer })
   * composer.addTransaction(customTxn)
   *
   * // Build the group to inspect transactions before signing
   * const txnsWithSigners = composer.buildGroup()
   * console.log('Group ID:', txnsWithSigners[0].txn.group)
   * console.log('Group length:', txnsWithSigners.length)
   * console.log('Status:', composer.getStatus()) // BUILT
   * ```
   */
  buildGroup(): TransactionWithSigner[] {
    return this.atc.buildGroup()
  }

  /**
   * Sign the transaction group
   *
   * Automatically adds swap transactions if not already added, builds the atomic group,
   * and signs all transactions using the configured signer.
   *
   * @returns A promise that resolves to an array of signed transaction blobs
   *
   * @example
   * ```typescript
   * const signedTxns = await composer.sign()
   * ```
   */
  async sign(): Promise<Uint8Array[]> {
    if (this.getStatus() >= SwapComposerStatus.SIGNED) {
      return this.atc.gatherSignatures()
    }

    // Auto-add swap transactions if needed
    if (!this.swapTransactionsAdded) {
      await this.addSwapTransactions()
    }

    return await this.atc.gatherSignatures()
  }

  /**
   * Submit the signed transactions to the network
   *
   * This method signs the transaction group (if not already signed) and submits
   * it to the Algorand network. Does not wait for confirmation.
   *
   * @returns The transaction IDs
   * @throws Error if the transaction group has already been submitted
   *
   * @example
   * ```typescript
   * const txIds = await composer.submit()
   * console.log('Submitted transactions:', txIds)
   * ```
   */
  async submit(): Promise<string[]> {
    // Auto-add swap transactions if needed (maintains backward compatibility)
    if (!this.swapTransactionsAdded) {
      await this.addSwapTransactions()
    }

    return this.atc.submit(this.algodClient)
  }

  /**
   * Execute the swap
   *
   * Signs the transaction group, submits it to the network, and waits for confirmation.
   * This is the primary method for executing swaps and combines sign(), submit(), and
   * waitForConfirmation() into a single call.
   *
   * @param waitRounds - The number of rounds to wait for confirmation (default: 4)
   * @returns Object containing the confirmed round and transaction IDs
   * @throws Error if the transaction group has already been committed
   *
   * @example
   * ```typescript
   * const result = await composer.execute()
   * console.log(`Confirmed in round ${result.confirmedRound}`)
   * console.log('Transaction IDs:', result.txIds)
   * ```
   */
  async execute(waitRounds: number = DEFAULT_CONFIRMATION_ROUNDS): Promise<{
    confirmedRound: bigint
    txIds: string[]
    methodResults: ABIResult[]
  }> {
    // Auto-add swap transactions if needed (maintains backward compatibility)
    if (!this.swapTransactionsAdded) {
      await this.addSwapTransactions()
    }

    const { txIDs, ...result } = await this.atc.execute(
      this.algodClient,
      waitRounds,
    )

    return {
      ...result,
      txIds: txIDs,
    }
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
   * Processes app opt-ins and decodes swap transactions from API response
   */
  private async processSwapTransactions(): Promise<TransactionWithSigner[]> {
    const appOptIns = await this.processRequiredAppOptIns()

    const swapTxns: TransactionWithSigner[] = []
    for (let i = 0; i < this.deflexTxns.length; i++) {
      const deflexTxn = this.deflexTxns[i]
      if (!deflexTxn) continue

      try {
        const txnBytes = Buffer.from(deflexTxn.data, 'base64')
        const txn = decodeUnsignedTransaction(txnBytes)
        delete txn.group

        if (deflexTxn.signature !== false) {
          // Pre-signed transaction - use custom Deflex signer
          swapTxns.push({
            txn,
            signer: this.createDeflexSigner(deflexTxn.signature),
          })
        } else {
          // User transaction - use configured signer
          swapTxns.push({
            txn,
            signer: this.defaultSigner,
          })
        }
      } catch (error) {
        throw new Error(
          `Failed to process swap transaction at index ${i}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return [...appOptIns, ...swapTxns]
  }

  /**
   * Creates opt-in transactions for apps the user hasn't opted into yet
   */
  private async processRequiredAppOptIns(): Promise<TransactionWithSigner[]> {
    // Fetch account information
    const accountInfo = await this.algodClient
      .accountInformation(this.address)
      .do()

    // Check app opt-ins
    const userApps =
      accountInfo?.appsLocalState?.map((app) => Number(app.id)) || []
    const appsToOptIn = this.requiredAppOptIns.filter(
      (appId) => !userApps.includes(appId),
    )

    if (appsToOptIn.length === 0) return []

    const suggestedParams = await this.algodClient.getTransactionParams().do()

    return appsToOptIn.map((appId) => ({
      txn: makeApplicationOptInTxnFromObject({
        sender: this.address,
        appIndex: appId,
        suggestedParams,
      }),
      signer: this.defaultSigner,
    }))
  }

  /**
   * The default signer function that uses the configured signer
   */
  private defaultSigner: TransactionSigner = async (
    txnGroup: Transaction[],
    indexesToSign: number[],
  ) => {
    const result = await this.signer(txnGroup, indexesToSign)
    return result.filter((txn): txn is Uint8Array => txn !== null)
  }

  /**
   * Creates a TransactionSigner function for Deflex pre-signed transactions
   */
  private createDeflexSigner(signature: DeflexSignature): TransactionSigner {
    return async (
      txnGroup: Transaction[],
      indexesToSign: number[],
    ): Promise<Uint8Array[]> => {
      return indexesToSign.map((i) => {
        const txn = txnGroup[i]
        if (!txn) throw new Error(`Transaction at index ${i} not found`)
        return this.signDeflexTransaction(txn, signature)
      })
    }
  }

  /**
   * Re-signs a Deflex transaction using the provided logic signature or secret key
   */
  private signDeflexTransaction(
    transaction: Transaction,
    signature: DeflexSignature,
  ): Uint8Array {
    try {
      if (signature.type === 'logic_signature') {
        // Decode the signature value to extract the logic signature
        const valueArray = signature.value as Record<string, number>
        const valueBytes = new Uint8Array(Object.values(valueArray))
        const decoded = msgpackRawDecode(valueBytes) as {
          lsig?: { l: Uint8Array; arg?: Uint8Array[] }
        }

        if (!decoded.lsig) {
          throw new Error('Logic signature structure missing lsig field')
        }

        const lsig = decoded.lsig
        const logicSigAccount = new LogicSigAccount(lsig.l, lsig.arg)

        const signedTxn = signLogicSigTransactionObject(
          transaction,
          logicSigAccount,
        )
        return signedTxn.blob
      } else if (signature.type === 'secret_key') {
        // Convert signature.value (Record<string, number>) to Uint8Array
        const valueArray = signature.value as Record<string, number>
        const secretKey = new Uint8Array(Object.values(valueArray))
        const signedTxn = signTransaction(transaction, secretKey)
        return signedTxn.blob
      } else {
        throw new Error(`Unsupported signature type: ${signature.type}`)
      }
    } catch (error) {
      throw new Error(
        `Failed to re-sign transaction: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Execute middleware hooks (beforeSwap or afterSwap)
   */
  private async executeMiddlewareHooks(
    hookName: 'beforeSwap' | 'afterSwap',
  ): Promise<TransactionWithSigner[]> {
    const allTxns: TransactionWithSigner[] = []

    for (const mw of this.middleware) {
      const shouldApply = await mw.shouldApply({
        fromASAID: BigInt(this.quote.fromASAID),
        toASAID: BigInt(this.quote.toASAID),
      })

      if (!shouldApply || !mw[hookName]) {
        continue
      }

      const context = await this.createSwapContext()
      const txns = await mw[hookName]!(context)
      allTxns.push(...txns)
    }

    return allTxns
  }

  /**
   * Get count of afterSwap transactions without executing them
   */
  private async getAfterSwapCount(): Promise<number> {
    let count = 0

    for (const mw of this.middleware) {
      const shouldApply = await mw.shouldApply({
        fromASAID: BigInt(this.quote.fromASAID),
        toASAID: BigInt(this.quote.toASAID),
      })

      if (!shouldApply || !mw.afterSwap) {
        continue
      }

      const context = await this.createSwapContext()
      const txns = await mw.afterSwap(context)
      count += txns.length
    }

    return count
  }

  /**
   * Create SwapContext for middleware hooks
   */
  private async createSwapContext(): Promise<SwapContext> {
    const suggestedParams = await this.algodClient.getTransactionParams().do()

    // Convert to DeflexQuote if needed
    const quote: DeflexQuote =
      'createdAt' in this.quote
        ? this.quote
        : {
            ...this.quote,
            quote: this.quote.quote === '' ? 0n : BigInt(this.quote.quote),
            amount: 0n, // Not available in FetchQuoteResponse
            createdAt: Date.now(),
          }

    return {
      quote,
      address: this.address,
      algodClient: this.algodClient,
      suggestedParams,
      fromASAID: BigInt(this.quote.fromASAID),
      toASAID: BigInt(this.quote.toASAID),
      signer: this.defaultSigner,
    }
  }
}
