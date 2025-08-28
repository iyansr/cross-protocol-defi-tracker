"use client";

import type { NextPage } from "next";
import { useAaveClientPositions } from "~~/services/aave/hooks";
import { useUniswapPositions } from "~~/services/uniswap/positions";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useWalletStore, useSyncConnectedWallet } from "~~/services/store/walletStore";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [newWalletAddress, setNewWalletAddress] = useState<string>("");
  const [newWalletLabel, setNewWalletLabel] = useState<string>("");

  const { wallets, activeWallet, addWallet, removeWallet, setActiveWallet } = useWalletStore();

  // Sync connected wallet with store
  useSyncConnectedWallet(connectedAddress);

  // Use active wallet from store, fallback to connected wallet, then empty string
  const targetAddress = activeWallet || connectedAddress || "";

  const { data: uniswapData } = useUniswapPositions(targetAddress);
  const { data: aaveData } = useAaveClientPositions(targetAddress);

  // Calculate combined portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const uniswapValue = uniswapData?.totalPortfolioValueUSD || 0;
    const aaveValue = aaveData?.metrics && "netValueUsd" in aaveData.metrics ? aaveData.metrics.netValueUsd : 0;
    const totalValue = uniswapValue + aaveValue;

    const uniswapYield = uniswapData?.yield24h || 0;
    const aaveSupplyAPY = aaveData?.metrics && "avgSupplyAPY" in aaveData.metrics ? aaveData.metrics.avgSupplyAPY : 0;
    const aaveCollateral =
      aaveData?.metrics && "totalCollateralUsd" in aaveData.metrics ? aaveData.metrics.totalCollateralUsd : 0;
    const aaveYield = (aaveSupplyAPY * aaveCollateral) / 365 / 100;
    const totalYield = uniswapYield + aaveYield;

    const uniswapAPY = uniswapData?.averageAPY || 0;
    const aaveAPY = aaveSupplyAPY;
    const weightedAPY = totalValue > 0 ? (uniswapAPY * uniswapValue + aaveAPY * aaveValue) / totalValue : 0;

    const uniswapPositions = uniswapData?.positions?.length || 0;
    const aavePositions = aaveData?.positions?.filter(p => p.suppliedUsd > 0 || p.borrowedUsd > 0)?.length || 0;
    const totalPositions = uniswapPositions + aavePositions;

    return {
      totalValue,
      totalYield,
      weightedAPY,
      totalPositions,
    };
  }, [uniswapData, aaveData]);

  return (
    <section className="container mx-auto py-8 px-4">
      <div>
        <h1 className="text-3xl font-bold text-primary-content">Portfolio Overview</h1>
        <p className="text-secondary-content mt-1">Monitor your DeFi positions across multiple protocols</p>
      </div>

      {/* Wallet Management */}

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="card-body">
          <h2 className="card-title text-lg">Wallet Management</h2>

          {/* Add New Wallet */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Add New Wallet</span>
            </label>
            <div className="flex gap-2 flex-col md:flex-row">
              <input
                type="text"
                placeholder="Enter wallet address (0x...)"
                className="input input-bordered md:flex-1"
                value={newWalletAddress}
                onChange={e => setNewWalletAddress(e.target.value)}
              />
              <input
                type="text"
                placeholder="Label (optional)"
                className="input input-bordered md:flex-1"
                value={newWalletLabel}
                onChange={e => setNewWalletLabel(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (newWalletAddress.trim()) {
                    addWallet(newWalletAddress.trim(), newWalletLabel.trim() || undefined);
                    setNewWalletAddress("");
                    setNewWalletLabel("");
                  }
                }}
                disabled={!newWalletAddress.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {/* Wallet Selector */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Select Active Wallet</span>
            </label>
            <div className="flex gap-2 md:flex-row flex-col">
              <select
                className="select select-bordered md:flex-1"
                value={activeWallet || ""}
                onChange={e => setActiveWallet(e.target.value || null)}
              >
                <option value="">Select a wallet...</option>
                {connectedAddress && (
                  <option value={connectedAddress}>
                    🟢 Connected: {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                  </option>
                )}
                {wallets
                  .filter(w => w.address.toLowerCase() !== connectedAddress?.toLowerCase())
                  .map(wallet => (
                    <option key={wallet.address} value={wallet.address}>
                      {wallet.label}: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </option>
                  ))}
              </select>
              {connectedAddress && (
                <button className="btn btn-outline" onClick={() => setActiveWallet(connectedAddress)}>
                  Use Connected
                </button>
              )}
            </div>
          </div>

          {/* Saved Wallets List */}
          {wallets.length > 0 && (
            <div className="mt-4">
              <label className="label">
                <span className="label-text">Saved Wallets</span>
              </label>
              <div className="space-y-2">
                {wallets.map(wallet => (
                  <div key={wallet.address} className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div className="flex items-center gap-2">
                      {wallet.isConnected && <span className="text-success">🟢</span>}
                      <span className="font-medium">{wallet.label}</span>
                      <span className="text-sm opacity-60">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-xs btn-outline" onClick={() => setActiveWallet(wallet.address)}>
                        Select
                      </button>
                      <button className="btn btn-xs btn-error btn-outline" onClick={() => removeWallet(wallet.address)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="label">
            <span className="label-text-alt">
              {targetAddress ? (
                <>
                  Currently viewing: {targetAddress.slice(0, 6)}...{targetAddress.slice(-4)}
                </>
              ) : (
                "No wallet selected"
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 grid-cols-2 gap-4 mt-12">
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Total Portfolio Value</h2>
            <p className="text-2xl font-bold">
              $
              {portfolioMetrics.totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">24h Yield</h2>
            <p className="text-2xl font-bold">
              $
              {portfolioMetrics.totalYield.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Average APY</h2>
            <p className="text-2xl font-bold">{portfolioMetrics.weightedAPY.toFixed(2)}%</p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Active Positions</h2>
            <p className="text-2xl font-bold">{portfolioMetrics.totalPositions}</p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h1 className="text-3xl font-bold text-primary-content">Protocol Positions</h1>
        <p className="text-secondary-content mt-1">Monitor your DeFi positions across multiple protocols</p>
      </div>

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="card-body">
          {/* DaisyUI Tabs */}
          <div className="tabs tabs-lifted">
            <input type="radio" name="protocol_tabs" className="tab" aria-label="Uniswap" defaultChecked />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-b border-base-200/20">
                      <th>Asset/Pair</th>
                      <th>Value</th>
                      <th>24h Yield</th>
                      <th>7d Yield</th>
                      <th>APY</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniswapData?.positions?.map((position, index) => (
                      <tr key={index} className="hover:bg-base-200/50">
                        <td className="font-medium">{position.assetName}</td>
                        <td>
                          $
                          {position.usdValue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-success">
                          $
                          {position.yield24h.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-success">
                          $
                          {position.yield7d.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>{position.apyPercentage.toFixed(2)}%</td>
                        <td>
                          <div className={`badge ${position.status === "active" ? "badge-success" : "badge-warning"}`}>
                            {position.status}
                          </div>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={6} className="text-center text-base-content/60">
                          No Uniswap positions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <input type="radio" name="protocol_tabs" className="tab" aria-label="AAVE" />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-b border-base-200/20">
                      <th>Asset</th>
                      <th>Supplied</th>
                      <th>Borrowed</th>
                      <th>Supply APY</th>
                      <th>Borrow APY</th>
                      <th>Net Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aaveData?.positions
                      ?.filter(position => position.suppliedUsd > 0 || position.borrowedUsd > 0)
                      .map((position, index) => (
                        <tr key={index} className="hover:bg-base-200/50">
                          <td className="font-medium">{position.symbol}</td>
                          <td className="text-success">
                            $
                            {position.suppliedUsd.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-error">
                            $
                            {position.borrowedUsd.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-success">{position.supplyAPY.toFixed(2)}%</td>
                          <td className="text-error">{position.borrowAPY.toFixed(2)}%</td>
                          <td
                            className={position.suppliedUsd - position.borrowedUsd >= 0 ? "text-success" : "text-error"}
                          >
                            $
                            {(position.suppliedUsd - position.borrowedUsd).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      )) || (
                      <tr>
                        <td colSpan={6} className="text-center text-base-content/60">
                          No AAVE positions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
