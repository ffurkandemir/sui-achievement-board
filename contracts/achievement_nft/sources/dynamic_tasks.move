module achievement_nft::dynamic_tasks {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::vec_map::{Self, VecMap};
    use std::string::String;
    use std::vector;

    // ===== Error Codes =====
    const E_TASK_NOT_FOUND: u64 = 200;
    const E_INVALID_DIFFICULTY: u64 = 201;
    const E_ALREADY_COMPLETED: u64 = 202;
    const E_SEASON_ENDED: u64 = 203;

    // ===== Constants =====
    const COMBO_BONUS_MULTIPLIER: u64 = 150; // 1.5x for combos (150%)
    const STREAK_BONUS_BASE: u64 = 2; // +2 points per streak level
    const SEASON_DURATION: u64 = 30 * 86400000; // 30 days

    // ===== Structs =====

    /// Dynamic Task System - Shared Object
    public struct TaskSystem has key {
        id: UID,
        active_tasks: VecMap<u64, DynamicTask>,
        next_task_id: u64,
        difficulty_multipliers: vector<u64>, // [Easy, Medium, Hard]
    }

    /// Dynamic Task
    public struct DynamicTask has store, copy, drop {
        id: u64,
        title: String,
        description: String,
        difficulty: u8, // 1=Easy, 2=Medium, 3=Hard
        base_reward: u64,
        category: u8, // 1=Builder, 2=Social, 3=Explorer, 4=Creator
        requirements: TaskRequirement,
        active: bool,
        completions: u64,
    }

    /// Task Requirements
    public struct TaskRequirement has store, copy, drop {
        min_level: u64,
        required_category_completions: u64,
        cooldown_ms: u64,
    }

    /// Seasonal Event System
    public struct SeasonalEvent has key {
        id: UID,
        season_number: u64,
        theme: String,
        start_time: u64,
        end_time: u64,
        special_tasks: VecMap<u64, DynamicTask>,
        season_leaderboard: VecMap<address, u64>,
        bonus_multiplier: u64,
    }

    /// Referral System
    public struct ReferralSystem has key {
        id: UID,
        referrals: VecMap<address, ReferralInfo>,
        total_referrals: u64,
    }

    /// Referral Info
    public struct ReferralInfo has store, copy, drop {
        referrer: address,
        referred_at: u64,
        referrer_bonus_claimed: bool,
        referee_bonus_claimed: bool,
    }

    /// User Progress Tracker
    public struct UserProgress has key, store {
        id: UID,
        owner: address,
        completed_tasks: VecMap<u64, u64>, // task_id -> completion_timestamp
        current_combo: u64,
        last_task_time: u64,
        category_completions: vector<u64>, // [Builder, Social, Explorer, Creator]
        adaptive_difficulty: u8,
    }

    // ===== Events =====

    public struct DynamicTaskCompleted has copy, drop {
        user: address,
        task_id: u64,
        difficulty: u8,
        category: u8,
        rewards_earned: u64,
        combo_active: bool,
    }

    public struct ComboAchieved has copy, drop {
        user: address,
        combo_count: u64,
        bonus_multiplier: u64,
    }

    public struct DifficultyAdjusted has copy, drop {
        user: address,
        old_difficulty: u8,
        new_difficulty: u8,
    }

    public struct ReferralRegistered has copy, drop {
        referrer: address,
        referee: address,
        bonus_points: u64,
    }

    // ===== Init Function =====

    fun init(ctx: &mut TxContext) {
        // Create Dynamic Task System
        let task_system = TaskSystem {
            id: object::new(ctx),
            active_tasks: vec_map::empty(),
            next_task_id: 0,
            difficulty_multipliers: vector[100, 200, 400], // Easy=1x, Medium=2x, Hard=4x
        };
        transfer::share_object(task_system);

        // Create Referral System
        let referral_system = ReferralSystem {
            id: object::new(ctx),
            referrals: vec_map::empty(),
            total_referrals: 0,
        };
        transfer::share_object(referral_system);
    }

    // ===== Task Management =====

    /// Add a new dynamic task
    public entry fun add_dynamic_task(
        system: &mut TaskSystem,
        title: String,
        description: String,
        difficulty: u8,
        base_reward: u64,
        category: u8,
        min_level: u64,
        required_category_completions: u64,
        cooldown_ms: u64,
        _ctx: &mut TxContext
    ) {
        assert!(difficulty >= 1 && difficulty <= 3, E_INVALID_DIFFICULTY);

        let task_id = system.next_task_id;
        let requirements = TaskRequirement {
            min_level,
            required_category_completions,
            cooldown_ms,
        };

        let task = DynamicTask {
            id: task_id,
            title,
            description,
            difficulty,
            base_reward,
            category,
            requirements,
            active: true,
            completions: 0,
        };

        vec_map::insert(&mut system.active_tasks, task_id, task);
        system.next_task_id = task_id + 1;
    }

    /// Complete a dynamic task with adaptive rewards
    public fun complete_dynamic_task(
        system: &mut TaskSystem,
        progress: &mut UserProgress,
        task_id: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): u64 {
        let user = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        assert!(vec_map::contains(&system.active_tasks, &task_id), E_TASK_NOT_FOUND);
        let task = vec_map::get_mut(&mut system.active_tasks, &task_id);

        // Check if already completed recently
        if (vec_map::contains(&progress.completed_tasks, &task_id)) {
            let last_completion = *vec_map::get(&progress.completed_tasks, &task_id);
            assert!(now - last_completion >= task.requirements.cooldown_ms, E_ALREADY_COMPLETED);
        };

        // Calculate rewards with difficulty multiplier
        let difficulty_idx = (task.difficulty as u64) - 1;
        let multiplier = *vector::borrow(&system.difficulty_multipliers, difficulty_idx);
        let base_rewards = (task.base_reward * multiplier) / 100;

        // Check for combo bonus
        let mut combo_bonus = 0u64;
        let mut combo_active = false;
        if (now - progress.last_task_time < 3600000) { // Within 1 hour
            progress.current_combo = progress.current_combo + 1;
            combo_active = true;
            if (progress.current_combo >= 3) {
                combo_bonus = (base_rewards * (COMBO_BONUS_MULTIPLIER - 100)) / 100;
                event::emit(ComboAchieved {
                    user,
                    combo_count: progress.current_combo,
                    bonus_multiplier: COMBO_BONUS_MULTIPLIER,
                });
            };
        } else {
            progress.current_combo = 1;
        };

        // Update progress
        vec_map::insert(&mut progress.completed_tasks, task_id, now);
        progress.last_task_time = now;
        
        // Update category completions
        let category_idx = (task.category as u64) - 1;
        let current_count = *vector::borrow(&progress.category_completions, category_idx);
        *vector::borrow_mut(&mut progress.category_completions, category_idx) = current_count + 1;

        // Adaptive difficulty adjustment
        if (progress.current_combo >= 5 && progress.adaptive_difficulty < 3) {
            let old_diff = progress.adaptive_difficulty;
            progress.adaptive_difficulty = progress.adaptive_difficulty + 1;
            event::emit(DifficultyAdjusted {
                user,
                old_difficulty: old_diff,
                new_difficulty: progress.adaptive_difficulty,
            });
        };

        task.completions = task.completions + 1;

        let total_rewards = base_rewards + combo_bonus;

        event::emit(DynamicTaskCompleted {
            user,
            task_id,
            difficulty: task.difficulty,
            category: task.category,
            rewards_earned: total_rewards,
            combo_active,
        });

        total_rewards
    }

    // ===== Seasonal Events =====

    /// Create a new seasonal event
    public entry fun create_seasonal_event(
        season_number: u64,
        theme: String,
        duration_days: u64,
        bonus_multiplier: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        let duration_ms = duration_days * 86400000;

        let event = SeasonalEvent {
            id: object::new(ctx),
            season_number,
            theme,
            start_time: now,
            end_time: now + duration_ms,
            special_tasks: vec_map::empty(),
            season_leaderboard: vec_map::empty(),
            bonus_multiplier,
        };

        transfer::share_object(event);
    }

    /// Add special task to seasonal event
    public fun add_seasonal_task(
        event: &mut SeasonalEvent,
        task_id: u64,
        task: DynamicTask,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        assert!(now < event.end_time, E_SEASON_ENDED);

        vec_map::insert(&mut event.special_tasks, task_id, task);
    }

    // ===== Referral System =====

    /// Register a referral
    public entry fun register_referral(
        system: &mut ReferralSystem,
        referrer: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let referee = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        assert!(!vec_map::contains(&system.referrals, &referee), E_ALREADY_COMPLETED);

        let referral_info = ReferralInfo {
            referrer,
            referred_at: now,
            referrer_bonus_claimed: false,
            referee_bonus_claimed: false,
        };

        vec_map::insert(&mut system.referrals, referee, referral_info);
        system.total_referrals = system.total_referrals + 1;

        event::emit(ReferralRegistered {
            referrer,
            referee,
            bonus_points: 50, // Base referral bonus
        });
    }

    /// Claim referral bonus
    public fun claim_referral_bonus(
        system: &mut ReferralSystem,
        as_referrer: bool,
        ctx: &mut TxContext
    ): u64 {
        let user = tx_context::sender(ctx);
        
        if (as_referrer) {
            // Count unclaimed referrals
            // Simplified - in production, track all referrals per user
            50 // Base bonus per referral
        } else {
            assert!(vec_map::contains(&system.referrals, &user), E_TASK_NOT_FOUND);
            let referral = vec_map::get_mut(&mut system.referrals, &user);
            assert!(!referral.referee_bonus_claimed, E_ALREADY_COMPLETED);
            referral.referee_bonus_claimed = true;
            25 // Welcome bonus for new user
        }
    }

    // ===== User Progress =====

    /// Initialize user progress tracker
    public entry fun init_user_progress(ctx: &mut TxContext) {
        let progress = UserProgress {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            completed_tasks: vec_map::empty(),
            current_combo: 0,
            last_task_time: 0,
            category_completions: vector[0, 0, 0, 0],
            adaptive_difficulty: 1,
        };

        transfer::transfer(progress, tx_context::sender(ctx));
    }

    // ===== View Functions =====
    
    public fun get_user_combo(progress: &UserProgress): u64 {
        progress.current_combo
    }

    public fun get_adaptive_difficulty(progress: &UserProgress): u8 {
        progress.adaptive_difficulty
    }
}
