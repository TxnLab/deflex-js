import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  WalletId,
  WalletManager,
  WalletProvider,
} from '@txnlab/use-wallet-react'
import App from './App'
import './index.css'

const walletManager = new WalletManager({
  wallets: [WalletId.DEFLY, WalletId.PERA, WalletId.LUTE],
  defaultNetwork: 'mainnet',
  options: {
    resetNetwork: true,
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

createRoot(rootElement).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </StrictMode>,
)
