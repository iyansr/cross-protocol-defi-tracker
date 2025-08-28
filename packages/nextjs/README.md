# Cross-Protocol Yield Tracker
A comprehensive DeFi portfolio management dashboard that aggregates and tracks yield-generating positions across multiple protocols including Uniswap V3 and Aave.

## 🎯 Project Overview

The Cross-Protocol Yield Tracker is an advanced dashboard application that provides users with a unified view of their DeFi positions across different protocols. It enables portfolio monitoring, yield tracking, and performance analysis in a single interface.

## 🏗️ Architecture & Approach


### Technical Stack

- **Frontend Framework**: Next.js 15 with React 19
- **Blockchain Integration**: Wagmi v2 + Viem for Ethereum interactions
- **Wallet Connection**: RainbowKit for seamless wallet connectivity
- **State Management**: Zustand for global state + TanStack Query for server state
- **Styling**: Tailwind CSS + DaisyUI components
- **Protocol SDKs**: 
  - Uniswap V3 SDK for AMM position calculations
  - Aave Client for lending protocol data
- **Data Fetching**: TanStack Query with optimized caching strategies

### Architecture Patterns

#### 1. **Service Layer Pattern**
Each protocol is encapsulated in its own service module:

```
services/
├── aave/
│   └── hooks.ts          # Aave position fetching & calculations
├── uniswap/
│   ├── positions.ts      # Uniswap V3 position management
│   ├── utils.ts          # Mathematical calculations for liquidity
│   └── abi.ts           # Smart contract ABIs
├── store/
│   └── walletStore.ts   # Multi-wallet management
└── web3/
    └── wagmiConfig.tsx  # Blockchain configuration
```

#### 2. **Data Aggregation Strategy**
The application implements a **unified data model** that normalizes data from different protocols:

- **Portfolio Metrics**: Aggregated values, yields, and APY calculations
- **Position Standardization**: Common interface for displaying positions regardless of protocol
- **Real-time Updates**: 30-second polling intervals with intelligent caching

#### 3. **Multi-Wallet Architecture**
Implements a sophisticated wallet management system:

- **Persistent Storage**: Zustand with localStorage persistence
- **Connected Wallet Sync**: Automatic detection and management of connected wallets
- **Multi-Address Tracking**: Users can monitor multiple addresses simultaneously
- **Wallet Labeling**: Custom labels for easy identification

## 🔧 Key Features & Implementation

### 1. **Protocol Integration**

#### Uniswap V3 Integration
- **Position Detection**: Automatically discovers all NFT positions owned by an address
- **Liquidity Calculations**: Uses Uniswap V3 SDK for precise token amount calculations
- **Range Status**: Determines if positions are in-range or out-of-range
- **Yield Tracking**: Calculates fees earned and projected APY
- **Price Data**: Integrates with CoinGecko API for USD valuations

#### Aave Integration
- **Supply/Borrow Positions**: Fetches both lending and borrowing positions
- **APY Calculations**: Real-time supply and borrow APY from Aave's rate model
- **Net Position Value**: Calculates net worth considering both assets and liabilities
- **Health Factor**: Monitors position safety and liquidation risk

### 2. **Advanced Portfolio Analytics**

```typescript
// Portfolio metrics calculation approach
const portfolioMetrics = useMemo(() => {
  const uniswapValue = uniswapData?.totalPortfolioValueUSD || 0;
  const aaveValue = aaveData?.metrics?.netValueUsd || 0;
  const totalValue = uniswapValue + aaveValue;
  
  // Weighted APY calculation across protocols
  const weightedAPY = totalValue > 0 
    ? (uniswapAPY * uniswapValue + aaveAPY * aaveValue) / totalValue 
    : 0;
    
  return { totalValue, totalYield, weightedAPY, totalPositions };
}, [uniswapData, aaveData]);
```

### 3. **Smart Contract Interactions**

#### Multicall Optimization
The application uses Wagmi's multicall functionality to batch multiple contract calls:

```typescript
// Efficient batch fetching of position data
const positionCalls = validTokenIds.map(tokenId => ({
  ...positionManagerContract,
  functionName: "positions",
  args: [tokenId],
}));

const positionResults = await multicall(wagmiConfig, {
  contracts: positionCalls,
});
```

#### Mathematical Precision
Implements precise mathematical calculations for DeFi operations:
- **BigInt Arithmetic**: Handles large numbers without precision loss
- **Tick Math**: Accurate price calculations using Uniswap's tick system
- **Liquidity Calculations**: Proper handling of concentrated liquidity positions

### 4. **User Experience Design**

#### Responsive Dashboard
- **Tabbed Interface**: Clean separation between different protocols
- **Real-time Updates**: Live data with loading states and error handling
- **Mobile Responsive**: Optimized for all device sizes

#### Wallet Management UX
- **One-Click Switching**: Easy switching between monitored addresses
- **Visual Indicators**: Clear indication of connected vs. saved wallets
- **Persistent Preferences**: User preferences saved across sessions

## 🚀 Performance Optimizations

### 1. **Caching Strategy**
- **TanStack Query**: 30-second stale time with 30-second garbage collection
- **Memoized Calculations**: Heavy computations cached with React.useMemo
- **Selective Re-renders**: Optimized component updates

### 2. **Network Efficiency**
- **Multicall Batching**: Reduces RPC calls by batching contract interactions
- **Conditional Fetching**: Only fetch data when addresses are available
- **Error Boundaries**: Graceful handling of network failures

### 3. **Code Splitting**
- **Protocol Services**: Lazy loading of protocol-specific code
- **Component Optimization**: Efficient bundle splitting

## 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📊 Data Flow Architecture

```
User Wallet Address
       ↓
┌─────────────────┐    ┌─────────────────┐
│   Uniswap V3    │    │      Aave       │
│   Service       │    │    Service      │
└─────────────────┘    └─────────────────┘
       ↓                        ↓
┌─────────────────────────────────────────┐
│         Portfolio Aggregator            │
│    (Unified Metrics Calculation)        │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│            Dashboard UI                 │
│   (Tabbed Interface + Analytics)        │
└─────────────────────────────────────────┘
```
