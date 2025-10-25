/**
 * Supported DEX protocols for routing
 */
export enum Protocol {
  TinymanV2 = 'TinymanV2',
  Algofi = 'Algofi',
  Algomint = 'Algomint',
  Pact = 'Pact',
  Folks = 'Folks',
  TAlgo = 'TAlgo',
}

/**
 * Deprecated protocols that are always disabled internally
 * @internal
 */
export const DEPRECATED_PROTOCOLS = ['Humble', 'Tinyman'] as const

/**
 * Default Algod node URI
 */
export const DEFAULT_ALGOD_URI = 'https://mainnet-api.4160.nodely.dev/'

/**
 * Default Algod node token
 */
export const DEFAULT_ALGOD_TOKEN = ''

/**
 * Default Algod node port
 */
export const DEFAULT_ALGOD_PORT = 443

/**
 * Default Deflex API base URL
 */
export const DEFAULT_API_BASE_URL = 'https://deflex.txnlab.dev/api'

/**
 * Default fee in basis points (0.15%)
 */
export const DEFAULT_FEE_BPS = 15

/**
 * Maximum fee in basis points (3.00%)
 */
export const MAX_FEE_BPS = 300

/**
 * Default maximum transaction group size
 */
export const DEFAULT_MAX_GROUP_SIZE = 16

/**
 * Default maximum routing depth
 */
export const DEFAULT_MAX_DEPTH = 4

/**
 * Default atomic-only setting
 */
export const DEFAULT_ATOMIC_ONLY = true

/**
 * Default auto opt-in setting
 */
export const DEFAULT_AUTO_OPT_IN = false
