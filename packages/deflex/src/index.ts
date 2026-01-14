// Deprecation warning - must be first to execute on import
if (typeof console !== 'undefined' && console.warn) {
  console.warn(
    '\n' +
      '╔═══════════════════════════════════════════════════════════════╗\n' +
      '║  ⚠️  DEPRECATION WARNING                                      ║\n' +
      '║                                                               ║\n' +
      '║  @txnlab/deflex has been renamed to @txnlab/haystack-router  ║\n' +
      '║  This package will no longer receive updates.                ║\n' +
      '║                                                               ║\n' +
      '║  Migrate: npm install @txnlab/haystack-router                ║\n' +
      '║  Guide: github.com/TxnLab/haystack-js#migration              ║\n' +
      '╚═══════════════════════════════════════════════════════════════╝\n',
  )
}

export * from './client'
export * from './composer'
export * from './constants'
export * from './middleware'
export * from './types'
export * from './utils'
