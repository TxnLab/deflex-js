import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SwapTxn } from '@/types'
import {
  processRequiredAppOptIns,
  processSwapTransactions,
  assignGroupId,
  reSignTransaction,
} from '@/utils'

describe('transactions utilities', () => {
  const validAddress =
    '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

  const createMockTransaction = (): algosdk.Transaction => {
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: validAddress,
      receiver: validAddress,
      amount: 1000,
      suggestedParams: {
        fee: 1000,
        firstValid: 1000,
        lastValid: 2000,
        genesisID: 'testnet-v1.0',
        genesisHash: Buffer.from(
          'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
          'base64',
        ),
        minFee: 1000,
      },
    })
  }

  describe('processRequiredAppOptIns', () => {
    let mockAlgorand: AlgorandClient

    beforeEach(() => {
      mockAlgorand = {
        account: {
          getInformation: vi.fn(),
        },
        client: {
          algod: {
            getTransactionParams: vi.fn().mockReturnValue({
              do: vi.fn().mockResolvedValue({
                fee: 1000,
                firstValid: 1000,
                lastValid: 2000,
                minFee: 1000,
                genesisID: 'testnet-v1.0',
                genesisHash: Buffer.from(
                  'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
                  'base64',
                ),
              }),
            }),
          },
        },
      } as any
    })

    it('should return empty array when no opt-ins required', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        appsLocalState: [],
      })
      mockAlgorand.account.getInformation = mockGetInfo

      const result = await processRequiredAppOptIns({
        algorand: mockAlgorand,
        signerAddress: validAddress,
        requiredAppOptIns: [],
      })

      expect(result).toEqual([])
    })

    it('should return empty array when already opted in', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        appsLocalState: [{ id: 123456 }],
      })
      mockAlgorand.account.getInformation = mockGetInfo

      const result = await processRequiredAppOptIns({
        algorand: mockAlgorand,
        signerAddress: validAddress,
        requiredAppOptIns: [123456],
      })

      expect(result).toEqual([])
    })

    it('should create opt-in transactions for missing apps', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        appsLocalState: [],
      })
      mockAlgorand.account.getInformation = mockGetInfo

      const result = await processRequiredAppOptIns({
        algorand: mockAlgorand,
        signerAddress: validAddress,
        requiredAppOptIns: [123456, 789012],
      })

      expect(result).toHaveLength(2)
      expect(result[0]?.txn).toBeInstanceOf(algosdk.Transaction)
      expect(result[1]?.txn).toBeInstanceOf(algosdk.Transaction)
    })

    it('should only create opt-ins for apps not already opted in', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        appsLocalState: [{ id: 123456 }],
      })
      mockAlgorand.account.getInformation = mockGetInfo

      const result = await processRequiredAppOptIns({
        algorand: mockAlgorand,
        signerAddress: validAddress,
        requiredAppOptIns: [123456, 789012],
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.txn).toBeInstanceOf(algosdk.Transaction)
    })

    it('should handle empty appsLocalState', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({})
      mockAlgorand.account.getInformation = mockGetInfo

      const result = await processRequiredAppOptIns({
        algorand: mockAlgorand,
        signerAddress: validAddress,
        requiredAppOptIns: [123456],
      })

      expect(result).toHaveLength(1)
    })
  })

  describe('processSwapTransactions', () => {
    it('should process a single user transaction', () => {
      const txn = createMockTransaction()
      const swapTxns: SwapTxn[] = [
        {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
            'base64',
          ),
          signature: false,
          group: '',
          logicSigBlob: false,
        },
      ]

      const result = processSwapTransactions(swapTxns)

      expect(result).toHaveLength(1)
      expect(result?.[0]?.txn).toBeInstanceOf(algosdk.Transaction)
      expect(result?.[0]?.deflexSignature).toBeUndefined()
      expect(result?.[0]?.txn.group).toBeUndefined()
    })

    it('should process multiple transactions', () => {
      const txn1 = createMockTransaction()
      const txn2 = createMockTransaction()
      const swapTxns: SwapTxn[] = [
        {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn1)).toString(
            'base64',
          ),
          signature: false,
          group: '',
          logicSigBlob: false,
        },
        {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn2)).toString(
            'base64',
          ),
          signature: false,
          group: '',
          logicSigBlob: false,
        },
      ]

      const result = processSwapTransactions(swapTxns)

      expect(result).toHaveLength(2)
      expect(result[0]?.txn).toBeInstanceOf(algosdk.Transaction)
      expect(result[1]?.txn).toBeInstanceOf(algosdk.Transaction)
    })

    it('should identify pre-signed transactions', () => {
      const txn = createMockTransaction()
      const sk = algosdk.generateAccount().sk

      const swapTxns: SwapTxn[] = [
        {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
            'base64',
          ),
          signature: {
            type: 'secret_key',
            value: Object.fromEntries(sk.entries()) as unknown as Record<
              string,
              number
            >,
          },
          group: '',
          logicSigBlob: false,
        },
      ]

      const result = processSwapTransactions(swapTxns)

      expect(result).toHaveLength(1)
      expect(result[0]?.deflexSignature).toBeDefined()
      expect(result[0]?.deflexSignature?.type).toBe('secret_key')
    })

    it('should remove group IDs from transactions', () => {
      const txn = createMockTransaction()
      txn.group = new Uint8Array(32)

      const swapTxns: SwapTxn[] = [
        {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
            'base64',
          ),
          signature: false,
          group: '',
          logicSigBlob: false,
        },
      ]

      const result = processSwapTransactions(swapTxns)

      expect(result?.[0]?.txn.group).toBeUndefined()
    })

    it('should throw error for invalid transaction data', () => {
      const swapTxns: SwapTxn[] = [
        {
          data: 'invalid-base64-data',
          signature: false,
          group: '',
          logicSigBlob: false,
        },
      ]

      expect(() => processSwapTransactions(swapTxns)).toThrow(
        'Failed to process swap transaction at index 0',
      )
    })

    it('should handle empty array', () => {
      const result = processSwapTransactions([])

      expect(result).toEqual([])
    })
  })

  describe('assignGroupId', () => {
    it('should assign group ID to all transactions', () => {
      const txn1 = createMockTransaction()
      const txn2 = createMockTransaction()

      const processedTxns = [{ txn: txn1 }, { txn: txn2 }]

      assignGroupId(processedTxns)

      expect(processedTxns[0]?.txn.group).toBeDefined()
      expect(processedTxns[1]?.txn.group).toBeDefined()
      expect(processedTxns[0]?.txn.group).toEqual(processedTxns[1]?.txn.group)
    })

    it('should assign the same group ID to all transactions', () => {
      const txns = Array.from({ length: 5 }, () => createMockTransaction()).map(
        (txn) => ({ txn }),
      )

      assignGroupId(txns)

      const groupId = txns[0]?.txn.group
      expect(groupId).toBeDefined()

      for (const processedTxn of txns) {
        expect(processedTxn.txn.group).toEqual(groupId)
      }
    })

    it('should handle single transaction', () => {
      const txn = createMockTransaction()
      const processedTxns = [{ txn }]

      assignGroupId(processedTxns)

      expect(processedTxns[0]?.txn.group).toBeDefined()
    })
  })

  describe('reSignTransaction', () => {
    it('should re-sign transaction with secret key', () => {
      const txn = createMockTransaction()
      const sk = algosdk.generateAccount().sk

      const signature = {
        type: 'secret_key' as const,
        value: Object.fromEntries(sk.entries()) as unknown as Record<
          string,
          number
        >,
      }

      const signedBlob = reSignTransaction(txn, signature)

      expect(signedBlob).toBeInstanceOf(Uint8Array)
      expect(signedBlob.length).toBeGreaterThan(0)
    })

    it('should re-sign transaction with logic signature', () => {
      const logicSig = new algosdk.LogicSigAccount(
        new Uint8Array([1, 32, 1, 1, 34]), // Simple TEAL program
      )

      const txn = createMockTransaction()
      const signedTxn = algosdk.signLogicSigTransactionObject(txn, logicSig)

      const signature = {
        type: 'logic_signature' as const,
        value: Object.fromEntries(
          signedTxn.blob.entries(),
        ) as unknown as Record<string, number>,
      }

      const signedBlob = reSignTransaction(txn, signature)

      expect(signedBlob).toBeInstanceOf(Uint8Array)
      expect(signedBlob.length).toBeGreaterThan(0)
    })

    it('should throw error for unsupported signature type', () => {
      const txn = createMockTransaction()

      const signature = {
        type: 'unsupported' as any,
        value: {} as Record<string, number>,
      }

      expect(() => reSignTransaction(txn, signature)).toThrow(
        'Unsupported signature type',
      )
    })

    it('should throw error for invalid logic signature structure', () => {
      const txn = createMockTransaction()

      const signature = {
        type: 'logic_signature' as const,
        value: Object.fromEntries(
          new Uint8Array([1, 2, 3]).entries(),
        ) as unknown as Record<string, number>,
      }

      expect(() => reSignTransaction(txn, signature)).toThrow(
        'Failed to re-sign transaction',
      )
    })

    it('should handle transaction re-signing errors', () => {
      const txn = createMockTransaction()

      const signature = {
        type: 'secret_key' as const,
        value: Object.fromEntries(
          new Uint8Array(32).entries(),
        ) as unknown as Record<string, number>, // Invalid key length
      }

      expect(() => reSignTransaction(txn, signature)).toThrow(
        'Failed to re-sign transaction',
      )
    })
  })
})
