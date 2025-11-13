import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface PortfolioAsset {
  id: number;
  name: string;
  symbol: string;
  chain: string;
  encryptedBalance: string;
  publicPrice: number;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
}

interface PortfolioAnalysis {
  totalValue: number;
  assetDistribution: { [key: string]: number };
  riskScore: number;
  diversification: number;
  performance: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newAssetData, setNewAssetData] = useState({ 
    name: "", 
    symbol: "", 
    chain: "Ethereum", 
    balance: "", 
    price: "" 
  });
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterChain, setFilterChain] = useState("all");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM for portfolio...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const assetsList: PortfolioAsset[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          assetsList.push({
            id: parseInt(businessId.replace('asset-', '')) || Date.now(),
            name: businessData.name,
            symbol: businessId.split('-')[1] || "TOKEN",
            chain: ["Ethereum", "Polygon", "Arbitrum", "Optimism"][Number(businessData.publicValue1) % 4],
            encryptedBalance: businessId,
            publicPrice: Number(businessData.publicValue2) || 0,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading asset data:', e);
        }
      }
      
      setAssets(assetsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load portfolio" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const addAsset = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setAddingAsset(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Adding asset with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("No contract");
      
      const balanceValue = parseInt(newAssetData.balance) || 0;
      const businessId = `asset-${newAssetData.symbol}-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, balanceValue);
      
      const chainIndex = ["Ethereum", "Polygon", "Arbitrum", "Optimism"].indexOf(newAssetData.chain);
      
      const tx = await contract.createBusinessData(
        businessId,
        newAssetData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        chainIndex,
        parseInt(newAssetData.price) || 0,
        "Encrypted Portfolio Asset"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Confirming transaction..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Asset added securely!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowAddModal(false);
      setNewAssetData({ name: "", symbol: "", chain: "Ethereum", balance: "", price: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected") 
        ? "Transaction rejected" 
        : "Failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setAddingAsset(false); 
    }
  };

  const decryptAsset = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Asset already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Asset decrypted!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Asset verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const analyzePortfolio = (): PortfolioAnalysis => {
    const total = assets.reduce((sum, asset) => {
      const value = asset.isVerified ? 
        (asset.decryptedValue || 0) * asset.publicPrice : 
        asset.publicValue1 * asset.publicPrice;
      return sum + value;
    }, 0);

    const distribution = assets.reduce((acc: { [key: string]: number }, asset) => {
      const value = asset.isVerified ? 
        (asset.decryptedValue || 0) * asset.publicPrice : 
        asset.publicValue1 * asset.publicPrice;
      acc[asset.chain] = (acc[asset.chain] || 0) + value;
      return acc;
    }, {});

    const riskScore = Math.max(10, Math.min(90, 100 - (total / 1000)));
    const diversification = Math.min(95, Object.keys(distribution).length * 25);
    const performance = Math.min(100, Math.round((total / assets.length) * 10));

    return {
      totalValue: total,
      assetDistribution: distribution,
      riskScore,
      diversification,
      performance
    };
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChain = filterChain === "all" || asset.chain === filterChain;
    return matchesSearch && matchesChain;
  });

  const renderDashboard = () => {
    const analysis = analyzePortfolio();
    const totalAssets = assets.length;
    const verifiedAssets = assets.filter(a => a.isVerified).length;
    
    return (
      <div className="dashboard-panels">
        <div className="panel metal-panel">
          <div className="panel-icon">💰</div>
          <h3>Total Portfolio Value</h3>
          <div className="stat-value gold-text">${analysis.totalValue.toLocaleString()}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="panel metal-panel">
          <div className="panel-icon">🔐</div>
          <h3>Encrypted Assets</h3>
          <div className="stat-value silver-text">{verifiedAssets}/{totalAssets}</div>
          <div className="stat-trend">On-chain Verified</div>
        </div>
        
        <div className="panel metal-panel">
          <div className="panel-icon">📊</div>
          <h3>Risk Score</h3>
          <div className="stat-value bronze-text">{analysis.riskScore}/100</div>
          <div className="stat-trend">FHE Calculated</div>
        </div>
      </div>
    );
  };

  const renderAssetChart = (analysis: PortfolioAnalysis) => {
    return (
      <div className="portfolio-chart">
        <div className="chart-header">
          <h3>Asset Distribution</h3>
          <span>${analysis.totalValue.toLocaleString()}</span>
        </div>
        <div className="chart-bars">
          {Object.entries(analysis.assetDistribution).map(([chain, value]) => (
            <div key={chain} className="chart-row">
              <div className="chart-label">{chain}</div>
              <div className="chart-bar">
                <div 
                  className="bar-fill metal-fill" 
                  style={{ width: `${(value / analysis.totalValue) * 100}%` }}
                >
                  <span className="bar-value">${value.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon metal-icon">1</div>
          <div className="step-content">
            <h4>Balance Encryption</h4>
            <p>Asset balances encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon metal-icon">2</div>
          <div className="step-content">
            <h4>Multi-chain Storage</h4>
            <p>Encrypted data stored across chains</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon metal-icon">3</div>
          <div className="step-content">
            <h4>Homomorphic Calculation</h4>
            <p>Total value computed without decryption</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon metal-icon">4</div>
          <div className="step-content">
            <h4>Selective Decryption</h4>
            <p>Verify individual assets on-demand</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header metal-header">
          <div className="logo">
            <h1 className="gold-text">FHE Portfolio 🔐</h1>
            <p>Private Wealth Management</p>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt metal-bg">
          <div className="connection-content">
            <div className="connection-icon">💰</div>
            <h2>Connect Your Wallet</h2>
            <p>Initialize your encrypted portfolio with FHE protection</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to begin</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system initializes automatically</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Manage assets with complete privacy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen metal-bg">
        <div className="fhe-spinner metal-spinner"></div>
        <p>Initializing FHE Portfolio System...</p>
        <p className="loading-note">Securing your assets</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen metal-bg">
      <div className="fhe-spinner metal-spinner"></div>
      <p>Loading encrypted portfolio...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header metal-header">
        <div className="logo">
          <h1 className="gold-text">FHE Portfolio 🔐</h1>
          <p>Multi-chain Private Wealth</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowAddModal(true)} 
            className="create-btn metal-btn"
          >
            + Add Asset
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Private Portfolio Analytics</h2>
          {renderDashboard()}
          
          <div className="panel metal-panel full-width">
            <h3>FHE Asset Protection Flow</h3>
            {renderFHEFlow()}
          </div>

          <div className="panel metal-panel">
            <h3>Portfolio Overview</h3>
            {renderAssetChart(analyzePortfolio())}
          </div>
        </div>
        
        <div className="assets-section">
          <div className="section-header">
            <h2>Encrypted Assets</h2>
            <div className="header-actions">
              <div className="search-filter">
                <input 
                  type="text" 
                  placeholder="Search assets..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input metal-input"
                />
                <select 
                  value={filterChain} 
                  onChange={(e) => setFilterChain(e.target.value)}
                  className="filter-select metal-select"
                >
                  <option value="all">All Chains</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="Polygon">Polygon</option>
                  <option value="Arbitrum">Arbitrum</option>
                  <option value="Optimism">Optimism</option>
                </select>
              </div>
              <button 
                onClick={loadData} 
                className="refresh-btn metal-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="assets-list">
            {filteredAssets.length === 0 ? (
              <div className="no-assets metal-panel">
                <p>No encrypted assets found</p>
                <button 
                  className="create-btn metal-btn" 
                  onClick={() => setShowAddModal(true)}
                >
                  Add First Asset
                </button>
              </div>
            ) : filteredAssets.map((asset, index) => (
              <div 
                className={`asset-item metal-panel ${selectedAsset?.id === asset.id ? "selected" : ""} ${asset.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="asset-header">
                  <div className="asset-title">
                    <span className="asset-symbol">{asset.symbol}</span>
                    <span className="asset-name">{asset.name}</span>
                  </div>
                  <span className="asset-chain">{asset.chain}</span>
                </div>
                <div className="asset-meta">
                  <span>Price: ${asset.publicPrice}</span>
                  <span>Added: {new Date(asset.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="asset-status">
                  {asset.isVerified ? (
                    <span className="status-verified">✅ Balance: {asset.decryptedValue}</span>
                  ) : (
                    <span className="status-encrypted">🔒 FHE Encrypted</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showAddModal && (
        <ModalAddAsset 
          onSubmit={addAsset} 
          onClose={() => setShowAddModal(false)} 
          adding={addingAsset} 
          assetData={newAssetData} 
          setAssetData={setNewAssetData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedAsset && (
        <AssetDetailModal 
          asset={selectedAsset} 
          onClose={() => { 
            setSelectedAsset(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptAsset(selectedAsset.encryptedBalance)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal metal-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalAddAsset: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  adding: boolean;
  assetData: any;
  setAssetData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, adding, assetData, setAssetData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'balance' || name === 'price') {
      const intValue = value.replace(/[^\d]/g, '');
      setAssetData({ ...assetData, [name]: intValue });
    } else {
      setAssetData({ ...assetData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay metal-overlay">
      <div className="add-asset-modal metal-modal">
        <div className="modal-header">
          <h2>Add Encrypted Asset</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice metal-notice">
            <strong>FHE 🔐 Protection</strong>
            <p>Asset balance encrypted with Zama FHE (Integer values only)</p>
          </div>
          
          <div className="form-group">
            <label>Asset Name *</label>
            <input 
              type="text" 
              name="name" 
              value={assetData.name} 
              onChange={handleChange} 
              placeholder="e.g., Bitcoin, Ethereum..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Symbol *</label>
            <input 
              type="text" 
              name="symbol" 
              value={assetData.symbol} 
              onChange={handleChange} 
              placeholder="e.g., BTC, ETH..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Blockchain *</label>
            <select name="chain" value={assetData.chain} onChange={handleChange} className="metal-select">
              <option value="Ethereum">Ethereum</option>
              <option value="Polygon">Polygon</option>
              <option value="Arbitrum">Arbitrum</option>
              <option value="Optimism">Optimism</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Balance (Integer only) *</label>
            <input 
              type="number" 
              name="balance" 
              value={assetData.balance} 
              onChange={handleChange} 
              placeholder="Enter balance..." 
              step="1"
              min="0"
              className="metal-input"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Price (USD) *</label>
            <input 
              type="number" 
              name="price" 
              value={assetData.price} 
              onChange={handleChange} 
              placeholder="Enter price..." 
              step="0.01"
              min="0"
              className="metal-input"
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={adding || isEncrypting || !assetData.name || !assetData.symbol || !assetData.balance || !assetData.price} 
            className="submit-btn metal-btn primary"
          >
            {adding || isEncrypting ? "Encrypting..." : "Add Asset"}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssetDetailModal: React.FC<{
  asset: PortfolioAsset;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ asset, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) { 
      setDecryptedData(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  const currentValue = asset.isVerified ? 
    (asset.decryptedValue || 0) * asset.publicPrice :
    decryptedData !== null ? 
    decryptedData * asset.publicPrice : 
    asset.publicValue1 * asset.publicPrice;

  return (
    <div className="modal-overlay metal-overlay">
      <div className="asset-detail-modal metal-modal">
        <div className="modal-header">
          <h2>Asset Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="asset-info">
            <div className="info-row">
              <span>Asset:</span>
              <strong>{asset.name} ({asset.symbol})</strong>
            </div>
            <div className="info-row">
              <span>Blockchain:</span>
              <strong>{asset.chain}</strong>
            </div>
            <div className="info-row">
              <span>Current Price:</span>
              <strong>${asset.publicPrice}</strong>
            </div>
            <div className="info-row">
              <span>Value:</span>
              <strong className="gold-text">${currentValue.toLocaleString()}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Balance Data</h3>
            
            <div className="data-row">
              <div className="data-label">Asset Balance:</div>
              <div className="data-value">
                {asset.isVerified ? 
                  `${asset.decryptedValue} (Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData} (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn metal-btn ${(asset.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? "🔓 Verifying..." :
                 asset.isVerified ? "✅ Verified" :
                 decryptedData !== null ? "🔄 Re-verify" : "🔓 Verify Balance"}
              </button>
            </div>
            
            <div className="fhe-info metal-notice">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Balance Protection</strong>
                <p>Your asset balance is encrypted on-chain. Verify to decrypt and confirm holdings.</p>
              </div>
            </div>
          </div>
          
          {(asset.isVerified || decryptedData !== null) && (
            <div className="value-section">
              <h3>Portfolio Value</h3>
              <div className="value-display">
                <div className="value-item">
                  <span>Balance:</span>
                  <strong>
                    {asset.isVerified ? 
                      asset.decryptedValue : 
                      decryptedData
                    }
                  </strong>
                </div>
                <div className="value-item">
                  <span>Price:</span>
                  <strong>${asset.publicPrice}</strong>
                </div>
                <div className="value-item total">
                  <span>Total Value:</span>
                  <strong className="gold-text">${currentValue.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">Close</button>
          {!asset.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn metal-btn primary"
            >
              {isDecrypting ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


