import {
  assignGroupID,
  decodeUnsignedTransaction,
  isValidAddress,
  signLogicSigTransactionObject,
  signTransaction,
  LogicSigAccount,
  makeApplicationOptInTxnFromObject,
  msgpackRawDecode,
  Transaction,
  waitForConfirmation,
} from 'algosdk'
import { DEFAULT_CONFIRMATION_ROUNDS } from './constants'
import type {
  DeflexQuote,
  DeflexTransaction,
  SwapTransaction,
  DeflexSignature,
} from './types'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { TransactionSigner } from 'algosdk'

/**
 * A signer function that can be either:
 * - A TransactionSigner: algosdk.TransactionSigner
 * - A simpler inline function that only accepts the transaction group
 */
export type SignerFunction =
  | TransactionSigner
  | ((txnGroup: Transaction[]) => Promise<Uint8Array[]>)

/**
 * Status of the SwapComposer
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

export interface SwapComposerConfig {
  readonly quote: DeflexQuote
  readonly deflexTxns: DeflexTransaction[]
  readonly algorand: AlgorandClient
  readonly address: string
}

export class SwapComposer {
  /** The maximum size of an atomic transaction group. */
  static MAX_GROUP_SIZE: number = 16

  private status: SwapComposerStatus = SwapComposerStatus.BUILDING
  private transactions: SwapTransaction[] = []
  private swapTransactionsAdded = false
  private signedTxns: Uint8Array[] = []
  private txIds: string[] = []

  private readonly quote: DeflexQuote
  private readonly deflexTxns: DeflexTransaction[]
  private readonly algorand: AlgorandClient
  private readonly address: string

  constructor(config: SwapComposerConfig) {
    this.quote = config.quote
    this.deflexTxns = config.deflexTxns
    this.algorand = config.algorand
    this.address = this.validateAddress(config.address)
  }

  /**
   * Get the status of this composer's transaction group
   */
  getStatus(): SwapComposerStatus {
    return this.status
  }

  /**
   * Get the number of transactions currently in this atomic group
   */
  count(): number {
    return this.transactions.length
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
  addTransaction(transaction: Transaction): this {
    if (this.status !== SwapComposerStatus.BUILDING) {
      throw new Error(
        'Cannot add transactions when composer status is not BUILDING',
      )
    }

    if (this.transactions.length === SwapComposer.MAX_GROUP_SIZE) {
      throw new Error(
        `Adding an additional transaction exceeds the maximum atomic group size of ${SwapComposer.MAX_GROUP_SIZE}`,
      )
    }

    this.transactions.push({ txn: transaction })
    return this
  }

  /**
   * Add swap transactions to the atomic group
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

    if (this.status !== SwapComposerStatus.BUILDING) {
      throw new Error(
        'Cannot add swap transactions when composer status is not BUILDING',
      )
    }

    const processedTxns = await this.processSwapTransactions()
    const newLength = this.transactions.length + processedTxns.length

    if (newLength > SwapComposer.MAX_GROUP_SIZE) {
      throw new Error(
        `Adding swap transactions exceeds the maximum atomic group size of ${SwapComposer.MAX_GROUP_SIZE}`,
      )
    }

    this.transactions.push(...processedTxns)

    this.swapTransactionsAdded = true
    return this
  }

  /**
   * Sign the transaction group
   *
   * @param signer - Transaction signer function. Can be either:
   *   - A algosdk.TransactionSigner: (txnGroup, indexesToSign) => Promise<Uint8Array[]>
   *   - An inline function: (txnGroup) => Promise<Uint8Array[]>
   * @returns A promise that resolves to an array of signed transaction blobs
   *
   * @example
   * ```typescript
   * // Using a TransactionSigner
   * const signedTxns = await composer.sign(transactionSigner)
   *
   * // Using an inline function
   * const signedTxns = await composer.sign((txns) => signTransactions(txns))
   * ```
   */
  async sign(signer: SignerFunction): Promise<Uint8Array[]> {
    if (this.status >= SwapComposerStatus.SIGNED) {
      return this.signedTxns
    }

    // Auto-add swap transactions if needed
    if (!this.swapTransactionsAdded) {
      await this.addSwapTransactions()
    }

    // Build the transaction group, ensure status is BUILT
    const transactions = this.buildGroup()

    // Separate user transactions and pre-signed transactions
    const userTransactions: Transaction[] = []
    const userTransactionIndexes: number[] = []
    const deflexSignedTxns: Uint8Array[] = []

    for (let i = 0; i < transactions.length; i++) {
      const item = transactions[i]
      if (!item) continue

      if (!item.deflexSignature) {
        // User transaction - needs user signature
        userTransactions.push(item.txn)
        userTransactionIndexes.push(userTransactions.length - 1)
      } else {
        // Pre-signed transaction - re-sign with Deflex signature
        const signedTxnBlob = this.signDeflexTransaction(
          item.txn,
          item.deflexSignature,
        )
        deflexSignedTxns.push(signedTxnBlob)
      }
    }

    // Sign user transactions
    let userSignedTxns: Uint8Array[] = []
    if (userTransactions.length > 0) {
      userSignedTxns = await (signer as TransactionSigner)(
        userTransactions,
        userTransactionIndexes,
      )
    }

    // Combine user-signed and pre-signed transactions in correct order
    const signedTxns: Uint8Array[] = []
    let userSignedIndex = 0
    let deflexSignedIndex = 0

    for (const item of transactions) {
      if (!item.deflexSignature) {
        const signedTxn = userSignedTxns[userSignedIndex]
        if (signedTxn) {
          signedTxns.push(signedTxn)
        }
        userSignedIndex++
      } else {
        const deflexSignedTxn = deflexSignedTxns[deflexSignedIndex]
        if (deflexSignedTxn) {
          signedTxns.push(deflexSignedTxn)
        }
        deflexSignedIndex++
      }
    }

    const txIds = this.transactions.map((t) => t.txn.txID())

    this.signedTxns = signedTxns
    this.txIds = txIds
    this.status = SwapComposerStatus.SIGNED

    return signedTxns
  }

  /**
   * Submit the signed transactions to the network
   *
   * @param signer - Transaction signer function. Can be either:
   *   - A algosdk.TransactionSigner: (txnGroup, indexesToSign) => Promise<Uint8Array[]>
   *   - An inline function: (txnGroup) => Promise<Uint8Array[]>
   * @returns The transaction IDs
   */
  async submit(signer: SignerFunction): Promise<string[]> {
    if (this.status > SwapComposerStatus.SUBMITTED) {
      throw new Error('Transaction group cannot be resubmitted')
    }

    const stxns = await this.sign(signer)
    await this.algorand.client.algod.sendRawTransaction(stxns).do()

    this.status = SwapComposerStatus.SUBMITTED
    return this.txIds
  }

  /**
   * Execute the swap
   *
   * @param signer - Transaction signer function. Can be either:
   *   - A algosdk.TransactionSigner: (txnGroup, indexesToSign) => Promise<Uint8Array[]>
   *   - An inline function: (txnGroup) => Promise<Uint8Array[]>
   * @param waitRounds - The number of rounds to wait for confirmation (default: 4)
   * @returns The transaction IDs
   */
  async execute(
    signer: SignerFunction,
    waitRounds: number = DEFAULT_CONFIRMATION_ROUNDS,
  ): Promise<{
    confirmedRound: bigint
    txIds: string[]
  }> {
    if (this.status === SwapComposerStatus.COMMITTED) {
      throw new Error(
        'Transaction group has already been executed successfully',
      )
    }

    const txIds = await this.submit(signer)

    const confirmedTxnInfo = await waitForConfirmation(
      this.algorand.client.algod,
      txIds[0]!,
      waitRounds,
    )

    this.status = SwapComposerStatus.COMMITTED

    const confirmedRound = confirmedTxnInfo.confirmedRound!

    return {
      confirmedRound,
      txIds,
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
   * Process swap transactions
   * Processes app opt-ins and decodes swap transactions from API response
   *
   * @returns A promise that resolves to an array of processed swap transactions
   */
  private async processSwapTransactions(): Promise<SwapTransaction[]> {
    // Process required app opt-ins
    const appOptIns: SwapTransaction[] = await this.processRequiredAppOptIns()

    // Decode and process swap transactions from API
    const swapTxns: SwapTransaction[] = []
    for (let i = 0; i < this.deflexTxns.length; i++) {
      const deflexTxn = this.deflexTxns[i]
      if (!deflexTxn) continue

      try {
        // Decode transaction from base64 data
        const txnBytes = Buffer.from(deflexTxn.data, 'base64')
        const txn = decodeUnsignedTransaction(txnBytes)

        // Remove group ID (will be reassigned later)
        delete txn.group

        if (deflexTxn.signature !== false) {
          // Pre-signed transaction - needs re-signing with provided signature
          swapTxns.push({
            txn,
            deflexSignature: deflexTxn.signature,
          })
        } else {
          // User transaction - needs user signature
          swapTxns.push({
            txn,
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
   * Process required app opt-ins
   */
  private async processRequiredAppOptIns(): Promise<SwapTransaction[]> {
    // Fetch account information
    const accountInfo = await this.algorand.account.getInformation(this.address)

    // Check app opt-ins
    const userApps =
      accountInfo?.appsLocalState?.map((app) => Number(app.id)) || []
    const appsToOptIn = this.quote.requiredAppOptIns.filter(
      (appId) => !userApps.includes(appId),
    )

    // Create opt-in transactions if needed
    const appOptInTxns: Transaction[] = []
    if (appsToOptIn.length > 0) {
      const suggestedParams = await this.algorand.client.algod
        .getTransactionParams()
        .do()

      for (const appId of appsToOptIn) {
        const optInTxn = makeApplicationOptInTxnFromObject({
          sender: this.address,
          appIndex: appId,
          suggestedParams,
        })
        appOptInTxns.push(optInTxn)
      }
    }

    return appOptInTxns.map((txn) => ({ txn }))
  }

  /**
   * Finalize the transaction group and returned the finalized transactions.
   *
   * The composer's status will be at least BUILT after executing this method.
   *
   * @returns The finalized transactions
   * @throws Error if the composer is not in the BUILDING status
   * @throws Error if the group has no transactions
   */
  private buildGroup(): SwapTransaction[] {
    if (this.status === SwapComposerStatus.BUILDING) {
      if (this.transactions.length === 0) {
        throw new Error('Cannot build a group with 0 transactions')
      }
      if (this.transactions.length > 1) {
        assignGroupID(this.transactions.map((t) => t.txn))
      }
      this.status = SwapComposerStatus.BUILT
    }
    return this.transactions
  }

  /**
   * Re-sign a Deflex transaction using the provided signature
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
}
