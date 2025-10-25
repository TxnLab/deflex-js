import type { SwapTxnSignature } from './api'
import type algosdk from 'algosdk'

/**
 * Processed transaction with signature metadata
 */
export interface ProcessedTransaction {
  readonly txn: algosdk.Transaction
  readonly deflexSignature?: SwapTxnSignature
}
