import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { QuoteResponse, SwapTxn } from '@/types/api'
import { SwapComposer, SwapComposerStatus } from '@/composer'

// Mock waitForConfirmation
vi.mock('algosdk', async () => {
  const actual = await vi.importActual<typeof algosdk>('algosdk')
  return {
    ...actual,
    waitForConfirmation: vi.fn().mockResolvedValue({
      confirmedRound: 1234n,
    }),
  }
})

describe('SwapComposer', () => {
  let mockAlgorand: AlgorandClient
  const validAddress =
    '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

  const createMockQuote = (): Partial<QuoteResponse> => ({
    fromASAID: 0,
    toASAID: 31566704,
    quote: '1000000',
    route: [],
    txnPayload: { iv: 'test-iv', data: 'test-data' },
    requiredAppOptIns: [],
  })

  const createMockTransaction = (
    senderParam: string = validAddress,
  ): algosdk.Transaction => {
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderParam,
      receiver: senderParam,
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

  beforeEach(() => {
    mockAlgorand = {
      account: {
        getInformation: vi.fn().mockResolvedValue({
          appsLocalState: [],
          assets: [],
        }),
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
          sendRawTransaction: vi.fn().mockReturnValue({
            do: vi.fn().mockResolvedValue({ txId: 'test-tx-id' }),
          }),
        },
      },
    } as any
  })

  describe('constructor', () => {
    it('should create a composer with valid configuration', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      expect(composer).toBeInstanceOf(SwapComposer)
      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)
      expect(composer.count()).toBe(0)
    })

    it('should throw error for invalid signer address', () => {
      expect(
        () =>
          new SwapComposer({
            quote: createMockQuote() as QuoteResponse,
            swapTxns: [],
            algorand: mockAlgorand,
            signerAddress: 'invalid-address',
          }),
      ).toThrow('Invalid Algorand address')
    })
  })

  describe('getStatus', () => {
    it('should return BUILDING status initially', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)
    })
  })

  describe('count', () => {
    it('should return 0 for empty composer', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      expect(composer.count()).toBe(0)
    })

    it('should return correct count after adding transactions', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())
      expect(composer.count()).toBe(1)

      composer.addTransaction(createMockTransaction())
      expect(composer.count()).toBe(2)
    })
  })

  describe('addTransaction', () => {
    it('should add a transaction to the group', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      const txn = createMockTransaction()
      composer.addTransaction(txn)

      expect(composer.count()).toBe(1)
    })

    it('should allow chaining', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      const result = composer
        .addTransaction(createMockTransaction())
        .addTransaction(createMockTransaction())

      expect(result).toBe(composer)
      expect(composer.count()).toBe(2)
    })

    it('should throw error when not in BUILDING status', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      // Sign to change status
      await composer.sign(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      expect(composer.getStatus()).toBe(SwapComposerStatus.SIGNED)

      expect(() => composer.addTransaction(createMockTransaction())).toThrow(
        'Cannot add transactions when composer status is not BUILDING',
      )
    })

    it('should throw error when exceeding max group size', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      // Add 16 transactions (max group size)
      for (let i = 0; i < SwapComposer.MAX_GROUP_SIZE; i++) {
        composer.addTransaction(createMockTransaction())
      }

      expect(() => composer.addTransaction(createMockTransaction())).toThrow(
        'Adding an additional transaction exceeds the maximum atomic group size',
      )
    })
  })

  describe('addSwapTransactions', () => {
    it('should add swap transactions to the group', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      await composer.addSwapTransactions()

      expect(composer.count()).toBeGreaterThan(0)
    })

    it('should throw error when swap transactions already added', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      await composer.addSwapTransactions()

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Swap transactions have already been added',
      )
    })

    it('should throw error when not in BUILDING status', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      // Add swap transactions first
      await composer.addSwapTransactions()

      // Sign to change status
      await composer.sign(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Swap transactions have already been added',
      )
    })

    it('should throw error when exceeding max group size', async () => {
      const mockSwapTxns: SwapTxn[] = Array.from({ length: 17 }, () => ({
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }))

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: mockSwapTxns,
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Adding swap transactions exceeds the maximum atomic group size',
      )
    })

    it('should process app opt-ins when required', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const quote: Partial<QuoteResponse> = {
        ...createMockQuote(),
        requiredAppOptIns: [123456],
      }

      const composer = new SwapComposer({
        quote: quote as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      await composer.addSwapTransactions()

      // Should have opt-in + swap transaction
      expect(composer.count()).toBeGreaterThanOrEqual(2)
    })
  })

  describe('sign', () => {
    it('should sign transactions and return signed blobs', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      const signedTxns = await composer.sign(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      expect(signedTxns).toHaveLength(1)
      expect(signedTxns?.[0]).toBeInstanceOf(Uint8Array)
      expect(composer.getStatus()).toBe(SwapComposerStatus.SIGNED)
    })

    it('should automatically add swap transactions if not added', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      expect(composer.count()).toBe(0)

      await composer.sign(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      expect(composer.count()).toBeGreaterThan(0)
    })

    it('should return cached signed transactions on subsequent calls', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      const signedTxns1 = await composer.sign(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      const signedTxns2 = await composer.sign(
        async (_txns: algosdk.Transaction[]) => {
          throw new Error('Should not be called')
        },
      )

      expect(signedTxns2).toBe(signedTxns1)
    })

    it('should handle pre-signed transactions', async () => {
      const logicSig = new algosdk.LogicSigAccount(
        new Uint8Array([1, 32, 1, 1, 34]), // Simple TEAL program
      )

      const appAddress = algosdk.getApplicationAddress(BigInt(123456))
      const txn = createMockTransaction(appAddress.toString())
      const signedTxn = algosdk.signLogicSigTransactionObject(txn, logicSig)

      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
          'base64',
        ),
        signature: {
          type: 'logic_signature',
          value: Object.fromEntries(
            signedTxn.blob.entries(),
          ) as unknown as Record<string, number>,
        },
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      await composer.addSwapTransactions()

      const signedTxns = await composer.sign(
        async (txns: algosdk.Transaction[]) => {
          // Should not receive pre-signed transactions
          expect(txns.length).toBe(0)
          return []
        },
      )

      expect(signedTxns.length).toBeGreaterThan(0)
    })

    it('should assign group ID to transactions', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      const txn1 = createMockTransaction()
      const txn2 = createMockTransaction()

      composer.addTransaction(txn1).addTransaction(txn2)

      await composer.sign(async (txns: algosdk.Transaction[]) => {
        // Verify group IDs are assigned
        expect(txns?.[0]?.group).toBeDefined()
        expect(txns?.[1]?.group).toBeDefined()
        expect(txns?.[0]?.group).toEqual(txns?.[1]?.group)

        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })
    })
  })

  describe('submit', () => {
    it('should submit signed transactions to the network', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      const txIds = await composer.submit(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      expect(txIds).toHaveLength(1)
      expect(composer.getStatus()).toBe(SwapComposerStatus.SUBMITTED)
      expect(mockAlgorand.client.algod.sendRawTransaction).toHaveBeenCalled()
    })

    it('should throw error when trying to resubmit', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      await composer.submit(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      await composer.execute(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      await expect(
        composer.submit(async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        }),
      ).rejects.toThrow('Transaction group cannot be resubmitted')
    })
  })

  describe('execute', () => {
    it('should execute the swap and wait for confirmation', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      const result = await composer.execute(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds).toHaveLength(1)
      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
    })

    it('should throw error when already committed', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      await composer.execute(async (txns: algosdk.Transaction[]) => {
        return txns.map((txn) => {
          const sk = algosdk.generateAccount().sk
          return algosdk.signTransaction(txn, sk).blob
        })
      })

      await expect(
        composer.execute(async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        }),
      ).rejects.toThrow(
        'Transaction group has already been executed successfully',
      )
    })

    it('should use custom wait rounds parameter', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      composer.addTransaction(createMockTransaction())

      const result = await composer.execute(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
        10,
      )

      // Verify execution completed successfully
      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds).toHaveLength(1)
    })
  })

  describe('integration scenarios', () => {
    it('should handle a complete swap workflow', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)

      const beforeTxn = createMockTransaction()
      const afterTxn = createMockTransaction()

      composer.addTransaction(beforeTxn)
      await composer.addSwapTransactions()
      composer.addTransaction(afterTxn)

      expect(composer.count()).toBeGreaterThanOrEqual(3)

      const result = await composer.execute(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds.length).toBe(composer.count())
    })

    it('should handle swap without additional transactions', async () => {
      const mockSwapTxn: SwapTxn = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as QuoteResponse,
        swapTxns: [mockSwapTxn],
        algorand: mockAlgorand,
        signerAddress: validAddress,
      })

      // Execute without manually adding swap transactions
      const result = await composer.execute(
        async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      )

      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.txIds.length).toBeGreaterThan(0)
    })
  })
})
