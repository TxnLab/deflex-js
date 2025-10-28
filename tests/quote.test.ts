import { describe, it, expect } from 'vitest'
import { DeflexQuote } from '../src/quote'
import type { FetchQuoteResponse } from '../src/types'

describe('DeflexQuote', () => {
  const mockQuoteResponse: FetchQuoteResponse = {
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
    userPriceImpact: 0.05,
    marketPriceImpact: 0.1,
    usdIn: 0.2,
    usdOut: 1.0,
    flattenedRoute: { 'TinymanV2-0.03': 100 },
    quotes: [
      {
        name: 'TinymanV2-0.03',
        class: 'TinymanV2',
        value: 5000000,
      },
    ],
    protocolFees: { 'TinymanV2-0.03': 1500 },
    timing: {},
  }

  describe('constructor', () => {
    it('should create a DeflexQuote instance with valid config', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
        address: '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM',
      })

      expect(quote).toBeInstanceOf(DeflexQuote)
    })

    it('should throw error when response is missing', () => {
      expect(
        () =>
          new DeflexQuote({
            response: undefined as any,
            amount: 1_000_000,
          }),
      ).toThrow('Quote response is required')
    })

    it('should throw error when amount is missing', () => {
      expect(
        () =>
          new DeflexQuote({
            response: mockQuoteResponse,
            amount: undefined as any,
          }),
      ).toThrow('Amount is required')
    })

    it('should accept amount as number', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.amount).toBe(1000000n)
    })

    it('should accept amount as bigint', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000n,
      })

      expect(quote.amount).toBe(1000000n)
    })

    it('should work without address', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.address).toBeUndefined()
    })
  })

  describe('metadata properties', () => {
    it('should return the original amount', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.amount).toBe(1000000n)
    })

    it('should return the address if provided', () => {
      const validAddress =
        '5BPCE3UNCPAIONAOMY4CVUXNU27SOCXYE4QSXEQFYXV6ORFQIKVTOR6ZTM'
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
        address: validAddress,
      })

      expect(quote.address).toBe(validAddress)
    })

    it('should return createdAt timestamp', () => {
      const beforeCreate = Date.now()
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })
      const afterCreate = Date.now()

      expect(quote.createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(quote.createdAt).toBeLessThanOrEqual(afterCreate)
    })

    it('should return the raw response', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.response).toEqual(mockQuoteResponse)
    })
  })

  describe('quote response properties', () => {
    it('should return quote as bigint', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.quote).toBe(5000000n)
    })

    it('should handle empty string quote as 0n', () => {
      const quote = new DeflexQuote({
        response: { ...mockQuoteResponse, quote: '' },
        amount: 1_000_000,
      })

      expect(quote.quote).toBe(0n)
    })

    it('should handle numeric quote', () => {
      const quote = new DeflexQuote({
        response: { ...mockQuoteResponse, quote: 5000000 },
        amount: 1_000_000,
      })

      expect(quote.quote).toBe(5000000n)
    })

    it('should expose all response properties via getters', () => {
      const quote = new DeflexQuote({
        response: mockQuoteResponse,
        amount: 1_000_000,
      })

      expect(quote.fromAssetId).toBe(0)
      expect(quote.toAssetId).toBe(31566704)
      expect(quote.type).toBe('fixed-input')
      expect(quote.profit).toEqual(mockQuoteResponse.profit)
      expect(quote.priceBaseline).toBe(5.0)
      expect(quote.userPriceImpact).toBe(0.05)
      expect(quote.marketPriceImpact).toBe(0.1)
      expect(quote.usdIn).toBe(0.2)
      expect(quote.usdOut).toBe(1.0)
      expect(quote.route).toEqual([])
      expect(quote.flattenedRoute).toEqual({ 'TinymanV2-0.03': 100 })
      expect(quote.quotes).toEqual(mockQuoteResponse.quotes)
      expect(quote.requiredAppOptIns).toEqual([])
      expect(quote.txnPayload).toEqual({
        iv: 'test-iv',
        data: 'test-data',
      })
      expect(quote.protocolFees).toEqual({ 'TinymanV2-0.03': 1500 })
      expect(quote.timing).toEqual({})
    })

    it('should handle optional properties', () => {
      const quoteWithoutOptionals = new DeflexQuote({
        response: {
          ...mockQuoteResponse,
          userPriceImpact: undefined,
          marketPriceImpact: undefined,
          timing: undefined,
        },
        amount: 1_000_000,
      })

      expect(quoteWithoutOptionals.userPriceImpact).toBeUndefined()
      expect(quoteWithoutOptionals.marketPriceImpact).toBeUndefined()
      expect(quoteWithoutOptionals.timing).toBeUndefined()
    })
  })

  describe('getSlippageAmount', () => {
    describe('fixed-input swaps', () => {
      it('should calculate minimum output with 1% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-input',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(1)
        // 1% slippage = 100 basis points
        // 1000000 * (10000 - 100) / 10000 = 990000
        expect(result).toBe(990000n)
      })

      it('should calculate minimum output with 0.5% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-input',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(0.5)
        // 0.5% slippage = 50 basis points
        // 1000000 * (10000 - 50) / 10000 = 995000
        expect(result).toBe(995000n)
      })

      it('should calculate minimum output with 5% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-input',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(5)
        // 5% slippage = 500 basis points
        // 1000000 * (10000 - 500) / 10000 = 950000
        expect(result).toBe(950000n)
      })

      it('should handle large quote amounts', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '10000000000',
            type: 'fixed-input',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(1)
        // 10000000000 * (10000 - 100) / 10000 = 9900000000
        expect(result).toBe(9900000000n)
      })
    })

    describe('fixed-output swaps', () => {
      it('should calculate maximum input with 1% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-output',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(1)
        // 1% slippage = 100 basis points
        // 1000000 * (10000 + 100) / 10000 = 1010000
        expect(result).toBe(1010000n)
      })

      it('should calculate maximum input with 0.5% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-output',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(0.5)
        // 0.5% slippage = 50 basis points
        // 1000000 * (10000 + 50) / 10000 = 1005000
        expect(result).toBe(1005000n)
      })

      it('should calculate maximum input with 5% slippage', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '1000000',
            type: 'fixed-output',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(5)
        // 5% slippage = 500 basis points
        // 1000000 * (10000 + 500) / 10000 = 1050000
        expect(result).toBe(1050000n)
      })

      it('should handle large quote amounts', () => {
        const quote = new DeflexQuote({
          response: {
            ...mockQuoteResponse,
            quote: '10000000000',
            type: 'fixed-output',
          },
          amount: 1_000_000,
        })

        const result = quote.getSlippageAmount(1)
        // 10000000000 * (10000 + 100) / 10000 = 10100000000
        expect(result).toBe(10100000000n)
      })
    })

    it('should handle fractional slippage percentages', () => {
      const quote = new DeflexQuote({
        response: {
          ...mockQuoteResponse,
          quote: '1000000',
          type: 'fixed-input',
        },
        amount: 1_000_000,
      })

      const result = quote.getSlippageAmount(1.25)
      // 1.25% slippage = 125 basis points
      // 1000000 * (10000 - 125) / 10000 = 987500
      expect(result).toBe(987500n)
    })
  })
})
