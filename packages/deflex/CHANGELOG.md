# 1.0.0 (2025-10-31)


### Features

* add configurable apiBaseUrl option to DeflexClient ([606ff97](https://github.com/TxnLab/deflex-js/commit/606ff97f0efce1ba45d4ae537f7f24b08608ef91))
* add React Query example with automatic quote fetching ([2264d09](https://github.com/TxnLab/deflex-js/commit/2264d0916eb67f75d2286b935e8d9fa81a1c4e4e))
* add DeflexQuote wrapper class with convenience methods ([e9dcfd6](https://github.com/TxnLab/deflex-js/commit/e9dcfd6629b3a9003ecc74746ed00e9d9e1d08df))
* add runtime validation for SwapComposer required parameters ([689b538](https://github.com/TxnLab/deflex-js/commit/689b53814a8b6a8f1d239e4699548295a3526cf7))
* replace signSwap with SwapComposer and newSwap factory ([90b97bb](https://github.com/TxnLab/deflex-js/commit/90b97bbf5d3cbaf57597af32670114ff46300b36))
* add automatic asset opt-in detection and handling ([13a1ed7](https://github.com/TxnLab/deflex-js/commit/13a1ed75798758c81ae78d0c8805b06a0e2a3923))
* add swap transaction signing functionality ([3721ee2](https://github.com/TxnLab/deflex-js/commit/3721ee272a71aafd94d298dd41e24222d26f9474))
* add DeflexClient and implement quote fetching ([0ca3ad6](https://github.com/TxnLab/deflex-js/commit/0ca3ad629df102f87d7a767b55c42746de716d7d))


### Bug Fixes

* correct pnpm script references in release workflow ([8f7acad](https://github.com/TxnLab/deflex-js/commit/8f7acad82f25f0f90b0ff9e6013968eaa091fe80))
* implement ARC-1 compliant transaction signing ([7771d6d](https://github.com/TxnLab/deflex-js/commit/7771d6daa18599ca09a8cacef7785666d3229836))
* only include optIn param when explicitly set as boolean ([dd245dc](https://github.com/TxnLab/deflex-js/commit/dd245dc6ed5b7c7a5bdbff2d2530ee5e19e36c81))
* accept null for address parameter in FetchQuoteParams ([44f4fae](https://github.com/TxnLab/deflex-js/commit/44f4fae6b5c808cd4d8e84538a8d9a56595d5854))
* improve fee validation error message with valid range ([9e1e7a1](https://github.com/TxnLab/deflex-js/commit/9e1e7a1d11d8c6d2dda9b19ba2af02b88fa5375a))
* update default auto opt-in setting to false ([fed18a4](https://github.com/TxnLab/deflex-js/commit/fed18a42d2a49a106dcc148ae98db4edf2ca5f9c))


### Code Refactoring

* move signer to SwapComposer configuration ([1bea32f](https://github.com/TxnLab/deflex-js/commit/1bea32fe07d58a7658851624c98f7cbc1d576d51))


### BREAKING CHANGES

* Signer must now be passed to `newSwap()` config instead
of to `sign()`, `submit()`, or `execute()` methods.
