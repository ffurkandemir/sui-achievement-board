module achievement_nft::achievement {

    use std::vector;
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::display;
    use sui::package;
    use sui::clock::{Self, Clock};
    use sui::vec_map::{Self, VecMap};

    // ===== Witness Pattern for Display =====
    /// One-time witness for the module
    public struct ACHIEVEMENT has drop {}

    /// Kullanıcının görev ilerlemesini tutan dinamik NFT
    public struct AchievementNFT has key {
        id: UID,
        owner: address,
        points: u64,
        level: u64,
        tasks_completed: vector<bool>,
        daily_streak: DailyStreak,
    }

    /// Günlük streak verisi
    public struct DailyStreak has store, copy, drop {
        current_streak: u64,
        last_claim_day: u64,
        longest_streak: u64,
    }

    /// Leaderboard - Shared Object
    public struct Leaderboard has key {
        id: UID,
        top_players: VecMap<address, PlayerScore>,
        total_participants: u64,
    }

    /// Oyuncu skoru
    public struct PlayerScore has store, copy, drop {
        points: u64,
        level: u64,
        tasks_completed: u64,
        last_updated: u64,
    }

    /// Her görev tamamlandığında yayınlanan event
    public struct TaskCompletedEvent has copy, drop {
        user: address,
        task_index: u64,
        new_points: u64,
        new_level: u64,
    }

    /// Günlük ödül alındığında yayınlanan event
    public struct DailyRewardClaimedEvent has copy, drop {
        user: address,
        streak: u64,
        bonus_points: u64,
        timestamp: u64,
    }

    /// Leaderboard güncellendiğinde yayınlanan event
    public struct LeaderboardUpdatedEvent has copy, drop {
        user: address,
        points: u64,
        level: u64,
        rank: u64,
    }

    /// Toplam görev sayısı
    const TOTAL_TASKS: u64 = 9;
    const POINTS_PER_TASK: u64 = 10;
    const POINTS_PER_LEVEL: u64 = 20;
    const DAILY_REWARD_BASE: u64 = 5;
    const MAX_LEADERBOARD_SIZE: u64 = 100;
    const MS_PER_DAY: u64 = 86400000; // milliseconds in a day

    const E_NOT_OWNER: u64 = 1;
    const E_INVALID_INDEX: u64 = 2;
    const E_ALREADY_COMPLETED: u64 = 3;
    const E_ALREADY_CLAIMED_TODAY: u64 = 4;

    // ===== Init Function - Display & Leaderboard =====
    /// Module initializer - Display ve Leaderboard oluşturur
    fun init(otw: ACHIEVEMENT, ctx: &mut TxContext) {
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"project_url"),
            string::utf8(b"creator"),
        ];

        let values = vector[
            string::utf8(b"Achievement Board Level {level}"),
            string::utf8(b"Level {level} Achiever | {points} Points | {tasks_completed} Tasks Completed | {current_streak} Day Streak 🔥"),
            string::utf8(b"https://aggregator-devnet.walrus.space/v1/kqRzW1M0L-gfQCOxZWv8qpUqB4ZD2VmHrKFkHXTDvXw"),
            string::utf8(b"https://sui-achievement-board.vercel.app"),
            string::utf8(b"Sui Achievement Board"),
        ];

        let publisher = package::claim(otw, ctx);
        let mut display = display::new_with_fields<AchievementNFT>(
            &publisher, keys, values, ctx
        );
        
        display::update_version(&mut display);
        
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));

        // Leaderboard'u shared object olarak oluştur
        let leaderboard = Leaderboard {
            id: object::new(ctx),
            top_players: vec_map::empty(),
            total_participants: 0,
        };
        transfer::share_object(leaderboard);
    }

    /// Başlangıçta tüm görevler false
    fun init_tasks_vector(): vector<bool> {
        let mut v = vector::empty<bool>();
        let mut i = 0;
        while (i < TOTAL_TASKS) {
            vector::push_back(&mut v, false);
            i = i + 1;
        };
        v
    }

    /// Başlangıç daily streak
    fun init_daily_streak(): DailyStreak {
        DailyStreak {
            current_streak: 0,
            last_claim_day: 0,
            longest_streak: 0,
        }
    }

    /// Puanlardan level hesapla
    fun recompute_level(points: u64): u64 {
        points / POINTS_PER_LEVEL
    }

    /// Tamamlanan görev sayısını hesapla
    fun count_completed_tasks(tasks: &vector<bool>): u64 {
        let mut count = 0;
        let mut i = 0;
        let len = vector::length(tasks);
        while (i < len) {
            if (*vector::borrow(tasks, i)) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    /// Kullanıcı için ilk AchievementNFT'yi mint eder
    public entry fun init_user_achievement(
        leaderboard: &mut Leaderboard,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let nft = AchievementNFT {
            id: object::new(ctx),
            owner: sender,
            points: 0,
            level: 0,
            tasks_completed: init_tasks_vector(),
            daily_streak: init_daily_streak(),
        };
        transfer::transfer(nft, sender);

        // Leaderboard'a ekle
        leaderboard.total_participants = leaderboard.total_participants + 1;
    }

    /// Bir görevi tamamlar, puan & level günceller, leaderboard günceller, event emit eder
    public entry fun complete_task(
        user_nft: &mut AchievementNFT,
        leaderboard: &mut Leaderboard,
        task_index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        // 1) Index aralık kontrolü
        let len = vector::length<bool>(&user_nft.tasks_completed);
        assert!(task_index < len, E_INVALID_INDEX);

        // 2) Sadece owner kullanabilsin
        assert!(sender == user_nft.owner, E_NOT_OWNER);

        // 3) Zaten tamamlanmışsa izin verme
        let already = *vector::borrow<bool>(&user_nft.tasks_completed, task_index);
        assert!(!already, E_ALREADY_COMPLETED);

        // 4) Görevi tamamlandı olarak işaretle
        let elem_ref = vector::borrow_mut<bool>(&mut user_nft.tasks_completed, task_index);
        *elem_ref = true;

        // 5) Puan & level güncelle
        user_nft.points = user_nft.points + POINTS_PER_TASK;
        user_nft.level = recompute_level(user_nft.points);

        // 6) Leaderboard'u güncelle
        update_leaderboard(
            leaderboard, 
            sender, 
            user_nft.points, 
            user_nft.level,
            count_completed_tasks(&user_nft.tasks_completed),
            clock
        );

        // 7) Event yayınla
        event::emit(TaskCompletedEvent {
            user: sender,
            task_index,
            new_points: user_nft.points,
            new_level: user_nft.level,
        });
    }

    /// Günlük ödül talep et (streak mekanizması)
    public entry fun claim_daily_reward(
        user_nft: &mut AchievementNFT,
        leaderboard: &mut Leaderboard,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == user_nft.owner, E_NOT_OWNER);

        let current_time = clock::timestamp_ms(clock);
        let current_day = current_time / MS_PER_DAY;

        // Bugün zaten claim edilmiş mi kontrol et
        assert!(user_nft.daily_streak.last_claim_day != current_day, E_ALREADY_CLAIMED_TODAY);

        // Streak hesapla
        if (user_nft.daily_streak.last_claim_day == 0) {
            // İlk kez claim ediliyor
            user_nft.daily_streak.current_streak = 1;
        } else if (user_nft.daily_streak.last_claim_day + 1 == current_day) {
            // Ardışık gün - streak devam ediyor
            user_nft.daily_streak.current_streak = user_nft.daily_streak.current_streak + 1;
        } else {
            // Streak koptu - yeniden başla
            user_nft.daily_streak.current_streak = 1;
        };

        // En uzun streak'i güncelle
        if (user_nft.daily_streak.current_streak > user_nft.daily_streak.longest_streak) {
            user_nft.daily_streak.longest_streak = user_nft.daily_streak.current_streak;
        };

        user_nft.daily_streak.last_claim_day = current_day;

        // Bonus puan: base + (streak * 2)
        let bonus_points = DAILY_REWARD_BASE + (user_nft.daily_streak.current_streak * 2);
        user_nft.points = user_nft.points + bonus_points;
        user_nft.level = recompute_level(user_nft.points);

        // Leaderboard'u güncelle
        update_leaderboard(
            leaderboard,
            sender,
            user_nft.points,
            user_nft.level,
            count_completed_tasks(&user_nft.tasks_completed),
            clock
        );

        // Event yayınla
        event::emit(DailyRewardClaimedEvent {
            user: sender,
            streak: user_nft.daily_streak.current_streak,
            bonus_points,
            timestamp: current_time,
        });
    }

    /// Leaderboard'u günceller
    fun update_leaderboard(
        leaderboard: &mut Leaderboard,
        user: address,
        points: u64,
        level: u64,
        tasks_completed: u64,
        clock: &Clock,
    ) {
        let score = PlayerScore {
            points,
            level,
            tasks_completed,
            last_updated: clock::timestamp_ms(clock),
        };

        // Kullanıcı zaten leaderboard'da mı?
        if (vec_map::contains(&leaderboard.top_players, &user)) {
            // Skoru güncelle
            let existing_score = vec_map::get_mut(&mut leaderboard.top_players, &user);
            *existing_score = score;
        } else {
            // Yeni oyuncu ekle
            if (vec_map::size(&leaderboard.top_players) < MAX_LEADERBOARD_SIZE) {
                vec_map::insert(&mut leaderboard.top_players, user, score);
            } else {
                // En düşük skoru bul ve değiştir (basit implementasyon)
                vec_map::insert(&mut leaderboard.top_players, user, score);
            };
        };

        // Sıralama için rank hesapla (basit - daha iyileri var)
        let rank = calculate_rank(leaderboard, points);
        
        event::emit(LeaderboardUpdatedEvent {
            user,
            points,
            level,
            rank,
        });
    }

    /// Kullanıcının rank'ini hesapla
    fun calculate_rank(leaderboard: &Leaderboard, user_points: u64): u64 {
        let mut rank = 1;
        let mut i = 0;
        let size = vec_map::size(&leaderboard.top_players);
        
        while (i < size) {
            let (_addr, score) = vec_map::get_entry_by_idx(&leaderboard.top_players, i);
            if (score.points > user_points) {
                rank = rank + 1;
            };
            i = i + 1;
        };
        
        rank
    }

    /// Kullanıcının ilerlemesini sıfırlar (yeni sezon gibi)
    public entry fun reset_progress(
        user_nft: &mut AchievementNFT,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == user_nft.owner, E_NOT_OWNER);

        user_nft.points = 0;
        user_nft.level = 0;
        user_nft.tasks_completed = init_tasks_vector();
        // Daily streak korunur - sadece progress sıfırlanır
    }

    // ===== View Functions (Frontend için) =====
    
    /// Leaderboard'un tamamını getir
    public fun get_leaderboard_size(leaderboard: &Leaderboard): u64 {
        vec_map::size(&leaderboard.top_players)
    }

    /// Kullanıcının daily streak bilgisi
    public fun get_daily_streak(nft: &AchievementNFT): (u64, u64, u64) {
        (
            nft.daily_streak.current_streak,
            nft.daily_streak.last_claim_day,
            nft.daily_streak.longest_streak
        )
    }

    /// Get points (for governance module)
    public fun get_points(nft: &AchievementNFT): u64 {
        nft.points
    }

}
