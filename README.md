# 🚀 Decentralized Mobility Rewards Network

Welcome to a blockchain-powered loyalty ecosystem for frequent riders and travelers! This Web3 project solves the real-world problem of fragmented loyalty programs across transportation platforms (e.g., rideshares, airlines, public transit). Users earn tokenized rewards for rides that are interoperable and redeemable anywhere in the network, reducing waste from siloed points and encouraging sustainable mobility. Built on the Stacks blockchain using Clarity smart contracts for secure, transparent reward management.

## ✨ Features

🛵 Earn tokenized loyalty points (MOVE tokens) for every ride or trip logged via partner apps  
🌐 Seamless cross-platform redemption: Use points from Uber-like services on train tickets or bike shares  
🔒 Secure partner verification to prevent fraud and ensure only authorized rides earn rewards  
📊 Real-time dashboard for tracking earnings, redemptions, and token balance  
⚖️ Governance voting for users to propose new partners or reward rules  
💼 Escrow system for high-value redemptions to build trust  
🛡️ Dispute resolution for invalid rides or redemption claims  
🔄 Token burning mechanism to control supply and incentivize long-term usage  

## 🛠 Smart Contracts Overview

This project leverages 8 Clarity smart contracts on Stacks for a robust, decentralized system:

1. **UserRegistry**: Manages user onboarding, KYC-lite verification, and wallet linking.  
2. **MOVE Token**: ERC-20-like fungible token contract for minting, transferring, and burning loyalty points.  
3. **EarningVault**: Handles point minting based on verified ride data from partners (e.g., distance traveled).  
4. **RedemptionHub**: Core contract for claiming rewards, checking eligibility, and processing cross-platform swaps.  
5. **PartnerRegistry**: Onboards and verifies transportation partners, storing API keys and reward rates.  
6. **GovernanceDAO**: Enables token-weighted voting for protocol upgrades, like adding new redemption categories.  
7. **EscrowManager**: Locks tokens during redemptions for secure, time-bound fulfillment by partners.  
8. **DisputeResolver**: Manages claims for erroneous earnings/redemptions, with arbitration via staked tokens.  

These contracts interact via cross-contract calls, ensuring atomic transactions and immutability on Bitcoin's security layer via Stacks.

## 🛣 How It Works

**For Riders (Users)**

- Connect your wallet and register via the UserRegistry contract.  
- Link your preferred transport apps (e.g., via API integrations).  
- After a ride, partners submit proof (e.g., GPS hash + timestamp) to the EarningVault.  
- Points are minted to your MOVE balance—e.g., 1 MOVE per km ridden.  
- Redeem via RedemptionHub: Swap for discounts on any partner service, with EscrowManager holding funds until fulfillment.  
- Participate in GovernanceDAO to vote on features using your staked MOVE tokens.  

**For Partners (Transport Providers)**

- Register your platform in PartnerRegistry with verification (e.g., business proof hash).  
- Integrate ride data feeds to auto-submit earnings to EarningVault.  
- Honor redemptions from the network—e.g., accept MOVE tokens for fare reductions.  
- Use DisputeResolver for handling user claims, staking MOVE as collateral for fair resolutions.  

**Tokenized Loyalty Flow Example**

1. User takes a 10km rideshare ride.  
2. Partner calls EarningVault to mint 10 MOVE tokens to user's wallet.  
3. User redeems 5 MOVE for a train ticket discount on another platform.  
4. RedemptionHub verifies balance, EscrowManager locks tokens, and partner confirms fulfillment to release.  

Boom! Rewards that actually work across your entire travel life. Sustainable, fair, and fraud-resistant.

## 🚀 Getting Started

- Clone the repo and deploy contracts using Clarinet.  
- Test on Stacks testnet for earning/redemption simulations.  
- Integrate with partner APIs for real-world rides.  

Join the mobility revolution—earn, redeem, and govern your way to better travel! 🌍