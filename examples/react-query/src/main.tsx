import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  WalletId,
  WalletManager,
  WalletProvider,
} from '@txnlab/use-wallet-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const walletManager = new WalletManager({
  wallets: [WalletId.DEFLY, WalletId.PERA, WalletId.LUTE],
  defaultNetwork: 'mainnet',
  options: {
    resetNetwork: true,
  },
})

const queryClient = new QueryClient()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WalletProvider manager={walletManager}>
        <App />
      </WalletProvider>
    </QueryClientProvider>
  </StrictMode>,
)
