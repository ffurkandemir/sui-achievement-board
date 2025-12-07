# Sui Achievement Board 🏆

> **Gamified Achievement Tracking with Dynamic NFTs on Sui Blockchain**

A comprehensive achievement tracking system that combines dynamic NFTs, governance, staking, and marketplace features - showcasing Sui's advanced blockchain capabilities.

[![Sui Network](https://img.shields.io/badge/Sui-Testnet-blue)](https://suiscan.xyz/testnet)
[![Move Language](https://img.shields.io/badge/Move-Smart%20Contracts-orange)](https://move-language.github.io/move/)
[![React](https://img.shields.io/badge/React-19.2.0-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)](https://www.typescriptlang.org/)

## 📖 Table of Contents
- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Architecture](#️-architecture)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Smart Contract API](#-smart-contract-api)
- [Technology Stack](#-technology-stack)
- [Hackathon Highlights](#-hackathon-highlights)

## 🎯 Overview

Sui Achievement Board is a full-featured DApp demonstrating Sui blockchain's capabilities through:

- **Dynamic NFTs** that evolve with user progress
- **DAO Governance** with voting and staking mechanisms
- **NFT Marketplace** for trading achievement points with SUI tokens
- **Shared Objects** for concurrent access to leaderboard and governance
- **Clock Integration** for time-based mechanics (daily rewards, streaks)
- **Event System** for transparent on-chain activity tracking

> ⚠️ **Important:** This project is built for **Sui Testnet**. All smart contracts are deployed on testnet and require testnet SUI tokens to interact. Perfect for testing and learning without real funds!

**Deployed on Sui Testnet:**
- Package ID available after deployment
- [View on Suiscan Explorer](https://suiscan.xyz/testnet)

## 🚀 Live Demo

🌐 **Deploy your own instance on Vercel or Netlify**

**Requirements:**
- Network: Sui Testnet
- Faucet: [Get Test SUI](https://faucet.sui.io/)
- Recommended Wallet: [Sui Wallet](https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)

## 🌟 Features

### 🎮 Achievement System
- **9 Achievement Tasks** - Complete tasks to earn points and level up
- **Dynamic NFT Metadata** - Your NFT updates in real-time as you progress
- **Progress Tracking** - Visual progress bars and completion status
- **Level System** - 20 points per level with unlimited progression

### 📅 Daily Rewards & Streaks
- **Daily Check-in** - Claim rewards once every 24 hours
- **Streak Multiplier** - Consecutive days increase bonus: Day 1: +7 pts, Day 2: +9 pts, Day 3: +11 pts...
- **Sui Clock Integration** - Blockchain-verified timestamps
- **Longest Streak Tracking** - Personal best records

### 🏆 Global Leaderboard
- **Real-time Rankings** - Top 100 players tracked concurrently
- **Shared Object Architecture** - Multiple users can update simultaneously
- **Live Stats** - Points, levels, and completion rates
- **Competitive System** - See how you rank globally

### 🗳️ DAO Governance
- **Proposal System** - Create and vote on community decisions
- **Staking Mechanism** - Stake points to vote (1 point = 1 vote)
- **Active Proposals** - Vote for or against active proposals
- **Proposal History** - Track voting results and outcomes
- **Execution Threshold** - Proposals execute when criteria met

### 🛒 NFT Marketplace
- **P2P Trading** - List achievement points for sale
- **SUI Token Payments** - Trade points for SUI cryptocurrency
- **Price Discovery** - Set your own prices in SUI
- **Instant Execution** - Automated smart contract settlement
- **Active Listings** - Browse and buy from other players

### 🎨 Modern UI/UX
- **Responsive Design** - Works on desktop and mobile
- **Glassmorphism Theme** - Modern gradient effects
- **Real-time Updates** - Auto-refresh on blockchain changes
- **Loading States** - Clear feedback for all operations
- **Error Handling** - User-friendly error messages

## 🏗️ Architecture

### 📦 Project Structure

```
sui-achievement-board/
├── contracts/achievement_nft/
│   └── sources/
│       ├── achievement.move      # Achievement NFT & Leaderboard
│       └── governance.move       # DAO, Staking & Marketplace
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main application 
│   │   ├── App.css              # Component styles
│   │   ├── index.css            # Global styles
│   │   └── main.tsx             # Entry point with Sui integration
│   └── package.json
└── README.md
```

### 🔗 Smart Contract Modules

#### Achievement Module (`achievement.move`)
- **Dynamic NFTs** with evolving metadata
- **Shared Leaderboard** for global rankings
- **Daily Rewards** with streak tracking
- **Task System** with completion validation

#### Governance Module (`governance.move`)
- **Proposal Creation** with description and voting period
- **Staking System** for voting power
- **Marketplace** for point trading with SUI tokens
- **DAO Treasury** management

### 🎨 Frontend Stack
- **React 19.2.0** - Latest React with concurrent features
- **TypeScript 5.9** - Type-safe development
- **Vite 7.2** - Lightning-fast build tool
- **@mysten/dapp-kit** - Sui wallet integration
- **@mysten/sui** - Sui blockchain SDK
- **TanStack Query** - Data fetching and caching

### 🔐 Key Design Patterns

1. **Owned Objects** - User NFTs are owned by individual addresses
2. **Shared Objects** - Leaderboard, GovernanceHub, Marketplace for concurrent access
3. **Witness Pattern** - One-time capability for Display creation
4. **Clock Integration** - Time-based mechanics with `sui::clock::Clock`
5. **Event Emission** - Transparent activity tracking

## 🚀 Quick Start

### Setup Steps

1. Install [Sui Wallet](https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
2. Switch to **Testnet** network in your wallet
3. Get test SUI from [faucet](https://faucet.sui.io/)
4. Deploy smart contracts (see below)
5. Run the frontend locally
6. Connect wallet and start achieving! 🎉

### Local Development

#### Prerequisites
- [Sui CLI](https://docs.sui.io/build/install) (for contract development)
- [Node.js 18+](https://nodejs.org/) and npm
- [Sui Wallet](https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)

#### Clone & Install

```bash
# Clone the repository
git clone https://github.com/ffurkandemir/sui-achievement-board.git
cd sui-achievement-board

# Install frontend dependencies
cd frontend
npm install
```

#### Deploy Smart Contracts

```bash
# Navigate to contracts directory
cd contracts/achievement_nft

# Publish to Sui Testnet
sui client publish --gas-budget 500000000
```

**After deployment, update frontend with your contract IDs:**
- Edit `frontend/src/App.tsx` (lines 11-23)
- Replace placeholder IDs with your deployed contract IDs:
  - `PACKAGE_ID` - Your published package ID
  - `LEADERBOARD_ID` - Shared Leaderboard object ID
  - `GOVERNANCE_HUB_ID` - Shared GovernanceHub object ID
  - `STAKING_POOL_ID` - Shared StakingPool object ID
  - `MARKETPLACE_ID` - Shared Marketplace object ID
  - `TASK_SYSTEM_ID` - Shared TaskSystem object ID
  - `REFERRAL_SYSTEM_ID` - Shared ReferralSystem object ID

#### Run Development Server

```bash
# Start the frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173`

## 📖 How It Works

### 🎮 Getting Started

#### 1️⃣ Mint Your Achievement NFT
```
Connect Wallet → Click "Mint New NFT" → Approve Transaction
```
- Your unique NFT is created on-chain
- Automatically added to global leaderboard
- NFT metadata updates as you progress

#### 2️⃣ Complete Achievement Tasks
```
Select Task → Click to Complete → Earn +10 Points
```
- 9 unique tasks available
- Can't complete the same task twice
- Points automatically update your level
- Leaderboard updates in real-time

#### 3️⃣ Claim Daily Rewards
```
Click "Claim Daily Reward" → Get Base + Streak Bonus
```
- Base reward: 5 points
- Streak bonus: +2 points per consecutive day
- Day 1: 7 pts | Day 2: 9 pts | Day 3: 11 pts | Day 7: 19 pts
- Break streak = restart from Day 1

### 🗳️ Participating in Governance

#### Create Proposals
```
Title + Description → Submit → Proposal Goes Live
```
- Anyone can create proposals
- Community discusses and debates
- Transparent on-chain voting

#### Stake & Vote
```
Stake Points → Vote For/Against → Unstake When Done
```
- 1 point staked = 1 vote
- Points locked during active voting
- Unstake after voting completes
- Proposals execute at threshold

### 🛒 Trading on Marketplace

#### List Points for Sale
```
Select Amount → Set SUI Price → List for Sale
```
- Trade achievement points for SUI tokens
- You set the price (e.g., 100 points = 0.5 SUI)
- Listing appears immediately
- Cancel anytime if not sold

#### Buy Listed Points
```
Browse Listings → Select → Buy with SUI → Instant Transfer
```
- Pay with SUI tokens from your wallet
- Points transfer automatically
- Seller receives SUI payment
- No intermediary needed

## 🎯 Game Mechanics

### Points & Leveling
- **Points per task**: 10
- **Points per level**: 20
- **Daily base reward**: 5 points
- **Streak bonus**: +2 points per day of streak

### Calculation Examples
```
Level 0: 0-19 points
Level 1: 20-39 points  
Level 2: 40-59 points

Daily Rewards:
Day 1: 5 + (1 * 2) = 7 points
Day 2: 5 + (2 * 2) = 9 points
Day 3: 5 + (3 * 2) = 11 points
```

## 🔐 Security Features

- Owner-only operations (only NFT owner can complete tasks)
- Duplicate prevention (can't complete same task twice)
- Daily claim limit (one claim per 24 hours)
- Index bounds checking
- Capability-based admin functions

## 🧩 Smart Contract API

### Achievement Module Functions

```move
// Mint initial Achievement NFT
public entry fun init_user_achievement(
    leaderboard: &mut Leaderboard, 
    ctx: &mut TxContext
)

// Complete an achievement task
public entry fun complete_task(
    user_nft: &mut AchievementNFT,
    leaderboard: &mut Leaderboard, 
    task_index: u64,
    clock: &Clock,
    ctx: &mut TxContext
)

// Claim daily reward with streak bonus
public entry fun claim_daily_reward(
    user_nft: &mut AchievementNFT,
    leaderboard: &mut Leaderboard,
    clock: &Clock, 
    ctx: &mut TxContext
)

// Reset user progress (new season)
public entry fun reset_progress(
    user_nft: &mut AchievementNFT, 
    ctx: &mut TxContext
)

// View functions
public fun get_leaderboard_size(leaderboard: &Leaderboard): u64
public fun get_daily_streak(nft: &AchievementNFT): (u64, u64, u64)
```

### Governance Module Functions

```move
// Initialize governance hub (one-time)
fun init(otw: GOVERNANCE, ctx: &mut TxContext)

// Create a new proposal
public entry fun create_proposal(
    hub: &mut GovernanceHub,
    title: vector<u8>,
    description: vector<u8>,
    ctx: &mut TxContext
)

// Stake points to gain voting power
public entry fun stake_points(
    hub: &mut GovernanceHub,
    nft: &mut AchievementNFT,
    amount: u64,
    ctx: &mut TxContext
)

// Unstake previously staked points
public entry fun unstake_points(
    hub: &mut GovernanceHub,
    nft: &mut AchievementNFT,
    amount: u64,
    ctx: &mut TxContext
)

// Vote on an active proposal
public entry fun vote_on_proposal(
    hub: &mut GovernanceHub,
    proposal_id: u64,
    support: bool,
    ctx: &mut TxContext
)

// List points for sale on marketplace
public entry fun list_points(
    marketplace: &mut Marketplace,
    nft: &mut AchievementNFT,
    points_amount: u64,
    sui_price: u64, // Price in MIST (1 SUI = 1_000_000_000 MIST)
    ctx: &mut TxContext
)

// Buy listed points with SUI
public entry fun buy_points(
    marketplace: &mut Marketplace,
    listing_id: u64,
    payment: Coin<SUI>,
    buyer_nft: &mut AchievementNFT,
    ctx: &mut TxContext
)

// Cancel your own listing
public entry fun cancel_listing(
    marketplace: &mut Marketplace,
    listing_id: u64,
    nft: &mut AchievementNFT,
    ctx: &mut TxContext
)
```

## 📊 On-Chain Events

All major actions emit events for transparency and tracking:

```move
// Achievement events
public struct TaskCompletedEvent has copy, drop {
    user: address,
    task_index: u64,
    new_points: u64,
    new_level: u64,
}

public struct DailyRewardClaimedEvent has copy, drop {
    user: address,
    streak: u64,
    bonus_points: u64,
    timestamp: u64,
}

public struct LeaderboardUpdatedEvent has copy, drop {
    user: address,
    points: u64,
    level: u64,
    rank: u64,
}

// Governance events
public struct ProposalCreatedEvent has copy, drop {
    proposal_id: u64,
    creator: address,
    title: String,
}

public struct VotedEvent has copy, drop {
    proposal_id: u64,
    voter: address,
    support: bool,
    votes: u64,
}

// Marketplace events
public struct PointsListedEvent has copy, drop {
    listing_id: u64,
    seller: address,
    points_amount: u64,
    sui_price: u64,
}

public struct PointsSoldEvent has copy, drop {
    listing_id: u64,
    buyer: address,
    seller: address,
    points_amount: u64,
    sui_price: u64,
}
```

## 💻 Technology Stack

### Blockchain
- **Sui Network** - High-performance L1 blockchain
- **Move Language** - Secure smart contract development
- **Sui CLI** - Contract deployment and testing

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 7.2.4 | Build tool |
| @mysten/dapp-kit | 0.19.11 | Wallet integration |
| @mysten/sui | 1.45.2 | Sui SDK |
| @tanstack/react-query | 5.90.12 | Data fetching |

### Smart Contracts
- **achievement.move** - 400+ lines, NFT & Leaderboard logic
- **governance.move** - 600+ lines, DAO, Staking & Marketplace

### Development Tools
- ESLint 9 - Code linting
- TypeScript ESLint - Type checking
- Node.js 18+ - Runtime environment

## 🧪 Testing & Verification

### Local Testing
```bash
# Test smart contracts
cd contracts/achievement_nft
sui move test

# Build frontend
cd frontend
npm run build
```

### Blockchain Queries
```bash
# View leaderboard
sui client object 0x8579c6efdc6e0f5ba424c7bc324e04311a8639fa57ae4708b32cde7335772076

# View your NFT
sui client objects --owner <YOUR_ADDRESS>

# Check events
sui client events --query "MoveEventType::0x01f39ae8802d5cef4118b67dfae61bc291dc71cc8d907bc9c3ff63d31e0f1dc7::achievement::TaskCompletedEvent"
```

### Explorer Links
- [Package](https://suiscan.xyz/testnet/object/0x01f39ae8802d5cef4118b67dfae61bc291dc71cc8d907bc9c3ff63d31e0f1dc7)
- [Leaderboard](https://suiscan.xyz/testnet/object/0x8579c6efdc6e0f5ba424c7bc324e04311a8639fa57ae4708b32cde7335772076)
- [Governance Hub](https://suiscan.xyz/testnet/object/0x10376729568b39e51809879ab626806baadf67ac096aae0fe02efd4495dea1ab)
- [Marketplace](https://suiscan.xyz/testnet/object/0xb8801d968fe0744dd1129073f4d8bc3407c0945c1fa86b28661c163f8a253365)

## 🏆 Hackathon Highlights

This project showcases advanced Sui blockchain capabilities:

### ✅ Core Sui Features
1. **Sui Display Standard** - NFTs visualized in wallets and explorers with dynamic metadata
2. **Shared Objects** - Concurrent access to Leaderboard, GovernanceHub, and Marketplace
3. **Owned Objects** - User NFTs with secure ownership model
4. **Clock Integration** - Time-based mechanics for daily rewards and streaks
5. **Event System** - Complete transparency with on-chain event emission

### ✅ Advanced Patterns
6. **Dynamic NFTs** - Metadata updates automatically as users progress
7. **DAO Governance** - Community-driven decision making with staking and voting
8. **P2P Marketplace** - Trustless NFT point trading with SUI tokens
9. **Composability** - All functions are public entry functions for extensibility
10. **Gas Optimization** - Efficient storage and computation patterns

### ✅ Best Practices
11. **Security** - Owner-only operations, duplicate prevention, bounds checking
12. **Error Handling** - Comprehensive abort codes with descriptive messages
13. **Testing** - Unit tests for critical functionality
14. **Documentation** - Extensive inline comments and README
15. **UI/UX** - Modern, responsive design with real-time updates

## 🎓 What I Learned

Building this project taught me:

- **Move Programming** - Smart contract development with strong security guarantees
- **Sui Architecture** - Owned vs shared objects, parallel transaction execution
- **Dynamic NFTs** - Updating metadata on-chain vs off-chain approaches
- **DAO Mechanics** - Staking, voting, and proposal systems
- **DeFi Basics** - P2P marketplace, price discovery, and trustless trading
- **Web3 UX** - Wallet integration, transaction states, and error handling

## 🔮 Future Enhancements

**Phase 1: Enhanced Features**
- [ ] **Badge System** - Dynamic child objects for special achievements
- [ ] **SUI Rewards Pool** - Treasury management with yield distribution
- [ ] **NFT Fusion** - Combine multiple NFTs for rare achievements
- [ ] **Social Features** - Friend lists, challenges, and competitions

**Phase 2: Advanced Mechanics**
- [ ] **Season System** - Periodic resets with rewards
- [ ] **Guild Support** - Team achievements and collaboration
- [ ] **Cross-Game Portability** - Use achievements across multiple DApps
- [ ] **Achievement Templates** - Community-created achievement types

**Phase 3: User Experience**
- [ ] **zkLogin Integration** - Gasless onboarding for new users
- [ ] **Sponsored Transactions** - Free gameplay for newcomers
- [ ] **Mobile App** - Native iOS/Android applications
- [ ] **Push Notifications** - Daily reminders and updates

**Phase 4: Ecosystem Integration**
- [ ] **DeepBook Integration** - Automated market making for points
- [ ] **Kiosk Support** - Advanced NFT trading features
- [ ] **DAO Treasury** - Community-managed rewards pool
- [ ] **Analytics Dashboard** - On-chain stats and insights

## 📚 Resources & References

### Official Documentation
- [Sui Documentation](https://docs.sui.io/) - Complete Sui developer guide
- [Move Language Book](https://move-language.github.io/move/) - Move programming reference
- [dApp Kit Docs](https://sdk.mystenlabs.com/dapp-kit) - Frontend integration guide
- [Sui Developer Hub](https://sui.io/developers) - Tools and resources

### Useful Tools
- [Sui Explorer](https://suiscan.xyz/testnet) - Blockchain explorer
- [Sui Faucet](https://faucet.sui.io/) - Get testnet SUI tokens
- [Move Playground](https://play.sui.io/) - Online Move development

### Community
- [Sui Discord](https://discord.gg/sui) - Developer community
- [Sui Forum](https://forums.sui.io/) - Discussions and proposals
- [Sui GitHub](https://github.com/MystenLabs/sui) - Source code

## 🐛 Known Issues

- Mobile wallet support requires Sui Wallet app or WalletConnect
- Leaderboard limited to 100 entries (can be extended)
- Daily rewards timezone is UTC-based

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 👨‍💻 Author

**Built for Sui Hackathon 2025**

- GitHub: [@ffurkandemir](https://github.com/ffurkandemir)


## 🙏 Acknowledgments

- **Mysten Labs** - For building the amazing Sui blockchain
- **Sui Community** - For the helpful documentation and support
- **Hackathon Organizers** - For the opportunity to build on Sui

---

<div align="center">

**🚀 [Live Demo](https://sui-achievement-board.vercel.app)** | 
**📦 [Package Explorer](https://suiscan.xyz/testnet/object/0x01f39ae8802d5cef4118b67dfae61bc291dc71cc8d907bc9c3ff63d31e0f1dc7)** | 
**📖 [Documentation](https://github.com/ffurkandemir/sui-achievement-board/wiki)**

Built with ❤️ on Sui Blockchain

</div>
