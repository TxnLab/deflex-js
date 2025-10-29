import { useWallet, type Wallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

export const WalletMenu = () => {
  const { wallets, activeWallet } = useWallet()

  if (activeWallet) {
    return <ConnectedWallet wallet={activeWallet} />
  }

  return <WalletList wallets={wallets} />
}

const WalletList = ({ wallets }: { wallets: Wallet[] }) => {
  return (
    <div className="wallet-list">
      <h3>Connect Wallet</h3>
      <div className="wallet-options">
        {wallets.map((wallet) => (
          <WalletOption key={wallet.id} wallet={wallet} />
        ))}
      </div>
    </div>
  )
}

const WalletOption = ({ wallet }: { wallet: Wallet }) => {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="wallet-option"
    >
      <img
        src={wallet.metadata.icon}
        alt={wallet.metadata.name}
        width={24}
        height={24}
      />
      <span>
        {connecting ? 'Connecting...' : `Connect ${wallet.metadata.name}`}
      </span>
    </button>
  )
}

const ConnectedWallet = ({ wallet }: { wallet: Wallet }) => {
  return (
    <div className="connected-wallet">
      <div className="wallet-header">
        <img
          src={wallet.metadata.icon}
          alt={wallet.metadata.name}
          width={32}
          height={32}
        />
        <strong>{wallet.metadata.name}</strong>
      </div>

      {wallet.accounts.length > 1 && (
        <select
          value={wallet.activeAccount?.address}
          onChange={(e) => wallet.setActiveAccount(e.target.value)}
          className="account-select"
        >
          {wallet.accounts.map((account) => (
            <option key={account.address} value={account.address}>
              {account.address}
            </option>
          ))}
        </select>
      )}

      {wallet.activeAccount && (
        <div className="account-info">
          <p className="account-label">Active Account:</p>
          <p className="account-address">
            {wallet.activeAccount.address.slice(0, 8)}...
            {wallet.activeAccount.address.slice(-8)}
          </p>
        </div>
      )}

      <button onClick={wallet.disconnect} className="disconnect-button">
        Disconnect
      </button>
    </div>
  )
}
