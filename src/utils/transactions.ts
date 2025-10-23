import algosdk from 'algosdk'
import type { SwapTxn, SwapTxnSignature } from '@/types/api'
import type { ProcessedTransaction } from '@/types/swap'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { AccountInformation } from '@algorandfoundation/algokit-utils/types/account'

/**
 * Opt-in requirements result
 */
export interface OptInRequirements {
  readonly appOptInTxns: algosdk.Transaction[]
  readonly assetOptInTxn: algosdk.Transaction | null
}

/**
 * Analyze and create opt-in transactions if needed
 */
export async function analyzeOptInRequirements(
  algorand: AlgorandClient,
  signerAddress: string,
  accountInfo: AccountInformation,
  requiredAppOptIns: readonly number[],
  outputAssetId: number,
): Promise<OptInRequirements> {
  // Check app opt-ins
  const userApps =
    accountInfo?.appsLocalState?.map((app) => Number(app.id)) || []
  const appsToOptIn = requiredAppOptIns.filter(
    (appId) => !userApps.includes(appId),
  )

  // Check asset opt-in (skip if ALGO = 0)
  const needsAssetOptIn =
    outputAssetId !== 0 &&
    accountInfo?.assets?.find(
      (asset) => asset.assetId === BigInt(outputAssetId),
    ) === undefined

  // Create opt-in transactions if needed
  const appOptInTxns: algosdk.Transaction[] = []
  if (appsToOptIn.length > 0) {
    const suggestedParams = await algorand.client.algod
      .getTransactionParams()
      .do()

    for (const appId of appsToOptIn) {
      const optInTxn = algosdk.makeApplicationOptInTxnFromObject({
        sender: signerAddress,
        suggestedParams,
        appIndex: appId,
      })
      appOptInTxns.push(optInTxn)
    }
  }

  let assetOptInTxn: algosdk.Transaction | null = null
  if (needsAssetOptIn) {
    assetOptInTxn = await algorand.createTransaction.assetOptIn({
      sender: signerAddress,
      assetId: BigInt(outputAssetId),
    })
  }

  return { appOptInTxns, assetOptInTxn }
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
