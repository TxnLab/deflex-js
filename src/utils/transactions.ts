import algosdk from 'algosdk'
import type { SwapTxn, SwapTxnSignature } from '@/types/api'
import type { ProcessedTransaction } from '@/types/swap'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

/**
 * Process required app opt-ins
 */
export async function processRequiredAppOptIns(params: {
  algorand: AlgorandClient
  signerAddress: string
  requiredAppOptIns: readonly number[]
}): Promise<ProcessedTransaction[]> {
  const { algorand, signerAddress, requiredAppOptIns } = params

  // Fetch account information
  const accountInfo = await algorand.account.getInformation(signerAddress)

  // Check app opt-ins
  const userApps =
    accountInfo?.appsLocalState?.map((app) => Number(app.id)) || []
  const appsToOptIn = requiredAppOptIns.filter(
    (appId) => !userApps.includes(appId),
  )

  // Create opt-in transactions if needed
  const txns: algosdk.Transaction[] = []
  if (appsToOptIn.length > 0) {
    const suggestedParams = await algorand.client.algod
      .getTransactionParams()
      .do()

    for (const appId of appsToOptIn) {
      const optInTxn = algosdk.makeApplicationOptInTxnFromObject({
        sender: signerAddress,
        appIndex: appId,
        suggestedParams,
      })
      txns.push(optInTxn)
    }
  }

  return txns.map((txn) => ({ txn }))
}

/**
 * Process swap transactions from API response
 * Decodes base64 data, preserves original group IDs, and identifies signature requirements
 */
export function processSwapTransactions(
  swapTxns: SwapTxn[],
): ProcessedTransaction[] {
  const processedTxns: ProcessedTransaction[] = []

  for (let i = 0; i < swapTxns.length; i++) {
    const swapTxn = swapTxns[i]
    if (!swapTxn) continue

    try {
      // Decode transaction from base64 data
      const txnBytes = Buffer.from(swapTxn.data, 'base64')
      const transaction = algosdk.decodeUnsignedTransaction(txnBytes)

      // Remove group ID (will be reassigned later)
      delete transaction.group

      if (swapTxn.signature !== false) {
        // Pre-signed transaction - needs re-signing with provided signature
        processedTxns.push({
          txn: transaction,
          deflexSignature: swapTxn.signature,
        })
      } else {
        // User transaction - needs user signature
        processedTxns.push({
          txn: transaction,
        })
      }
    } catch (error) {
      throw new Error(
        `Failed to process swap transaction at index ${i}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return processedTxns
}

/**
 * Assign new group ID to all transactions
 */
export function assignGroupId(transactions: ProcessedTransaction[]): void {
  const txns = transactions.map((item) => item.txn)
  const groupId = algosdk.computeGroupID(txns)

  transactions.forEach((item) => {
    item.txn.group = groupId
  })
}

/**
 * Re-sign a transaction using the provided Deflex signature
 */
export function reSignTransaction(
  transaction: algosdk.Transaction,
  signature: SwapTxnSignature,
): Uint8Array {
  try {
    if (signature.type === 'logic_signature') {
      // Decode the signature value to extract the logic signature
      const valueArray = signature.value as Record<string, number>
      const valueBytes = new Uint8Array(Object.values(valueArray))
      const decoded = algosdk.msgpackRawDecode(valueBytes) as {
        lsig?: { l: Uint8Array; arg?: Uint8Array[] }
      }

      if (!decoded.lsig) {
        throw new Error('Logic signature structure missing lsig field')
      }

      const lsig = decoded.lsig
      const logicSigAccount = new algosdk.LogicSigAccount(lsig.l, lsig.arg)

      const signedTxn = algosdk.signLogicSigTransactionObject(
        transaction,
        logicSigAccount,
      )
      return signedTxn.blob
    } else if (signature.type === 'secret_key') {
      // Convert signature.value (Record<string, number>) to Uint8Array
      const valueArray = signature.value as Record<string, number>
      const secretKey = new Uint8Array(Object.values(valueArray))
      const signedTxn = algosdk.signTransaction(transaction, secretKey)
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
