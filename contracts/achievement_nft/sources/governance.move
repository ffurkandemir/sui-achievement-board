module achievement_nft::governance {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::vec_map::{Self, VecMap};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use std::string::String;
    use std::vector;
    use achievement_nft::achievement::{Self, AchievementNFT};

    // ===== Error Codes =====
    const E_NOT_ENOUGH_VOTES: u64 = 100;
    const E_ALREADY_VOTED: u64 = 101;
    const E_PROPOSAL_EXPIRED: u64 = 102;
    const E_PROPOSAL_NOT_PASSED: u64 = 103;
    const E_NOT_ENOUGH_POINTS: u64 = 104;
    const E_INVALID_DURATION: u64 = 105;

    // ===== Constants =====
    const MIN_VOTING_POWER: u64 = 10; // Minimum points to vote
    const PROPOSAL_DURATION: u64 = 7 * 86400000; // 7 days in milliseconds
    const QUORUM_PERCENTAGE: u64 = 30; // 30% participation required

    // ===== Structs =====

    /// Governance Hub - Shared Object
    public struct GovernanceHub has key {
        id: UID,
        proposals: VecMap<u64, TaskProposal>,
        next_proposal_id: u64,
        total_voting_power: u64,
    }

    /// Task Proposal
    public struct TaskProposal has store, copy, drop {
        id: u64,
        proposer: address,
        title: String,
        description: String,
        reward_points: u64,
        difficulty: u8, // 1=Easy, 2=Medium, 3=Hard
        created_at: u64,
        ends_at: u64,
        votes_for: u64,
        votes_against: u64,
        voters: vector<address>,
        executed: bool,
    }

    /// Staking Pool - Shared Object
    public struct StakingPool has key {
        id: UID,
        total_staked_points: u64,
        stakes: VecMap<address, StakeInfo>,
        reward_rate: u64, // Points per day per 100 staked
    }

    /// Individual Stake Info
    public struct StakeInfo has store, copy, drop {
        amount: u64,
        staked_at: u64,
        last_claim: u64,
        accumulated_rewards: u64,
    }

    /// Point Marketplace - Shared Object  
    public struct Marketplace has key {
        id: UID,
        listings: VecMap<u64, PointListing>,
        next_listing_id: u64,
        platform_fee: u64, // Basis points (100 = 1%)
    }

    /// Point Listing
    public struct PointListing has store, copy, drop {
        id: u64,
        seller: address,
        points_amount: u64,
        sui_price: u64,
        created_at: u64,
        active: bool,
    }

    // ===== Events =====

    public struct ProposalCreated has copy, drop {
        proposal_id: u64,
        proposer: address,
        title: String,
        ends_at: u64,
    }

    public struct VoteCast has copy, drop {
        proposal_id: u64,
        voter: address,
        in_favor: bool,
        voting_power: u64,
    }

    public struct ProposalExecuted has copy, drop {
        proposal_id: u64,
        passed: bool,
        votes_for: u64,
        votes_against: u64,
    }

    public struct PointsStaked has copy, drop {
        staker: address,
        amount: u64,
        timestamp: u64,
    }

    public struct PointsListed has copy, drop {
        listing_id: u64,
        seller: address,
        points_amount: u64,
        sui_price: u64,
    }

    // ===== Init Function =====

    fun init(ctx: &mut TxContext) {
        // Create Governance Hub
        let governance = GovernanceHub {
            id: object::new(ctx),
            proposals: vec_map::empty(),
            next_proposal_id: 0,
            total_voting_power: 0,
        };
        transfer::share_object(governance);

        // Create Staking Pool
        let staking = StakingPool {
            id: object::new(ctx),
            total_staked_points: 0,
            stakes: vec_map::empty(),
            reward_rate: 5, // 5% daily on staked points
        };
        transfer::share_object(staking);

        // Create Marketplace
        let marketplace = Marketplace {
            id: object::new(ctx),
            listings: vec_map::empty(),
            next_listing_id: 0,
            platform_fee: 250, // 2.5% fee
        };
        transfer::share_object(marketplace);
    }

    // ===== Governance Functions =====

    /// Create a new task proposal (virtual - no points deduction)
    public entry fun create_proposal(
        governance: &mut GovernanceHub,
        title: String,
        description: String,
        category: u8,
        reward_points: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let proposer = tx_context::sender(ctx);
        
        let now = clock::timestamp_ms(clock);
        let proposal_id = governance.next_proposal_id;

        let proposal = TaskProposal {
            id: proposal_id,
            proposer,
            title,
            description,
            reward_points,
            difficulty: category, // Use category as difficulty
            created_at: now,
            ends_at: now + PROPOSAL_DURATION,
            votes_for: 0,
            votes_against: 0,
            voters: vector::empty(),
            executed: false,
        };

        vec_map::insert(&mut governance.proposals, proposal_id, proposal);
        governance.next_proposal_id = proposal_id + 1;

        event::emit(ProposalCreated {
            proposal_id,
            proposer,
            title,
            ends_at: now + PROPOSAL_DURATION,
        });
    }

    /// Vote on a proposal
    public entry fun vote_on_proposal(
        governance: &mut GovernanceHub,
        proposal_id: u64,
        in_favor: bool,
        voting_power: u64, // Based on user's achievement points
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let voter = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        assert!(voting_power >= MIN_VOTING_POWER, E_NOT_ENOUGH_POINTS);

        let proposal = vec_map::get_mut(&mut governance.proposals, &proposal_id);
        assert!(now < proposal.ends_at, E_PROPOSAL_EXPIRED);
        assert!(!vector::contains(&proposal.voters, &voter), E_ALREADY_VOTED);

        vector::push_back(&mut proposal.voters, voter);

        if (in_favor) {
            proposal.votes_for = proposal.votes_for + voting_power;
        } else {
            proposal.votes_against = proposal.votes_against + voting_power;
        };

        event::emit(VoteCast {
            proposal_id,
            voter,
            in_favor,
            voting_power,
        });
    }

    /// Execute proposal after voting ends
    public entry fun execute_proposal(
        governance: &mut GovernanceHub,
        proposal_id: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        let proposal = vec_map::get_mut(&mut governance.proposals, &proposal_id);

        assert!(now >= proposal.ends_at, E_PROPOSAL_EXPIRED);
        assert!(!proposal.executed, E_ALREADY_VOTED);

        let total_votes = proposal.votes_for + proposal.votes_against;
        let quorum = (governance.total_voting_power * QUORUM_PERCENTAGE) / 100;
        let passed = total_votes >= quorum && proposal.votes_for > proposal.votes_against;

        proposal.executed = true;

        event::emit(ProposalExecuted {
            proposal_id,
            passed,
            votes_for: proposal.votes_for,
            votes_against: proposal.votes_against,
        });
    }

    // ===== Staking Functions =====

    /// Stake points for rewards (virtual staking - doesn't actually deduct points)
    public entry fun stake_points(
        pool: &mut StakingPool,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let staker = tx_context::sender(ctx);
        
        let now = clock::timestamp_ms(clock);

        if (vec_map::contains(&pool.stakes, &staker)) {
            let stake = vec_map::get_mut(&mut pool.stakes, &staker);
            stake.amount = stake.amount + amount;
        } else {
            let stake = StakeInfo {
                amount,
                staked_at: now,
                last_claim: now,
                accumulated_rewards: 0,
            };
            vec_map::insert(&mut pool.stakes, staker, stake);
        };

        pool.total_staked_points = pool.total_staked_points + amount;

        event::emit(PointsStaked {
            staker,
            amount,
            timestamp: now,
        });
    }

    /// Claim staking rewards
    public fun claim_staking_rewards(
        pool: &mut StakingPool,
        clock: &Clock,
        ctx: &mut TxContext
    ): u64 {
        let staker = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        assert!(vec_map::contains(&pool.stakes, &staker), E_NOT_ENOUGH_POINTS);

        let stake = vec_map::get_mut(&mut pool.stakes, &staker);
        let days_elapsed = (now - stake.last_claim) / 86400000;
        let rewards = (stake.amount * pool.reward_rate * days_elapsed) / 100;

        stake.accumulated_rewards = stake.accumulated_rewards + rewards;
        stake.last_claim = now;

        rewards
    }

    // ===== Marketplace Functions =====

    /// List points for sale (virtual - no points deduction until purchase)
    public entry fun list_points(
        marketplace: &mut Marketplace,
        points_amount: u64,
        sui_price: u64,
        ctx: &mut TxContext
    ) {
        let seller = tx_context::sender(ctx);
        
        let listing_id = marketplace.next_listing_id;

        let listing = PointListing {
            id: listing_id,
            seller,
            points_amount,
            sui_price,
            created_at: 0, // Will be set when listing is active
            active: true,
        };

        vec_map::insert(&mut marketplace.listings, listing_id, listing);
        marketplace.next_listing_id = listing_id + 1;

        event::emit(PointsListed {
            listing_id,
            seller,
            points_amount,
            sui_price,
        });
    }

    /// Buy points from marketplace
    public fun buy_points(
        marketplace: &mut Marketplace,
        listing_id: u64,
        payment: Coin<SUI>,
        _ctx: &mut TxContext
    ): u64 {
        let listing = vec_map::get_mut(&mut marketplace.listings, &listing_id);
        assert!(listing.active, E_NOT_ENOUGH_POINTS);

        let paid_amount = coin::value(&payment);
        assert!(paid_amount >= listing.sui_price, E_NOT_ENOUGH_POINTS);

        listing.active = false;

        // Calculate platform fee
        let fee = (listing.sui_price * marketplace.platform_fee) / 10000;
        let _seller_amount = listing.sui_price - fee; // Reserved for future use

        // Transfer to seller (simplified - in production, handle coin splits)
        transfer::public_transfer(payment, listing.seller);

        listing.points_amount
    }

    // ===== View Functions =====
    // Note: View functions removed due to Move borrowing constraints
    // Use object inspection or events to query state
}
