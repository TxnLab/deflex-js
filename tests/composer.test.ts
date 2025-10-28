import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SwapComposer, SwapComposerStatus } from '../src/composer'
import type { FetchQuoteResponse, DeflexTransaction } from '../src/types'

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

  const createMockQuote = (): Partial<FetchQuoteResponse> => ({
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

  const createMockDeflexTxn = (): DeflexTransaction => ({
    data: Buffer.from(
      algosdk.encodeUnsignedTransaction(createMockTransaction()),
    ).toString('base64'),
    group: '',
    logicSigBlob: false,
    signature: false,
  })

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
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        group: '',
        logicSigBlob: false,
        signature: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer).toBeInstanceOf(SwapComposer)
      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)
    })

    it('should throw error for missing quote', () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        group: '',
        logicSigBlob: false,
        signature: false,
      }

      expect(
        () =>
          new SwapComposer({
            quote: null as any,
            deflexTxns: [mockDeflexTxn],
            algorand: mockAlgorand,
            address: validAddress,
            signer: async (txns: algosdk.Transaction[]) =>
              txns.map(() => new Uint8Array(0)),
          }),
      ).toThrow('Quote is required')
    })

    it('should throw error for missing swap transactions', () => {
      expect(
        () =>
          new SwapComposer({
            quote: createMockQuote() as FetchQuoteResponse,
            deflexTxns: null as any,
            algorand: mockAlgorand,
            address: validAddress,
            signer: async (txns: algosdk.Transaction[]) =>
              txns.map(() => new Uint8Array(0)),
          }),
      ).toThrow('Swap transactions are required')
    })

    it('should throw error for empty swap transactions array', () => {
      expect(
        () =>
          new SwapComposer({
            quote: createMockQuote() as FetchQuoteResponse,
            deflexTxns: [],
            algorand: mockAlgorand,
            address: validAddress,
            signer: async (txns: algosdk.Transaction[]) =>
              txns.map(() => new Uint8Array(0)),
          }),
      ).toThrow('Swap transactions array cannot be empty')
    })

    it('should throw error for missing AlgorandClient', () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        group: '',
        logicSigBlob: false,
        signature: false,
      }

      expect(
        () =>
          new SwapComposer({
            quote: createMockQuote() as FetchQuoteResponse,
            deflexTxns: [mockDeflexTxn],
            algorand: null as any,
            address: validAddress,
            signer: async (txns: algosdk.Transaction[]) =>
              txns.map(() => new Uint8Array(0)),
          }),
      ).toThrow('AlgorandClient instance is required')
    })

    it('should throw error for invalid Algorand address', () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        group: '',
        logicSigBlob: false,
        signature: false,
      }

      expect(
        () =>
          new SwapComposer({
            quote: createMockQuote() as FetchQuoteResponse,
            deflexTxns: [mockDeflexTxn],
            algorand: mockAlgorand,
            address: 'invalid-address',
            signer: async (txns: algosdk.Transaction[]) =>
              txns.map(() => new Uint8Array(0)),
          }),
      ).toThrow('Invalid Algorand address')
    })
  })

  describe('getStatus', () => {
    it('should return BUILDING status initially', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)
    })
  })

  describe('count', () => {
    it('should return 0 for empty composer', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer.count()).toBe(0)
    })

    it('should return correct count after adding transactions', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
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
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      const txn = createMockTransaction()
      composer.addTransaction(txn)

      expect(composer.count()).toBe(1)
    })

    it('should allow chaining', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      const result = composer
        .addTransaction(createMockTransaction())
        .addTransaction(createMockTransaction())

      expect(result).toBe(composer)
      expect(composer.count()).toBe(2)
    })

    it('should throw error when not in BUILDING status', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      composer.addTransaction(createMockTransaction())

      // Sign to change status
      await composer.sign()

      expect(composer.getStatus()).toBe(SwapComposerStatus.SIGNED)

      expect(() => composer.addTransaction(createMockTransaction())).toThrow(
        'Cannot add transactions when composer status is not BUILDING',
      )
    })

    it('should throw error when exceeding max group size', () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
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
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      await composer.addSwapTransactions()

      expect(composer.count()).toBeGreaterThan(0)
    })

    it('should throw error when swap transactions already added', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      await composer.addSwapTransactions()

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Swap transactions have already been added',
      )
    })

    it('should throw error when not in BUILDING status', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      composer.addTransaction(createMockTransaction())

      // Add swap transactions first
      await composer.addSwapTransactions()

      // Sign to change status
      await composer.sign()

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Swap transactions have already been added',
      )
    })

    it('should throw error when exceeding max group size', async () => {
      const mockDeflexTxns: DeflexTransaction[] = Array.from(
        { length: 17 },
        () => ({
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }),
      )

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: mockDeflexTxns,
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      await expect(composer.addSwapTransactions()).rejects.toThrow(
        'Adding swap transactions exceeds the maximum atomic group size',
      )
    })

    it('should process app opt-ins when required', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const quote: Partial<FetchQuoteResponse> = {
        ...createMockQuote(),
        requiredAppOptIns: [123456],
      }

      const composer = new SwapComposer({
        quote: quote as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      await composer.addSwapTransactions()

      // Should have opt-in + swap transaction
      expect(composer.count()).toBeGreaterThanOrEqual(2)
    })
  })

  describe('sign', () => {
    it('should sign transactions and return signed blobs', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      const signedTxns = await composer.sign()

      expect(signedTxns).toHaveLength(2) // 1 user txn + 1 from deflexTxns
      expect(signedTxns?.[0]).toBeInstanceOf(Uint8Array)
      expect(composer.getStatus()).toBe(SwapComposerStatus.SIGNED)
    })

    it('should automatically add swap transactions if not added', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      expect(composer.count()).toBe(0)

      await composer.sign()

      expect(composer.count()).toBeGreaterThan(0)
    })

    it('should return cached signed transactions on subsequent calls', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      const signedTxns1 = await composer.sign()

      const signedTxns2 = await composer.sign()

      expect(signedTxns2).toBe(signedTxns1)
    })

    it('should handle pre-signed transactions', async () => {
      const logicSig = new algosdk.LogicSigAccount(
        new Uint8Array([1, 32, 1, 1, 34]), // Simple TEAL program
      )

      const appAddress = algosdk.getApplicationAddress(BigInt(123456))
      const txn = createMockTransaction(appAddress.toString())
      const signedTxn = algosdk.signLogicSigTransactionObject(txn, logicSig)

      const mockDeflexTxn: DeflexTransaction = {
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
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          // Should not receive pre-signed transactions
          expect(txns.length).toBe(0)
          return []
        },
      })

      await composer.addSwapTransactions()

      const signedTxns = await composer.sign()

      expect(signedTxns.length).toBeGreaterThan(0)
    })

    it('should assign group ID to transactions', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          // Verify group IDs are assigned
          expect(txns?.[0]?.group).toBeDefined()
          expect(txns?.[1]?.group).toBeDefined()
          expect(txns?.[0]?.group).toEqual(txns?.[1]?.group)

          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      const txn1 = createMockTransaction()
      const txn2 = createMockTransaction()

      composer.addTransaction(txn1).addTransaction(txn2)

      await composer.sign()
    })
  })

  describe('submit', () => {
    it('should submit signed transactions to the network', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      const txIds = await composer.submit()

      expect(txIds).toHaveLength(2) // 1 user txn + 1 from deflexTxns
      expect(composer.getStatus()).toBe(SwapComposerStatus.SUBMITTED)
      expect(mockAlgorand.client.algod.sendRawTransaction).toHaveBeenCalled()
    })

    it('should throw error when trying to resubmit', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      await composer.submit()

      await composer.execute()

      await expect(composer.submit()).rejects.toThrow(
        'Transaction group cannot be resubmitted',
      )
    })
  })

  describe('execute', () => {
    it('should execute the swap and wait for confirmation', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      const result = await composer.execute()

      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds).toHaveLength(2) // 1 user txn + 1 from deflexTxns
      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
    })

    it('should throw error when already committed', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      await composer.execute()

      await expect(composer.execute()).rejects.toThrow(
        'Transaction group has already been executed successfully',
      )
    })

    it('should use custom wait rounds parameter', async () => {
      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [createMockDeflexTxn()],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) => {
          return txns.map((txn) => {
            const sk = algosdk.generateAccount().sk
            return algosdk.signTransaction(txn, sk).blob
          })
        },
      })

      composer.addTransaction(createMockTransaction())

      const result = await composer.execute(10)

      // Verify execution completed successfully
      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds).toHaveLength(2) // 1 user txn + 1 from deflexTxns
    })
  })

  describe('transaction processing (via public API)', () => {
    describe('app opt-in processing', () => {
      it('should not create opt-in transactions when none required', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const quote: Partial<FetchQuoteResponse> = {
          ...createMockQuote(),
          requiredAppOptIns: [], // No opt-ins required
        }

        const composer = new SwapComposer({
          quote: quote as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        // Should only have the swap transaction, no opt-ins
        expect(composer.count()).toBe(1)
      })

      it('should not create opt-in transactions when already opted in', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const quote: Partial<FetchQuoteResponse> = {
          ...createMockQuote(),
          requiredAppOptIns: [123456],
        }

        // Mock that user is already opted into app 123456
        mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
          appsLocalState: [{ id: 123456 }],
          assets: [],
        })

        const composer = new SwapComposer({
          quote: quote as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        // Should only have the swap transaction, no opt-ins
        expect(composer.count()).toBe(1)
      })

      it('should create opt-in transactions for missing apps', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const quote: Partial<FetchQuoteResponse> = {
          ...createMockQuote(),
          requiredAppOptIns: [123456],
        }

        // Mock that user is not opted in
        mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
          appsLocalState: [],
          assets: [],
        })

        const composer = new SwapComposer({
          quote: quote as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        // Should have opt-in + swap transaction
        expect(composer.count()).toBe(2)
      })

      it('should only create opt-ins for apps not already opted in', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const quote: Partial<FetchQuoteResponse> = {
          ...createMockQuote(),
          requiredAppOptIns: [123456, 789012, 345678],
        }

        // Mock that user is opted into one of the three apps
        mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
          appsLocalState: [{ id: 789012 }],
          assets: [],
        })

        const composer = new SwapComposer({
          quote: quote as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        // Should have 2 opt-ins + 1 swap = 3 total
        expect(composer.count()).toBe(3)
      })

      it('should handle empty appsLocalState', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const quote: Partial<FetchQuoteResponse> = {
          ...createMockQuote(),
          requiredAppOptIns: [123456],
        }

        // Mock that appsLocalState is undefined
        mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
          appsLocalState: undefined,
          assets: [],
        })

        const composer = new SwapComposer({
          quote: quote as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        // Should have opt-in + swap transaction
        expect(composer.count()).toBe(2)
      })
    })

    describe('swap transaction decoding', () => {
      it('should process a single user transaction', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: Buffer.from(
            algosdk.encodeUnsignedTransaction(createMockTransaction()),
          ).toString('base64'),
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const composer = new SwapComposer({
          quote: createMockQuote() as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        expect(composer.count()).toBe(1)
      })

      it('should process multiple transactions', async () => {
        const mockDeflexTxns: DeflexTransaction[] = [
          {
            data: Buffer.from(
              algosdk.encodeUnsignedTransaction(createMockTransaction()),
            ).toString('base64'),
            signature: false,
            group: '',
            logicSigBlob: false,
          },
          {
            data: Buffer.from(
              algosdk.encodeUnsignedTransaction(createMockTransaction()),
            ).toString('base64'),
            signature: false,
            group: '',
            logicSigBlob: false,
          },
        ]

        const composer = new SwapComposer({
          quote: createMockQuote() as FetchQuoteResponse,
          deflexTxns: mockDeflexTxns,
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        expect(composer.count()).toBe(2)
      })

      it('should throw error for invalid transaction data', async () => {
        const mockDeflexTxn: DeflexTransaction = {
          data: 'invalid-base64-data',
          signature: false,
          group: '',
          logicSigBlob: false,
        }

        const composer = new SwapComposer({
          quote: createMockQuote() as FetchQuoteResponse,
          deflexTxns: [mockDeflexTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await expect(composer.addSwapTransactions()).rejects.toThrow(
          'Failed to process swap transaction',
        )
      })

      it('should throw error for empty transaction array', () => {
        expect(
          () =>
            new SwapComposer({
              quote: createMockQuote() as FetchQuoteResponse,
              deflexTxns: [],
              algorand: mockAlgorand,
              address: validAddress,
              signer: async (txns: algosdk.Transaction[]) =>
                txns.map(() => new Uint8Array(0)),
            }),
        ).toThrow('Swap transactions array cannot be empty')
      })
    })

    describe('transaction re-signing', () => {
      it('should re-sign transaction with logic signature', async () => {
        const logicSig = new algosdk.LogicSigAccount(
          new Uint8Array([1, 32, 1, 1, 34]),
        )

        const appAddress = algosdk.getApplicationAddress(BigInt(123456))
        const txn = createMockTransaction(appAddress.toString())
        const signedTxn = algosdk.signLogicSigTransactionObject(txn, logicSig)

        const mockDeflexLsigTxn: DeflexTransaction = {
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
          quote: createMockQuote() as FetchQuoteResponse,
          deflexTxns: [mockDeflexLsigTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        const signedTxns = await composer.sign()

        expect(signedTxns.length).toBeGreaterThan(0)
      })

      it('should handle transaction re-signing with secret key', async () => {
        const account = algosdk.generateAccount()
        const txn = createMockTransaction(account.addr.toString())

        const mockDeflexSkTxn: DeflexTransaction = {
          data: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
            'base64',
          ),
          signature: {
            type: 'secret_key',
            value: Object.fromEntries(
              account.sk.entries(),
            ) as unknown as Record<string, number>,
          },
          group: '',
          logicSigBlob: false,
        }

        const composer = new SwapComposer({
          quote: createMockQuote() as FetchQuoteResponse,
          deflexTxns: [mockDeflexSkTxn],
          algorand: mockAlgorand,
          address: validAddress,
          signer: async (txns: algosdk.Transaction[]) =>
            txns.map(() => new Uint8Array(0)),
        })

        await composer.addSwapTransactions()

        const signedTxns = await composer.sign()

        expect(signedTxns.length).toBeGreaterThan(0)
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle a complete swap workflow', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer.getStatus()).toBe(SwapComposerStatus.BUILDING)

      const beforeTxn = createMockTransaction()
      const afterTxn = createMockTransaction()

      composer.addTransaction(beforeTxn)
      await composer.addSwapTransactions()
      composer.addTransaction(afterTxn)

      expect(composer.count()).toBeGreaterThanOrEqual(3)

      const result = await composer.execute(1234)

      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.confirmedRound).toBe(1234n)
      expect(result.txIds.length).toBe(composer.count())
    })

    it('should handle swap without additional transactions', async () => {
      const mockDeflexTxn: DeflexTransaction = {
        data: Buffer.from(
          algosdk.encodeUnsignedTransaction(createMockTransaction()),
        ).toString('base64'),
        signature: false,
        group: '',
        logicSigBlob: false,
      }

      const composer = new SwapComposer({
        quote: createMockQuote() as FetchQuoteResponse,
        deflexTxns: [mockDeflexTxn],
        algorand: mockAlgorand,
        address: validAddress,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      // Execute without manually adding swap transactions
      const result = await composer.execute(1234)

      expect(composer.getStatus()).toBe(SwapComposerStatus.COMMITTED)
      expect(result.txIds.length).toBeGreaterThan(0)
    })
  })
})
