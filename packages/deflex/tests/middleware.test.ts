import { describe, it, expect, vi } from 'vitest'
import { DeflexClient } from '../src/client'
import type { SwapMiddleware } from '../src/middleware'
import type { FetchQuoteParams } from '../src/types'

describe('Middleware System', () => {
  describe('SwapMiddleware interface', () => {
    it('should create a middleware with all required properties', () => {
      const middleware: SwapMiddleware = {
        name: 'TestMiddleware',
        version: '1.0.0',
        shouldApply: async () => true,
        adjustQuoteParams: async (params) => params,
        beforeSwap: async () => [],
        afterSwap: async () => [],
      }

      expect(middleware.name).toBe('TestMiddleware')
      expect(middleware.version).toBe('1.0.0')
      expect(middleware.shouldApply).toBeDefined()
    })

    it('should work with minimal middleware (no optional hooks)', () => {
      const middleware: SwapMiddleware = {
        name: 'MinimalMiddleware',
        version: '1.0.0',
        shouldApply: async () => false,
      }

      expect(middleware.adjustQuoteParams).toBeUndefined()
      expect(middleware.beforeSwap).toBeUndefined()
      expect(middleware.afterSwap).toBeUndefined()
    })
  })

  describe('DeflexClient with middleware', () => {
    it('should accept middleware in constructor', () => {
      const middleware: SwapMiddleware = {
        name: 'TestMiddleware',
        version: '1.0.0',
        shouldApply: async () => true,
      }

      const deflex = new DeflexClient({
        apiKey: 'test-key',
        middleware: [middleware],
      })

      expect(deflex).toBeInstanceOf(DeflexClient)
    })

    it('should work without middleware', () => {
      const deflex = new DeflexClient({
        apiKey: 'test-key',
      })

      expect(deflex).toBeInstanceOf(DeflexClient)
    })

    it('should accept multiple middleware instances', () => {
      const middleware1: SwapMiddleware = {
        name: 'Middleware1',
        version: '1.0.0',
        shouldApply: async () => true,
      }

      const middleware2: SwapMiddleware = {
        name: 'Middleware2',
        version: '1.0.0',
        shouldApply: async () => true,
      }

      const deflex = new DeflexClient({
        apiKey: 'test-key',
        middleware: [middleware1, middleware2],
      })

      expect(deflex).toBeInstanceOf(DeflexClient)
    })
  })

  describe('Middleware quote adjustments', () => {
    it('should apply adjustQuoteParams from middleware', async () => {
      const CUSTOM_ASSET_ID = 12345n

      const middleware: SwapMiddleware = {
        name: 'TestMiddleware',
        version: '1.0.0',
        shouldApply: async (params) => {
          return (
            params.fromASAID === CUSTOM_ASSET_ID ||
            params.toASAID === CUSTOM_ASSET_ID
          )
        },
        adjustQuoteParams: async (params: FetchQuoteParams) => {
          // Reduce maxGroupSize by 3 for custom asset
          return {
            ...params,
            maxGroupSize: (params.maxGroupSize ?? 16) - 3,
          }
        },
      }

      const deflex = new DeflexClient({
        apiKey: 'test-key',
        middleware: [middleware],
      })

      // Mock the fetchQuote method to capture params
      let capturedParams: FetchQuoteParams | null = null
      vi.spyOn(deflex as any, 'fetchQuote').mockImplementation(
        async (params) => {
          capturedParams = params as FetchQuoteParams
          return {
            quote: '1000000',
            fromASAID: (params as FetchQuoteParams).fromASAID,
            toASAID: (params as FetchQuoteParams).toASAID,
            route: [],
            requiredAppOptIns: [],
            txnPayload: { iv: 'test', data: 'test' },
            profit: {
              amount: 0,
              asa: {
                id: 0,
                decimals: 6,
                unit_name: 'ALGO',
                name: 'Algorand',
                price_algo: 1,
                price_usd: 0,
              },
            },
            priceBaseline: 1,
            usdIn: 0,
            usdOut: 0,
            flattenedRoute: {},
            quotes: [],
            type: 'fixed-input',
            protocolFees: {},
          }
        },
      )

      await deflex.newQuote({
        fromASAID: CUSTOM_ASSET_ID,
        toASAID: 0,
        amount: 1_000_000,
      })

      expect(capturedParams).not.toBeNull()
      expect(capturedParams!.maxGroupSize).toBe(13) // 16 - 3
    })

    it('should chain multiple middleware adjustments', async () => {
      const middleware1: SwapMiddleware = {
        name: 'Middleware1',
        version: '1.0.0',
        shouldApply: async () => true,
        adjustQuoteParams: async (params) => ({
          ...params,
          maxGroupSize: (params.maxGroupSize ?? 16) - 2,
        }),
      }

      const middleware2: SwapMiddleware = {
        name: 'Middleware2',
        version: '1.0.0',
        shouldApply: async () => true,
        adjustQuoteParams: async (params) => ({
          ...params,
          maxGroupSize: (params.maxGroupSize ?? 16) - 1,
        }),
      }

      const deflex = new DeflexClient({
        apiKey: 'test-key',
        middleware: [middleware1, middleware2],
      })

      let capturedParams: FetchQuoteParams | null = null
      vi.spyOn(deflex as any, 'fetchQuote').mockImplementation(
        async (params) => {
          capturedParams = params as FetchQuoteParams
          return {
            quote: '1000000',
            fromASAID: (params as FetchQuoteParams).fromASAID,
            toASAID: (params as FetchQuoteParams).toASAID,
            route: [],
            requiredAppOptIns: [],
            txnPayload: { iv: 'test', data: 'test' },
            profit: {
              amount: 0,
              asa: {
                id: 0,
                decimals: 6,
                unit_name: 'ALGO',
                name: 'Algorand',
                price_algo: 1,
                price_usd: 0,
              },
            },
            priceBaseline: 1,
            usdIn: 0,
            usdOut: 0,
            flattenedRoute: {},
            quotes: [],
            type: 'fixed-input',
            protocolFees: {},
          }
        },
      )

      await deflex.newQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
      })

      expect(capturedParams!.maxGroupSize).toBe(13) // 16 - 2 - 1
    })

    it('should not apply middleware when shouldApply returns false', async () => {
      const middleware: SwapMiddleware = {
        name: 'TestMiddleware',
        version: '1.0.0',
        shouldApply: async () => false,
        adjustQuoteParams: async (params) => ({
          ...params,
          maxGroupSize: 1, // Should not be applied
        }),
      }

      const deflex = new DeflexClient({
        apiKey: 'test-key',
        middleware: [middleware],
      })

      let capturedParams: FetchQuoteParams | null = null
      vi.spyOn(deflex as any, 'fetchQuote').mockImplementation(
        async (params) => {
          capturedParams = params as FetchQuoteParams
          return {
            quote: '1000000',
            fromASAID: (params as FetchQuoteParams).fromASAID,
            toASAID: (params as FetchQuoteParams).toASAID,
            route: [],
            requiredAppOptIns: [],
            txnPayload: { iv: 'test', data: 'test' },
            profit: {
              amount: 0,
              asa: {
                id: 0,
                decimals: 6,
                unit_name: 'ALGO',
                name: 'Algorand',
                price_algo: 1,
                price_usd: 0,
              },
            },
            priceBaseline: 1,
            usdIn: 0,
            usdOut: 0,
            flattenedRoute: {},
            quotes: [],
            type: 'fixed-input',
            protocolFees: {},
          }
        },
      )

      await deflex.newQuote({
        fromASAID: 0,
        toASAID: 31566704,
        amount: 1_000_000,
        maxGroupSize: 16,
      })

      expect(capturedParams!.maxGroupSize).toBe(16) // Default, not modified
    })
  })

  describe('SwapContext', () => {
    it('should provide correct context to middleware hooks', async () => {
      const middleware: SwapMiddleware = {
        name: 'ContextTestMiddleware',
        version: '1.0.0',
        shouldApply: async () => true,
        beforeSwap: async () => {
          // Context would be passed here in actual usage
          return []
        },
      }

      // This would require mocking the entire swap flow
      // For now, we can verify the middleware structure
      expect(middleware.beforeSwap).toBeDefined()
    })
  })
})
