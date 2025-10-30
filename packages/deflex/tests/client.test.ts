import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DeflexClient } from '../src/client'
import { Protocol } from '../src/constants'
import type { FetchQuoteResponse, FetchSwapTxnsResponse } from '../src/types'

// Mock the AlgorandClient
vi.mock('@algorandfoundation/algokit-utils', () => ({
  AlgorandClient: {
    fromConfig: vi.fn(() => ({
      account: {
        getInformation: vi.fn(),
      },
      client: {
        algod: {
          getTransactionParams: vi.fn(() => ({
            do: vi.fn(),
          })),
        },
      },
    })),
  },
}))

// Mock the request utility
vi.mock('../src/utils', () => ({
  request: vi.fn(),
  HTTPError: class HTTPError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      public data: unknown,
    ) {
      super(`HTTP ${status} ${statusText}`)
      this.name = 'HTTPError'
    }
  },
}))

describe('DeflexClient', () => {
  const validConfig = {
    apiKey: 'test-api-key',
  }

  describe('constructor', () => {
    it('should create a client with valid configuration', () => {
      const client = new DeflexClient(validConfig)
      expect(client).toBeInstanceOf(DeflexClient)
    })

    it('should throw error when apiKey is missing', () => {
      expect(() => new DeflexClient({ apiKey: '' })).toThrow(
        'API key is required',
      )
    })

    it('should validate referrer address when provided', () => {
      expect(
        () =>
          new DeflexClient({
            ...validConfig,
            referrerAddress: 'invalid-address',
          }),
      ).toThrow('Invalid Algorand address')
    })

    it('should accept valid referrer address', () => {
      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'
      const client = new DeflexClient({
        ...validConfig,
        referrerAddress: validAddress,
      })
      expect(client).toBeInstanceOf(DeflexClient)
    })

    it('should validate feeBps is within range', () => {
      expect(() => new DeflexClient({ ...validConfig, feeBps: -1 })).toThrow(
        'Invalid fee',
      )

      expect(() => new DeflexClient({ ...validConfig, feeBps: 301 })).toThrow(
        'Invalid fee',
      )
    })

    it('should accept valid feeBps values', () => {
      const client1 = new DeflexClient({ ...validConfig, feeBps: 0 })
      const client2 = new DeflexClient({ ...validConfig, feeBps: 15 })
      const client3 = new DeflexClient({ ...validConfig, feeBps: 300 })

      expect(client1).toBeInstanceOf(DeflexClient)
      expect(client2).toBeInstanceOf(DeflexClient)
      expect(client3).toBeInstanceOf(DeflexClient)
    })

    it('should use default configuration values', () => {
      const client = new DeflexClient(validConfig)
      expect(client).toBeInstanceOf(DeflexClient)
    })

    it('should accept custom algod configuration', () => {
      const client = new DeflexClient({
        ...validConfig,
        algodUri: 'https://custom-node.com',
        algodToken: 'custom-token',
        algodPort: 8080,
      })
      expect(client).toBeInstanceOf(DeflexClient)
    })

    it('should accept custom apiBaseUrl configuration', () => {
      const client = new DeflexClient({
        ...validConfig,
        apiBaseUrl: 'https://custom-api.example.com',
      })
      expect(client).toBeInstanceOf(DeflexClient)
    })
  })

  describe('fetchQuote', () => {
    let client: DeflexClient
    let mockRequest: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      client = new DeflexClient(validConfig)
      const requestModule = vi.mocked(await import('../src/utils'), {
        partial: true,
      })
      mockRequest = requestModule.request as ReturnType<typeof vi.fn>
      mockRequest.mockClear()
    })

    it('should fetch a quote with minimal parameters', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      const result = await client.fetchQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
      })

      expect(result).toEqual(mockQuote)
      expect(mockRequest).toHaveBeenCalledOnce()
    })

    it('should include all query parameters in the request', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      await client.fetchQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
        type: 'fixed-output',
        disabledProtocols: [Protocol.TinymanV2],
        maxGroupSize: 12,
        maxDepth: 3,
        optIn: true,
      })

      const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
      expect(callUrl).toContain('fromASAID=0')
      expect(callUrl).toContain('toASAID=31566704')
      expect(callUrl).toContain('amount=1000000')
      expect(callUrl).toContain('type=fixed-output')
      expect(callUrl).toContain(
        'disabledProtocols=Humble%2CTinyman%2CTinymanV2',
      )
      expect(callUrl).toContain('maxGroupSize=12')
      expect(callUrl).toContain('maxDepth=3')
      expect(callUrl).toContain('optIn=true')
    })

    it('should include deprecated protocols in disabled list', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      await client.fetchQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
      })

      const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
      expect(callUrl).toContain('Humble')
      expect(callUrl).toContain('Tinyman')
    })

    it('should use custom apiBaseUrl when provided', async () => {
      const customClient = new DeflexClient({
        ...validConfig,
        apiBaseUrl: 'https://custom-api.example.com',
      })

      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      await customClient.fetchQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
      })

      const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
      expect(callUrl).toContain('https://custom-api.example.com/fetchQuote')
    })

    it('should check for asset opt-in when autoOptIn is enabled and address provided', async () => {
      const clientWithAutoOptIn = new DeflexClient({
        ...validConfig,
        autoOptIn: true,
      })

      const mockAlgorand = AlgorandClient.fromConfig({
        algodConfig: { server: '', port: 443, token: '' },
      })
      const mockGetInfo = vi.fn().mockResolvedValue({
        assets: [],
      })
      mockAlgorand.account.getInformation = mockGetInfo

      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

      // Override the algorand instance for this test
      ;(clientWithAutoOptIn as any).algorand = mockAlgorand

      await clientWithAutoOptIn.fetchQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
        address: validAddress,
      })

      expect(mockGetInfo).toHaveBeenCalledWith(validAddress)
    })

    it('should handle BigInt values for asset IDs and amounts', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuote)

      await client.fetchQuote({
        fromASAID: 0n,
        toASAID: 31566704n,
        amount: 1_000_000n,
      })

      const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
      expect(callUrl).toContain('fromASAID=0')
      expect(callUrl).toContain('toASAID=31566704')
      expect(callUrl).toContain('amount=1000000')
    })

    describe('optIn parameter', () => {
      it('should include optIn=true when optIn is explicitly set to true', async () => {
        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        await client.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          optIn: true,
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).toContain('optIn=true')
      })

      it('should include optIn=false when optIn is explicitly set to false', async () => {
        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        await client.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          optIn: false,
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).toContain('optIn=false')
      })

      it('should NOT include optIn param when optIn is undefined and autoOptIn is disabled', async () => {
        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        await client.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          // optIn is undefined
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).not.toContain('optIn=')
      })

      it('should include optIn=true when autoOptIn is enabled and asset opt-in is needed', async () => {
        const clientWithAutoOptIn = new DeflexClient({
          ...validConfig,
          autoOptIn: true,
        })

        const mockAlgorand = AlgorandClient.fromConfig({
          algodConfig: { server: '', port: 443, token: '' },
        })
        const mockGetInfo = vi.fn().mockResolvedValue({
          assets: [], // Asset not opted in
        })
        mockAlgorand.account.getInformation = mockGetInfo
        ;(clientWithAutoOptIn as any).algorand = mockAlgorand

        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        const validAddress =
          '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

        await clientWithAutoOptIn.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          address: validAddress,
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).toContain('optIn=true')
        expect(mockGetInfo).toHaveBeenCalledWith(validAddress)
      })

      it('should include optIn=false when autoOptIn is enabled and asset is already opted in', async () => {
        const clientWithAutoOptIn = new DeflexClient({
          ...validConfig,
          autoOptIn: true,
        })

        const mockAlgorand = AlgorandClient.fromConfig({
          algodConfig: { server: '', port: 443, token: '' },
        })
        const mockGetInfo = vi.fn().mockResolvedValue({
          assets: [{ assetId: BigInt(31566704), amount: BigInt(0) }], // Asset already opted in
        })
        mockAlgorand.account.getInformation = mockGetInfo
        ;(clientWithAutoOptIn as any).algorand = mockAlgorand

        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        const validAddress =
          '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

        await clientWithAutoOptIn.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          address: validAddress,
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).toContain('optIn=false')
        expect(mockGetInfo).toHaveBeenCalledWith(validAddress)
      })

      it('should NOT include optIn param when autoOptIn is enabled but no address provided', async () => {
        const clientWithAutoOptIn = new DeflexClient({
          ...validConfig,
          autoOptIn: true,
        })

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        await clientWithAutoOptIn.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          // No address provided
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).not.toContain('optIn=')
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'autoOptIn is enabled but no address provided to fetchQuote(). Asset opt-in check skipped.',
        )

        consoleWarnSpy.mockRestore()
      })

      it('should use explicit optIn value even when autoOptIn is enabled', async () => {
        const clientWithAutoOptIn = new DeflexClient({
          ...validConfig,
          autoOptIn: true,
        })

        const mockAlgorand = AlgorandClient.fromConfig({
          algodConfig: { server: '', port: 443, token: '' },
        })
        const mockGetInfo = vi.fn()
        mockAlgorand.account.getInformation = mockGetInfo
        ;(clientWithAutoOptIn as any).algorand = mockAlgorand

        const mockQuote: Partial<FetchQuoteResponse> = {
          fromASAID: 0,
          toASAID: 31566704,
          quote: '1000000',
          route: [],
          txnPayload: { iv: 'test-iv', data: 'test-data' },
          requiredAppOptIns: [],
        }

        mockRequest.mockResolvedValue(mockQuote)

        const validAddress =
          '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

        await clientWithAutoOptIn.fetchQuote({
          fromASAID: 0,
          toASAID: 31566704,
          amount: 1_000_000,
          optIn: false, // Explicitly set to false
          address: validAddress,
        })

        const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
        expect(callUrl).toContain('optIn=false')
        // Should NOT call needsAssetOptIn when optIn is explicitly provided
        expect(mockGetInfo).not.toHaveBeenCalled()
      })
    })
  })

  describe('needsAssetOptIn', () => {
    let client: DeflexClient

    beforeEach(() => {
      client = new DeflexClient(validConfig)
    })

    it('should return false for ALGO (asset ID 0)', async () => {
      const mockAlgorand = AlgorandClient.fromConfig({
        algodConfig: { server: '', port: 443, token: '' },
      })
      mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
        assets: [],
      })
      ;(client as any).algorand = mockAlgorand

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'
      const result = await client.needsAssetOptIn(validAddress, 0)

      expect(result).toBe(false)
    })

    it('should return true when asset is not opted in', async () => {
      const mockAlgorand = AlgorandClient.fromConfig({
        algodConfig: { server: '', port: 443, token: '' },
      })
      mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
        assets: [],
      })
      ;(client as any).algorand = mockAlgorand

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'
      const result = await client.needsAssetOptIn(validAddress, 31566704)

      expect(result).toBe(true)
    })

    it('should return false when asset is already opted in', async () => {
      const mockAlgorand = AlgorandClient.fromConfig({
        algodConfig: { server: '', port: 443, token: '' },
      })
      mockAlgorand.account.getInformation = vi.fn().mockResolvedValue({
        assets: [{ assetId: BigInt(31566704), amount: BigInt(0) }],
      })
      ;(client as any).algorand = mockAlgorand

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'
      const result = await client.needsAssetOptIn(validAddress, 31566704)

      expect(result).toBe(false)
    })
  })

  describe('fetchSwapTransactions', () => {
    let client: DeflexClient
    let mockRequest: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      client = new DeflexClient(validConfig)
      const requestModule = vi.mocked(await import('../src/utils'), {
        partial: true,
      })
      mockRequest = requestModule.request as ReturnType<typeof vi.fn>
      mockRequest.mockClear()
    })

    it('should fetch swap transactions', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      const mockSwapResponse: FetchSwapTxnsResponse = {
        txns: [],
      }

      mockRequest.mockResolvedValue(mockSwapResponse)

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

      const result = await client.fetchSwapTransactions({
        quote: mockQuote as FetchQuoteResponse,
        address: validAddress,
        slippage: 1.0,
      })

      expect(result).toEqual(mockSwapResponse)
      expect(mockRequest).toHaveBeenCalledOnce()

      const [url, options] = mockRequest.mock.calls?.[0] as
        | [string, RequestInit]
        | []
      expect(url).toContain('fetchExecuteSwapTxns')
      expect(options?.method).toBe('POST')
      expect(options?.headers).toEqual({ 'Content-Type': 'application/json' })

      const body = JSON.parse(options?.body as string)
      expect(body.address).toBe(validAddress)
      expect(body.slippage).toBe(1.0)
      expect(body.txnPayloadJSON).toEqual(mockQuote.txnPayload)
    })

    it('should throw error for invalid Algorand address', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      await expect(
        client.fetchSwapTransactions({
          quote: mockQuote as FetchQuoteResponse,
          address: 'invalid-address',
          slippage: 1.0,
        }),
      ).rejects.toThrow('Invalid Algorand address')
    })
  })

  describe('newQuote', () => {
    let client: DeflexClient
    let mockRequest: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      client = new DeflexClient(validConfig)
      const requestModule = vi.mocked(await import('../src/utils'), {
        partial: true,
      })
      mockRequest = requestModule.request as ReturnType<typeof vi.fn>
      mockRequest.mockClear()
    })

    it('should return a QuoteResult plain object', async () => {
      const mockQuoteResponse: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '5000000',
        type: 'fixed-input',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
        profit: {
          amount: 100,
          asa: {
            id: 0,
            decimals: 6,
            unit_name: 'ALGO',
            name: 'Algorand',
            price_algo: 1,
            price_usd: 0.2,
          },
        },
        priceBaseline: 5.0,
        usdIn: 0.2,
        usdOut: 1.0,
        flattenedRoute: {},
        quotes: [],
        protocolFees: {},
      }

      mockRequest.mockResolvedValue(mockQuoteResponse)

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

      const quote = await client.newQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
        address: validAddress,
      })

      // Check it's a plain object, not a class instance
      expect(Object.getPrototypeOf(quote)).toBe(Object.prototype)
      expect(quote.quote).toBe(5000000n)
      expect(quote.amount).toBe(1000000n)
      expect(quote.address).toBe(validAddress)
      expect(quote.fromASAID).toBe(0)
      expect(quote.toASAID).toBe(31566704)
      expect(typeof quote.createdAt).toBe('number')

      // Check that all API response properties are present
      expect(quote.profit).toEqual(mockQuoteResponse.profit)
      expect(quote.priceBaseline).toBe(5.0)
    })

    it('should handle BigInt values for asset IDs and amounts', async () => {
      const mockQuoteResponse: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '5000000',
        type: 'fixed-input',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuoteResponse)

      const quote = await client.newQuote({
        fromASAID: 0n,
        toASAID: 31566704n,
        amount: 1_000_000n,
      })

      expect(Object.getPrototypeOf(quote)).toBe(Object.prototype)
      expect(quote.amount).toBe(1000000n)
    })

    it('should use consistent API naming', async () => {
      const mockQuoteResponse: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '5000000',
        type: 'fixed-input',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      mockRequest.mockResolvedValue(mockQuoteResponse)

      await client.newQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
      })

      const callUrl = mockRequest.mock.calls?.[0]?.[0] as string
      expect(callUrl).toContain('fromASAID=0')
      expect(callUrl).toContain('toASAID=31566704')
    })
  })

  describe('newSwap', () => {
    let client: DeflexClient
    let mockRequest: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      client = new DeflexClient(validConfig)
      const requestModule = vi.mocked(await import('../src/utils'), {
        partial: true,
      })
      mockRequest = requestModule.request as ReturnType<typeof vi.fn>
      mockRequest.mockClear()
    })

    it('should create a SwapComposer instance from FetchQuoteResponse', async () => {
      const mockQuote: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

      const mockTransaction =
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
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

      const mockSwapResponse: FetchSwapTxnsResponse = {
        txns: [
          {
            data: Buffer.from(
              algosdk.encodeUnsignedTransaction(mockTransaction),
            ).toString('base64'),
            group: '',
            logicSigBlob: false,
            signature: false,
          },
        ],
      }

      mockRequest.mockResolvedValue(mockSwapResponse)

      const composer = await client.newSwap({
        quote: mockQuote as FetchQuoteResponse,
        address: validAddress,
        slippage: 1.0,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer).toBeDefined()
      expect(typeof composer.getStatus).toBe('function')
      expect(typeof composer.count).toBe('function')
      expect(typeof composer.addTransaction).toBe('function')
      expect(typeof composer.addSwapTransactions).toBe('function')
    })

    it('should create a SwapComposer instance from QuoteResult', async () => {
      const mockQuoteResponse: Partial<FetchQuoteResponse> = {
        fromASAID: 0,
        toASAID: 31566704,
        quote: '1000000',
        type: 'fixed-input',
        route: [],
        txnPayload: { iv: 'test-iv', data: 'test-data' },
        requiredAppOptIns: [],
      }

      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'

      // Mock the newQuote call to return QuoteResult
      mockRequest.mockResolvedValueOnce(mockQuoteResponse)

      const quoteResult = await client.newQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
        address: validAddress,
      })

      const mockTransaction =
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
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

      const mockSwapResponse: FetchSwapTxnsResponse = {
        txns: [
          {
            data: Buffer.from(
              algosdk.encodeUnsignedTransaction(mockTransaction),
            ).toString('base64'),
            group: '',
            logicSigBlob: false,
            signature: false,
          },
        ],
      }

      mockRequest.mockResolvedValueOnce(mockSwapResponse)

      const composer = await client.newSwap({
        quote: quoteResult,
        address: validAddress,
        slippage: 1.0,
        signer: async (txns: algosdk.Transaction[]) =>
          txns.map(() => new Uint8Array(0)),
      })

      expect(composer).toBeDefined()
      expect(typeof composer.getStatus).toBe('function')
    })
  })
})
