pragma solidity ^0.8.24;

import { FHE, euint, externalEuint } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PortfolioFHE is ZamaEthereumConfig {
    struct Asset {
        string name;
        euint encryptedBalance;
        uint256 publicData;
        string description;
        address owner;
        uint256 timestamp;
        uint256 decryptedBalance;
        bool isVerified;
    }

    mapping(string => Asset) public assets;
    string[] public assetIds;

    event AssetAdded(string indexed assetId, address indexed owner);
    event BalanceVerified(string indexed assetId, uint256 balance);

    constructor() ZamaEthereumConfig() {}

    function addAsset(
        string calldata assetId,
        string calldata name,
        externalEuint encryptedBalance,
        bytes calldata inputProof,
        uint256 publicData,
        string calldata description
    ) external {
        require(bytes(assets[assetId].name).length == 0, "Asset already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedBalance, inputProof)), "Invalid encrypted balance");

        assets[assetId] = Asset({
            name: name,
            encryptedBalance: FHE.fromExternal(encryptedBalance, inputProof),
            publicData: publicData,
            description: description,
            owner: msg.sender,
            timestamp: block.timestamp,
            decryptedBalance: 0,
            isVerified: false
        });

        FHE.allowThis(assets[assetId].encryptedBalance);
        FHE.makePubliclyDecryptable(assets[assetId].encryptedBalance);

        assetIds.push(assetId);
        emit AssetAdded(assetId, msg.sender);
    }

    function verifyBalance(
        string calldata assetId,
        bytes memory abiEncodedClearBalance,
        bytes memory decryptionProof
    ) external {
        require(bytes(assets[assetId].name).length > 0, "Asset does not exist");
        require(!assets[assetId].isVerified, "Balance already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(assets[assetId].encryptedBalance);

        FHE.checkSignatures(cts, abiEncodedClearBalance, decryptionProof);

        uint256 decodedBalance = abi.decode(abiEncodedClearBalance, (uint256));
        assets[assetId].decryptedBalance = decodedBalance;
        assets[assetId].isVerified = true;

        emit BalanceVerified(assetId, decodedBalance);
    }

    function getEncryptedBalance(string calldata assetId) external view returns (euint) {
        require(bytes(assets[assetId].name).length > 0, "Asset does not exist");
        return assets[assetId].encryptedBalance;
    }

    function getAsset(string calldata assetId) external view returns (
        string memory name,
        uint256 publicData,
        string memory description,
        address owner,
        uint256 timestamp,
        bool isVerified,
        uint256 decryptedBalance
    ) {
        require(bytes(assets[assetId].name).length > 0, "Asset does not exist");
        Asset storage asset = assets[assetId];

        return (
            asset.name,
            asset.publicData,
            asset.description,
            asset.owner,
            asset.timestamp,
            asset.isVerified,
            asset.decryptedBalance
        );
    }

    function getAllAssetIds() external view returns (string[] memory) {
        return assetIds;
    }

    function computeTotalValue() external pure returns (bool) {
        // Placeholder for FHE computation logic
        return true;
    }
}


