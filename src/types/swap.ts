import type { SwapTxnSignature } from './api'
import type algosdk from 'algosdk'

/**
 * Processed transaction with signature metadata
 */
export interface ProcessedTransaction {
  readonly txn: algosdk.Transaction
  readonly deflexSignature?: SwapTxnSignature
}

/**
 * Result of processing swap transactions
 */
export interface ProcessSwapResult {
  /**
   * Array of transactions ready to be signed
   */
  readonly transactions: algosdk.Transaction[]

  /**
   * Indexes of transactions that need user signature
   */
  readonly indexesToSign: number[]
}
