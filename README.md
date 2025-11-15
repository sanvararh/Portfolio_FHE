# FHE-based Investment Portfolio

The FHE-based Investment Portfolio is a privacy-preserving application that harnesses the power of Zama's Fully Homomorphic Encryption (FHE) technology. This application enables users to securely manage their decentralized finance (DeFi) portfolios by encrypting asset data and performing calculations without exposing sensitive information.

## The Problem

In the world of DeFi, investors face significant risks associated with data privacy. Traditional methods require users to disclose their asset holdings and net worth, potentially exposing them to unwanted attention from malicious actors. Cleartext data can lead to targeted exploitation, making it imperative to secure sensitive information throughout the investment lifecycle. Without robust privacy measures, individuals risk being tracked and targeted, undermining the fundamental principles of decentralized finance.

## The Zama FHE Solution

Zama's FHE technology addresses these concerns by allowing computations on encrypted data. This means that sensitive information, such as holdings and net worth, can be encrypted before being processed. Using fhevm to process encrypted inputs, the FHE-based Investment Portfolio enables secure net worth calculations without ever revealing the underlying data. This approach allows users to confidently manage and analyze their portfolios while maintaining full control over their privacy.

## Key Features

- 🔒 **Privacy-Preserving Asset Management**: Encrypt your holdings to protect against unwanted scrutiny.
- 💰 **Secure Net Worth Calculation**: Perform calculations on encrypted data to determine portfolio value without exposing sensitive information.
- 📊 **Visual Portfolio Analysis**: Generate insightful visualizations, like pie charts, using encrypted data.
- 🏦 **Multi-Chain Asset Aggregation**: Manage assets across different blockchain networks securely and privately.
- 🚀 **User-Friendly Interface**: Intuitive dashboard for seamless interaction with your portfolio.

## Technical Architecture & Stack

This project leverages the following technologies:

- **Core Privacy Engine**: Zama FHE (fhevm)
- **Smart Contracts**: Solidity
- **Frontend**: React.js for UI components
- **Backend**: Node.js for server-side logic
- **Database**: Encrypted storage solution for secure data handling

## Smart Contract / Core Logic

Below is a simplified example of how the investment portfolio could utilize Zama's FHE components for secure net worth calculation:

```solidity
pragma solidity ^0.8.0;

import "TFHE.sol"; // Assuming TFHE is a library for handling encrypted computations.

contract InvestmentPortfolio {
    using TFHE for uint64; // Utilize TFHE for encrypted calculations.

    mapping(address => uint64) private encryptedHoldings;

    function setHoldings(uint64 _encryptedValue) public {
        encryptedHoldings[msg.sender] = _encryptedValue;
    }

    function calculateNetWorth() public view returns (uint64) {
        uint64 totalNetWorth = 0;
        // Logic for aggregating encrypted holdings.
        // Example: totalNetWorth = TFHE.add(encryptedHoldings[msg.sender], ...);
        return totalNetWorth;
    }
}
```

## Directory Structure

```plaintext
FHE-based-Investment-Portfolio/
├── blockchain/
│   ├── InvestmentPortfolio.sol
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   └── components/
│   └── public/
├── backend/
│   ├── server.js
│   └── controllers/
├── tests/
│   ├── InvestmentPortfolio.test.js
└── README.md
```

## Installation & Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js
- npm (Node Package Manager)
- Python (for any machine learning aspects)
- pip (Python Package Installer)

### Dependencies

To install the necessary dependencies for this project, navigate to the project directory in your terminal and run the following commands:

For the backend:
```bash
npm install express
npm install fhevm
```

For the frontend:
```bash
npm install react
```

For any Python aspects (if applicable):
```bash
pip install concrete-ml
```

## Build & Run

Once all dependencies are installed, you can build and run the project:

For the smart contracts:
```bash
npx hardhat compile
```

To start the backend server:
```bash
node backend/server.js
```

To host the frontend:
```bash
npm start
```

## Acknowledgements

We extend our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their innovative technology forms the backbone of our privacy-preserving solutions, enabling users to invest with confidence and security.


