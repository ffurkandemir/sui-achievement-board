import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// Fresh deployment - December 7, 2025
const PACKAGE_ID = '0xef282ed351394edef5f3ccfa840ac1c212478ee032f5bcfd95a85a3cd43e9a1a';

const ACHIEVEMENT_TYPE = `${PACKAGE_ID}::achievement::AchievementNFT`;
const CLOCK_OBJECT = '0x6'; // Sui's shared Clock object

// Shared Objects from deployment
const LEADERBOARD_ID = '0x0931f6d8bc3c95cc3fefdd0150067b1ac557aa426012f52136104690982beff1';
const GOVERNANCE_HUB_ID = '0xab60eceadfdeae7328c40c6b8d5a304c4bea47cee21130251a02b49f793e0153';
const STAKING_POOL_ID = '0x62347aa6f923854e22d09ac051eed91a1e716697f82ab523f29b2e2eeb2b153d';
const MARKETPLACE_ID = '0x298d7cad6d7ffb70b56b20c32ea3c48f3b5056b49e438cbfaaf2402223d18c8c';
const TASK_SYSTEM_ID = '0x034436fa831b276f36fd42f7784a21c338d77df8632c933057b13ebb7ed4597f';
const REFERRAL_SYSTEM_ID = '0x0db61ce1d51219b2b12e8e3c0732459a60c11d2a88bffe35d91ee4e6e25dbdb3';

const TASKS = [
  {
    title: 'Profilini oluştur',
    description: 'Cüzdanını bağla ve ilk Achievement NFT’ni mint et.',
  },
  {
    title: 'İlk görevi tamamla',
    description: 'Uygulama içinden bir görevi başarıyla tamamla.',
  },
  {
    title: 'Seri görevci',
    description: 'Tüm görevleri bitir, puan topla ve level atla.',
  },
];

function useUserAchievementNft(ownerAddress: string | null) {
  return useSuiClientQuery(
    'getOwnedObjects',
    (ownerAddress
      ? {
          owner: ownerAddress,
          filter: { StructType: ACHIEVEMENT_TYPE },
          options: { showContent: true },
        }
      : ({} as any)) as any,
    {
      enabled: !!ownerAddress,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: 0,
      gcTime: 0,
      select(data) {
        if (data.data.length === 0) return null;
        
        // Birden fazla NFT varsa en yeni olanı seç (version numarasına göre)
        const sortedObjs = [...data.data].sort((a, b) => {
          const versionA = typeof a.data?.version === 'string' 
            ? parseInt(a.data.version) 
            : (a.data?.version ?? 0);
          const versionB = typeof b.data?.version === 'string'
            ? parseInt(b.data.version)
            : (b.data?.version ?? 0);
          return versionB - versionA; // En yeni önce (büyük version)
        });
        
        // NFT selection - en yeni version'u seç
        
        const obj = sortedObjs[0];
        if (!obj || !obj.data || obj.data.content?.dataType !== 'moveObject') {
          return null;
        }
        const fields = obj.data.content.fields as any;
        // daily_streak bir nested object, fields property'si var
        const dailyStreakObj = fields.daily_streak?.fields || fields.daily_streak || { current_streak: 0, last_claim_day: 0, longest_streak: 0 };
        

        
        return {
          id: obj.data.objectId as string,
          points: Number(fields.points),
          level: Number(fields.level ?? 0),
          tasks_completed: fields.tasks_completed as boolean[],
          daily_streak: {
            current: Number(dailyStreakObj.current_streak ?? 0),
            lastClaimDay: Number(dailyStreakObj.last_claim_day ?? 0),
            longest: Number(dailyStreakObj.longest_streak ?? 0),
          },
        };
      },
    },
  );
}

type AchievementEvent = {
  id: string;
  type: 'task' | 'daily_reward' | 'leaderboard';
  taskIndex?: number;
  streak?: number;
  bonusPoints?: number;
  newPoints: number;
  newLevel?: number;
  timestampMs: number | null;
};

function useAchievementEvents() {
  // Task events
  const taskEvents = useSuiClientQuery(
    'queryEvents',
    {
      query: {
        MoveEventType: `${PACKAGE_ID}::achievement::TaskCompletedEvent`,
      },
      limit: 25,
      order: 'Descending',
    } as any,
    {
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: 0,
      gcTime: 0,
      select(data: any): AchievementEvent[] {
        return data.data.map((ev: any) => {
          const parsed = ev.parsedJson as any;
          return {
            id: `${ev.id.txDigest}:${ev.id.eventSeq}`,
            type: 'task' as const,
            taskIndex: Number(parsed.task_index ?? 0),
            newPoints: Number(parsed.new_points ?? 0),
            newLevel: Number(parsed.new_level ?? 0),
            timestampMs: ev.timestampMs ? Number(ev.timestampMs) : null,
          };
        });
      },
    },
  );

  // Daily reward events
  const dailyEvents = useSuiClientQuery(
    'queryEvents',
    {
      query: {
        MoveEventType: `${PACKAGE_ID}::achievement::DailyRewardClaimedEvent`,
      },
      limit: 25,
      order: 'Descending',
    } as any,
    {
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: 0,
      gcTime: 0,
      select(data: any): AchievementEvent[] {
        return data.data.map((ev: any) => {
          const parsed = ev.parsedJson as any;
          return {
            id: `${ev.id.txDigest}:${ev.id.eventSeq}`,
            type: 'daily_reward' as const,
            streak: Number(parsed.streak ?? 0),
            bonusPoints: Number(parsed.bonus_points ?? 0),
            newPoints: Number(parsed.bonus_points ?? 0),
            timestampMs: ev.timestampMs ? Number(ev.timestampMs) : null,
          };
        });
      },
    },
  );

  // Combine and sort all events
  const allEvents = [
    ...(taskEvents.data || []),
    ...(dailyEvents.data || []),
  ].sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

  return {
    data: allEvents,
    isLoading: taskEvents.isLoading || dailyEvents.isLoading,
    error: taskEvents.error || dailyEvents.error,
    refetch: () => {
      taskEvents.refetch();
      dailyEvents.refetch();
    },
  };
}

// Hook for Leaderboard
function useLeaderboard() {
  return useSuiClientQuery(
    'getObject',
    {
      id: LEADERBOARD_ID,
      options: { showContent: true },
    },
    {
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: 0,
      gcTime: 0,
      select(data: any) {
        // Data is wrapped in {data: {...}}
        const actualData = data.data || data;
        
        if (!actualData || !actualData.content || actualData.content.dataType !== 'moveObject') {
          return [];
        }
        
        const fields = actualData.content.fields as any;
        const topPlayers = fields.top_players?.fields?.contents || [];
        
        return topPlayers.map((entry: any) => ({
          address: entry.fields.key as string,
          points: Number(entry.fields.value?.fields?.points ?? 0),
          level: Number(entry.fields.value?.fields?.level ?? 0),
          tasksCompleted: Number(entry.fields.value?.fields?.tasks_completed ?? 0),
        })).sort((a: any, b: any) => b.points - a.points);
      },
    },
  );
}

function getInitialViewAddress(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const url = new URL(window.location.href);
    const addr = url.searchParams.get('address');
    return addr && addr.length > 0 ? addr : null;
  } catch {
    return null;
  }
}

function formatTime(ts: number | null): string | null {
  if (!ts) {
    return null;
  }
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return null;
  }
}

function App() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();

  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [viewAddress] = useState<string | null>(() => getInitialViewAddress());
  
  // Ayrı loading state'leri
  const [isMinting, setIsMinting] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [completingTaskIndex, setCompletingTaskIndex] = useState<number | null>(null);

  // Yeni özellikler için tab state
  const [activeTab, setActiveTab] = useState<'achievements' | 'governance' | 'tasks' | 'marketplace'>('achievements');
  
  // Governance states
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalCategory, setProposalCategory] = useState(1);
  const [proposalPoints, setProposalPoints] = useState(10);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  
  // Staking states
  const [stakeAmount, setStakeAmount] = useState('10');
  const [isStaking, setIsStaking] = useState(false);
  
  // Marketplace states
  const [sellAmount, setSellAmount] = useState('10');
  const [sellPrice, setSellPrice] = useState('1');
  const [isListing, setIsListing] = useState(false);
  
  // Global data states
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [activeProposals, setActiveProposals] = useState<any[]>([]);
  const [stakingStats, setStakingStats] = useState<any>(null);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(false);

  const effectiveOwner = viewAddress ?? account?.address ?? null;
  const hasLoggedInit = useRef(false);
  const hasLoggedAchievement = useRef<string | null>(null);

  const {
    data: achievement,
    isLoading: achievementLoading,
    refetch: refetchAchievement,
  } = useUserAchievementNft(effectiveOwner);

  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useAchievementEvents();

  const {
    data: leaderboard,
  } = useLeaderboard();

  // Kullanıcının leaderboard'daki puanlarını bul
  const leaderboardPoints = useMemo(() => {
    if (!effectiveOwner || !leaderboard) return null;
    const userEntry = leaderboard.find(
      (entry: any) => entry.address.toLowerCase() === effectiveOwner.toLowerCase()
    );
    return userEntry || null;
  }, [effectiveOwner, leaderboard]);

  // Initialization logging (only once)
  useEffect(() => {
    if (!hasLoggedInit.current) {
      console.log('%c🚀 Sui Achievement Board', 'font-size: 20px; font-weight: bold; color: #4f46e5;');
      console.table({
        'Package ID': PACKAGE_ID,
        'Leaderboard ID': LEADERBOARD_ID,
        'Governance Hub': GOVERNANCE_HUB_ID,
        'Staking Pool': STAKING_POOL_ID,
        'Marketplace': MARKETPLACE_ID,
        'Task System': TASK_SYSTEM_ID,
        'Referral System': REFERRAL_SYSTEM_ID,
      });
      console.log(`%c👤 Wallet: ${effectiveOwner || 'Not connected'}`, effectiveOwner ? 'color: #10b981; font-weight: bold;' : 'color: #6b7280;');
      console.log(`%c🔗 Network: Sui Testnet`, 'color: #06b6d4;');
      console.log(`%c✨ New Features: Governance, Dynamic Tasks, Marketplace`, 'color: #f59e0b; font-style: italic;');
      hasLoggedInit.current = true;
    }
  }, [effectiveOwner, account]);

  // Log achievement data when it changes (only once per achievement)
  useEffect(() => {
    if (achievement && hasLoggedAchievement.current !== achievement.id) {
      const completedTasks = achievement.tasks_completed.filter(Boolean).length;
      console.log('%c📊 Achievement NFT Loaded', 'font-size: 16px; font-weight: bold; color: #8b5cf6;');
      console.table({
        'NFT ID': achievement.id.slice(0, 20) + '...',
        '💰 Points': achievement.points,
        '⭐ Level': achievement.level,
        '✅ Tasks': completedTasks + '/3',
        '🔥 Streak': achievement.daily_streak.current + ' days',
        '🏆 Best Streak': achievement.daily_streak.longest + ' days',
      });
      
      // Achievement milestones
      if (achievement.points >= 100) {
        console.log('%c🎉 Milestone: 100+ Points!', 'color: #f59e0b; font-weight: bold;');
      }
      if (achievement.daily_streak.current >= 7) {
        console.log('%c🔥 Milestone: 7-Day Streak!', 'color: #ef4444; font-weight: bold;');
      }
      if (completedTasks === 3) {
        console.log('%c✨ All Tasks Completed!', 'color: #10b981; font-weight: bold;');
      }
      
      hasLoggedAchievement.current = achievement.id;
    }
  }, [achievement]);

  // Load proposals fonksiyonunu useCallback ile tanımla - dışarıdan erişilebilir
  const loadProposals = useCallback(async () => {
    try {
      const govObj = await client.getObject({ 
        id: GOVERNANCE_HUB_ID, 
        options: { showContent: true }
      });
      
      if (govObj.data?.content && 'fields' in govObj.data.content) {
        const govFields = govObj.data.content.fields as any;
        const proposalsContents = govFields.proposals?.fields?.contents || [];
        
        const proposals = proposalsContents.map((p: any) => {
          const pFields = p.fields?.value?.fields || p.fields || p;
          return {
            id: pFields.id || 'unknown',
            title: pFields.title || 'Untitled',
            description: pFields.description || '',
            votes_for: Number(pFields.votes_for || 0),
            votes_against: Number(pFields.votes_against || 0),
            reward_points: Number(pFields.reward_points || 0),
            difficulty: Number(pFields.difficulty || 1),
            proposer: pFields.proposer || '',
            executed: pFields.executed || false,
            ends_at: Number(pFields.ends_at || 0),
            created_at: Number(pFields.created_at || 0)
          };
        });
        setActiveProposals(proposals);
        console.log(`📋 Auto-loaded ${proposals.length} proposals`);
      }
    } catch (err) {
      console.error('❌ Failed to auto-load proposals:', err);
    }
  }, [client]);

  // Load leaderboard fonksiyonunu useCallback ile tanımla - dışarıdan erişilebilir
  const loadLeaderboard = useCallback(async () => {
    try {
      const obj = await client.getObject({
        id: LEADERBOARD_ID,
        options: { showContent: true }
      });
      
      if (obj.data?.content && 'fields' in obj.data.content) {
        const fields = obj.data.content.fields as any;
        const topPlayersContents = fields.top_players?.fields?.contents || [];
        
        if (Array.isArray(topPlayersContents)) {
          const players = topPlayersContents.map((entry: any) => {
            const entryFields = entry.fields || entry;
            return {
              address: entryFields.key || '',
              points: Number(entryFields.value?.fields?.points || entryFields.value || 0),
              level: Number(entryFields.value?.fields?.level || 0),
              tasks_completed: Number(entryFields.value?.fields?.tasks_completed || 0)
            };
          });
          players.sort((a: any, b: any) => b.points - a.points);
          setLeaderboardData(players);
          console.log(`🏆 Auto-loaded ${players.length} players in leaderboard`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to auto-load leaderboard:', err);
    }
  }, [client]);

  // Auto-load leaderboard and proposals when wallet connects
  useEffect(() => {
    if (account?.address) {
      const loadMarketplace = async () => {
        try {
          const marketObj = await client.getObject({ 
            id: MARKETPLACE_ID, 
            options: { showContent: true }
          });
          
          if (marketObj.data?.content && 'fields' in marketObj.data.content) {
            const marketFields = marketObj.data.content.fields as any;
            const listingsContents = marketFields.listings?.fields?.contents || [];
            
            const listings = listingsContents.map((entry: any) => {
              const lFields = entry.fields?.value?.fields || entry.fields || entry;
              return {
                id: lFields.id || 'unknown',
                seller: lFields.seller || 'Unknown',
                points_amount: Number(lFields.points_amount || 0),
                sui_price: Number(lFields.sui_price || 0),
                active: lFields.active || false
              };
            });
            setMarketplaceListings(listings);
            console.log(`🛒 Auto-loaded ${listings.length} marketplace listings`);
          }
        } catch (err) {
          console.error('❌ Failed to auto-load marketplace:', err);
        }
      };
      
      loadLeaderboard();
      loadProposals();
      loadMarketplace();
    }
  }, [account?.address]);

  const isOwner =
    !!account &&
    !!effectiveOwner &&
    account.address.toLowerCase() === effectiveOwner.toLowerCase();

  // Reserved points sistemi - localStorage'dan stake edilen ve listelenen puanları oku
  const getReservedPoints = useCallback(() => {
    if (!account?.address) return { staked: 0, listed: 0, voted: 0 };
    try {
      const key = `reserved_${account.address}`;
      const stored = localStorage.getItem(key);
      if (!stored) return { staked: 0, listed: 0, voted: 0 };
      return JSON.parse(stored);
    } catch {
      return { staked: 0, listed: 0, voted: 0 };
    }
  }, [account?.address]);

  const setReservedPoints = useCallback((data: { staked: number; listed: number; voted: number }) => {
    if (!account?.address) return;
    try {
      const key = `reserved_${account.address}`;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save reserved points:', err);
    }
  }, [account?.address]);

  // Reserved points'i memoize et - sadece account veya achievement değişince yeniden hesapla
  const reserved = useMemo(() => getReservedPoints(), [getReservedPoints]);
  
  // Efektif puanlar: Leaderboard'da varsa oradan, yoksa NFT'den, SONRA reserve edilenleri düş
  const totalPoints = leaderboardPoints?.points ?? achievement?.points ?? 0;
  const reservedTotal = reserved.staked + reserved.listed + reserved.voted;
  const effectivePoints = Math.max(0, totalPoints - reservedTotal);
  const effectiveLevel = leaderboardPoints?.level ?? achievement?.level ?? 0;
  
  // Console log sadece değerler değiştiğinde
  useEffect(() => {
    if (account?.address) {
      console.log(`%c💰 Points Status`, 'color: #fbbf24; font-weight: bold;');
      console.log(`Total: ${totalPoints} | Reserved: ${reservedTotal} (Staked: ${reserved.staked}, Listed: ${reserved.listed}, Voted: ${reserved.voted}) | Available: ${effectivePoints}`);
      if (reservedTotal > 0) {
        console.log(`%c⚠️ Reserved Points Info`, 'color: #f59e0b; font-weight: bold;');
        console.log('Reserved points are tracked in browser localStorage. Clearing browser data will reset this tracking.');
        console.log('Note: Blockchain points are NOT actually deducted - this is a frontend-only reservation system.');
      }
    }
  }, [account?.address, totalPoints, reservedTotal, effectivePoints]);

  const completedCount =
    achievement?.tasks_completed.filter((x) => x).length ?? 0;
  const totalTasks = achievement?.tasks_completed.length ?? 0;
  const progress =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Bugünün günü (timestamp'i güne çevir - smart contract ile aynı hesaplama)
  const getCurrentDay = () => {
    return Math.floor(Date.now() / 86400000); // milliseconds to days
  };

  // Bugün zaten claim edilmiş mi?
  const canClaimToday = achievement 
    ? (() => {
        const currentDay = getCurrentDay();
        const lastClaimDay = achievement.daily_streak.lastClaimDay;
        // Eğer lastClaimDay 0 ise hiç claim edilmemiş demektir
        // Eğer lastClaimDay < currentDay ise bugün claim edilmemiş demektir
        const canClaim = lastClaimDay === 0 || lastClaimDay < currentDay;
        

        
        return canClaim;
      })()
    : false;

  async function handleInitAchievement() {
    if (!account) {
      setError('Önce cüzdan bağla.');
      return;
    }
    if (!isOwner) {
      setError('Bu board sana ait değil, sadece sahibi mint edebilir.');
      return;
    }
    setError(null);
    setTxDigest(null);
    setIsMinting(true);

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::achievement::init_user_achievement`,
        arguments: [tx.object(LEADERBOARD_ID)],
      });

      await signAndExecuteTransaction(
        {
          transaction: tx,
          chain: 'sui:testnet',
        },
        {
          onSuccess(res) {
            console.log('✅ Transaction successful:', res.digest);
            setTxDigest(res.digest);
            client
              .waitForTransaction({ digest: res.digest })
              .then(() => {
                console.log('✅ NFT minted successfully!');
                refetchAchievement();
                refetchEvents();
              })
              .catch((waitErr) => {
                console.error('❌ Error waiting for transaction:', waitErr);
                setError(`Transaction beklenirken hata: ${waitErr}`);
              })
              .finally(() => setIsMinting(false));
          },
          onError(err) {
            console.error('❌ Transaction failed:', err);
            setError(`Transaction hatası: ${String(err)}`);
            setIsMinting(false);
          },
        },
      );
    } catch (err) {
      console.error('❌ Error creating transaction:', err);
      setError(`Hata: ${String(err)}`);
      setIsMinting(false);
    }
  }

  async function handleCompleteTask(index: number) {
    if (!account) {
      setError('Önce cüzdan bağla.');
      return;
    }
    if (!isOwner) {
      setError('Read-only moddasın, bu board sana ait değil.');
      return;
    }
    if (!achievement) {
      setError('Önce NFT mint et.');
      return;
    }
    setError(null);
    setTxDigest(null);
    setCompletingTaskIndex(index);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::achievement::complete_task`,
      arguments: [
        tx.object(achievement.id),
        tx.object(LEADERBOARD_ID),
        tx.pure.u64(index),
        tx.object(CLOCK_OBJECT),
      ],
    });

    await signAndExecuteTransaction(
      {
        transaction: tx,
        chain: 'sui:testnet',
      },
      {
        onSuccess(res) {
          setTxDigest(res.digest);
          client
            .waitForTransaction({ digest: res.digest })
            .then(() => {
              refetchAchievement();
              refetchEvents();
              loadLeaderboard();
            })
            .catch(console.error);
        },
        onError(err) {
          console.error(err);
          setError(String(err));
        },
      },
    );
  }

  async function handleReset() {
    if (!account) {
      setError('Önce cüzdan bağla.');
      return;
    }
    if (!isOwner) {
      setError('Read-only moddasın, bu board sana ait değil.');
      return;
    }
    if (!achievement) {
      setError('Önce NFT mint et.');
      return;
    }
    setError(null);
    setTxDigest(null);
    setIsResetting(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::achievement::reset_progress`,
      arguments: [tx.object(achievement.id)],
    });

    await signAndExecuteTransaction(
      {
        transaction: tx,
        chain: 'sui:testnet',
      },
      {
        onSuccess(res) {
          setTxDigest(res.digest);
          client
            .waitForTransaction({ digest: res.digest })
            .then(() => {
              refetchAchievement();
              refetchEvents();
              loadLeaderboard();
            })
            .catch(console.error);
        },
        onError(err) {
          console.error(err);
          setError(String(err));
        },
      },
    );
  }

  async function handleClaimDailyReward() {
    if (!account) {
      setError('Önce cüzdan bağla.');
      return;
    }
    if (!isOwner) {
      setError('Read-only moddasın, bu board sana ait değil.');
      return;
    }
    if (!achievement) {
      setError('Önce NFT mint et.');
      return;
    }
    if (!canClaimToday) {
      setError('Bugün zaten ödülünü aldın! Yarın tekrar dene. 🕐');
      return;
    }
    setError(null);
    setTxDigest(null);
    setIsClaimingDaily(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::achievement::claim_daily_reward`,
      arguments: [
        tx.object(achievement.id),
        tx.object(LEADERBOARD_ID),
        tx.object(CLOCK_OBJECT),
      ],
    });

    await signAndExecuteTransaction(
      {
        transaction: tx,
        chain: 'sui:testnet',
      },
      {
        onSuccess(res) {
          console.log('✅ Daily reward claimed! Digest:', res.digest);
          setTxDigest(res.digest);
          client
            .waitForTransaction({ digest: res.digest })
            .then(() => {
              console.log('✅ Transaction finalized, refreshing data...');
              // Biraz bekle ve sonra refresh et
              setTimeout(() => {
                refetchAchievement();
                refetchEvents();
                loadLeaderboard();
                console.log('✅ Data refreshed!');
                setIsClaimingDaily(false);
              }, 1500);
            })
            .catch((waitErr) => {
              console.error('❌ Error waiting for transaction:', waitErr);
              // Yine de refresh dene
              refetchAchievement();
              refetchEvents();
              loadLeaderboard();
              setIsClaimingDaily(false);
            });
        },
        onError(err) {
          console.error('❌ Transaction failed:', err);
          const errStr = String(err);
          // Error code 4 = E_ALREADY_CLAIMED_TODAY
          if (errStr.includes('MoveAbort') && errStr.includes(', 4)')) {
            setError('❌ Bugün zaten ödülünü aldın! Her 24 saatte bir claim edebilirsin.');
          } else {
            setError(errStr);
          }
          setIsClaimingDaily(false);
        },
      },
    );
  }

  async function handleShare() {
    if (!effectiveOwner) {
      setError('Önce bir board sahibi ol veya bağlan.');
      return;
    }
    if (typeof window === 'undefined') {
      setError('Bu ortamda link oluşturulamıyor.');
      return;
    }

    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set('address', effectiveOwner);
    const urlStr = url.toString();
    setShareUrl(urlStr);

    const hasClipboard =
      typeof navigator !== 'undefined' && !!navigator.clipboard;

    if (!hasClipboard) {
      setError(
        'Tarayıcın otomatik kopyalamayı desteklemiyor, aşağıdaki linki elle kopyalayabilirsin.',
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(urlStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      setError(
        'Link panoya yazılamadı, aşağıdaki linki elle kopyalayabilirsin.',
      );
    }
  }

  function renderAddressInfo() {
    if (!effectiveOwner) {
      return (
        <p>
          Cüzdan bağlayarak kendi board&apos;unu oluşturabilir veya URL&apos;ye{' '}
          <code>?address=0x...</code> ekleyerek bir başkasının board&apos;unu
          görüntüleyebilirsin.
        </p>
      );
    }

    return (
      <p>
        Görüntülenen adres:{' '}
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {effectiveOwner}
        </span>
        {isOwner ? (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#22c55e' }}>
            (Bu sensin 🎉)
          </span>
        ) : (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#38bdf8' }}>
            (Read-only mod)
          </span>
        )}
      </p>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '12px',
        fontFamily: 'system-ui, sans-serif',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#e5e7eb',
      }}
    >
      <style>{`
        @media (min-width: 768px) {
          .responsive-container { padding: 24px !important; }
          .responsive-header { flex-direction: row !important; }
          .responsive-title { font-size: 28px !important; }
          .responsive-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important; }
          .responsive-card { padding: 16px !important; }
        }
        @media (max-width: 767px) {
          .responsive-header { flex-direction: column !important; gap: 12px !important; text-align: center !important; }
          .responsive-title { font-size: 22px !important; }
          .responsive-grid { grid-template-columns: 1fr !important; }
          .responsive-card { padding: 12px !important; }
          button { font-size: 14px !important; padding: 8px 16px !important; }
        }
      `}</style>
      <header
        className="responsive-header"
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="responsive-title" style={{ fontSize: 28, margin: 0, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sui Achievement Board 🏆</h1>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            Görevlerini tamamla, puan topla, level atla.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ConnectButton />
          {effectiveOwner && (
            <button
              onClick={handleShare}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #4b5563',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Paylaşılabilir Link 🔗
            </button>
          )}
          {copied && (
            <span style={{ fontSize: 11, color: '#22c55e' }}>
              Link panoya kopyalandı!
            </span>
          )}
        </div>
      </header>

      <section
        className="responsive-card"
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 1px rgba(96, 165, 250, 0.3)',
          border: '1px solid rgba(96, 165, 250, 0.1)',
        }}
      >
        {renderAddressInfo()}

        {shareUrl && (
          <div
            style={{
              fontSize: 12,
              background: '#020617',
              borderRadius: 8,
              padding: 8,
              border: '1px solid #1f2937',
            }}
          >
            <div style={{ opacity: 0.8, marginBottom: 4 }}>
              Paylaşılabilir link (elle kopyalayabilirsin):
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {shareUrl}
            </div>
          </div>
        )}

        {effectiveOwner && !isOwner && (
          <div
            style={{
              fontSize: 12,
              padding: 8,
              borderRadius: 8,
              background: '#022c22',
              color: '#6ee7b7',
            }}
          >
            Bu board read-only modda görüntüleniyor. Görevleri sadece
            board&apos;un sahibi tamamlayabilir.
          </div>
        )}

        {/* Tab Navigation */}
        {achievement && (
          <div className="responsive-grid" style={{ display: 'flex', gap: 8, borderBottom: '2px solid rgba(99,102,241,0.2)', paddingBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                console.log('%c🏆 Achievements Tab', 'background: #4f46e5; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
                setActiveTab('achievements');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '12px 12px 0 0',
                border: 'none',
                background: activeTab === 'achievements' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(31,41,55,0.8)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'achievements' ? 600 : 400,
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'achievements' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              🏆 Achievements
            </button>
            <button
              onClick={() => {
                console.log('%c🏛️ Governance Tab', 'background: #8b5cf6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
                setActiveTab('governance');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '12px 12px 0 0',
                border: 'none',
                background: activeTab === 'governance' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(31,41,55,0.8)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'governance' ? 600 : 400,
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'governance' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              🏛️ Governance
            </button>
            <button
              onClick={() => {
                console.log('%c🎯 Dynamic Tasks Tab', 'background: #06b6d4; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
                setActiveTab('tasks');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '12px 12px 0 0',
                border: 'none',
                background: activeTab === 'tasks' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(31,41,55,0.8)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'tasks' ? 600 : 400,
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'tasks' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              🎯 Dynamic Tasks
            </button>
            <button
              onClick={() => {
                console.log('%c🛒 Marketplace Tab', 'background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
                setActiveTab('marketplace');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '12px 12px 0 0',
                border: 'none',
                background: activeTab === 'marketplace' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(31,41,55,0.8)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'marketplace' ? 600 : 400,
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'marketplace' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              🛒 Marketplace
            </button>
          </div>
        )}

        {effectiveOwner && account && !achievement && !achievementLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: '#1f2937', borderRadius: 12, border: '1px solid #374151' }}>
            <div style={{ fontSize: 14, color: '#fbbf24' }}>
              ⚠️ <strong>Yeni Kontrat Versiyonu</strong>
            </div>
            <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.5 }}>
              Kontrat güncellendiği için yeni bir Achievement NFT mint etmeniz gerekiyor.
              Mint ettikten sonra tüm özellikler (Governance, Staking, Marketplace) kullanılabilir olacak.
            </div>
            {isOwner ? (
              <button
                onClick={handleInitAchievement}
                disabled={isMinting}
                style={{
                  padding: '12px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  cursor: isMinting ? 'wait' : 'pointer',
                  alignSelf: 'flex-start',
                  opacity: isMinting ? 0.7 : 1,
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: '0 6px 20px rgba(99,102,241,0.5)',
                  transition: 'all 0.3s ease',
                }}
              >
                {isMinting ? '⏳ Mint Ediliyor...' : '🎯 Yeni NFT Mint Et'}
              </button>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af' }}>Bu adreste henüz Achievement NFT yok.</p>
            )}
          </div>
        )}

        {achievementLoading && (
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            NFT bilgileri yükleniyor...
          </p>
        )}

        {achievement && activeTab === 'achievements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* NFT Card Visualization */}
            <div
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 16,
                padding: 24,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(102, 126, 234, 0.3)',
              }}
            >
              {/* Background pattern */}
              <div
                style={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  filter: 'blur(40px)',
                }}
              />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
                      Level {effectiveLevel} Achiever
                    </div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                      Achievement NFT
                    </div>
                    {leaderboardPoints && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                        🏆 Leaderboard Rank: #{leaderboard?.findIndex((e: any) => e.address.toLowerCase() === effectiveOwner?.toLowerCase()) + 1 || '?'}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: 12,
                      padding: '8px 16px',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    🏆
                  </div>
                </div>
                
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))', borderRadius: 12, padding: 12, border: '1px solid rgba(96,165,250,0.3)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      {reservedTotal > 0 ? 'Available Points' : 'Points'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa' }}>{effectivePoints}</div>
                    {reservedTotal > 0 && (
                      <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.8)', marginTop: 2 }}>
                        🔒 {reservedTotal} reserved
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.2))', borderRadius: 12, padding: 12, border: '1px solid rgba(251,191,36,0.3)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Streak</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>{achievement.daily_streak.current} 🔥</div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(139,92,246,0.2))', borderRadius: 12, padding: 12, border: '1px solid rgba(167,139,250,0.3)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Best</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#a78bfa' }}>{achievement.daily_streak.longest} 🌟</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: 14, opacity: 0.8 }}>NFT ID</div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  wordBreak: 'break-all',
                }}
              >
                {achievement.id}
              </div>
            </div>

            <div>
              <strong>Puan: </strong>
              {effectivePoints}
              {reservedTotal > 0 && (
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>
                  (Toplam: {totalPoints}, Ayrılmış: {reservedTotal})
                </span>
              )}
            </div>
            <div>
              <strong>Seviye: </strong>
              {achievement.level}
            </div>
            <div>
              <strong>İlerleme: </strong>
              {completedCount} / {totalTasks}
            </div>
            <div
              style={{
                marginTop: 4,
                width: '100%',
                height: 8,
                borderRadius: 999,
                background: '#1f2937',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: '#22c55e',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Daily Streak Section */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                background: '#1a1f2e',
                border: '1px solid #2d3748',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    🔥 Günlük Streak
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    Her gün giriş yap, bonus puan kazan!
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={handleClaimDailyReward}
                    disabled={isClaimingDaily || !canClaimToday}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 999,
                      border: 'none',
                      background: canClaimToday ? 'linear-gradient(90deg, #f59e0b, #d97706)' : '#4b5563',
                      color: 'white',
                      cursor: canClaimToday && !isClaimingDaily ? 'pointer' : 'not-allowed',
                      fontSize: 14,
                      fontWeight: 600,
                      opacity: canClaimToday && !isClaimingDaily ? 1 : 0.5,
                      transition: 'all 0.3s ease',
                      boxShadow: canClaimToday ? '0 4px 12px rgba(245,158,11,0.4)' : 'none',
                    }}
                  >
                    {isClaimingDaily 
                      ? '⏳ Gönderiliyor...' 
                      : canClaimToday 
                        ? '✨ Günlük Ödül Al' 
                        : '✅ Bugün Alındı'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Mevcut Streak
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {achievement.daily_streak.current} gün
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    En Uzun Streak
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {achievement.daily_streak.longest} gün
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Bugünkü Bonus
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                    +{5 + achievement.daily_streak.current * 2} puan
                  </div>
                </div>
              </div>
              {!canClaimToday && isOwner && (
                <div style={{ 
                  fontSize: 12, 
                  color: '#10b981', 
                  marginTop: 8,
                  padding: 8,
                  background: '#064e3b',
                  borderRadius: 6,
                }}>
                  ✅ Bugünkü ödülünü aldın! Yarın tekrar gelebilirsin.
                </div>
              )}
              {canClaimToday && isOwner && (
                <div style={{ 
                  fontSize: 12, 
                  color: '#fbbf24', 
                  marginTop: 8,
                  padding: 8,
                  background: '#451a03',
                  borderRadius: 6,
                }}>
                  ⏰ Günlük ödülün hazır! Tıkla ve bonus puanını al.
                </div>
              )}
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginTop: 8 }}>
              {achievement.tasks_completed.map((done, idx) => {
                const taskMeta =
                  TASKS[idx] ?? {
                    title: `Görev ${idx + 1}`,
                    description: '',
                  };

                return (
                  <button
                    key={idx}
                    onClick={() => handleCompleteTask(idx)}
                    disabled={done || completingTaskIndex === idx || !isOwner}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: done ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(75,85,99,0.5)',
                      background: done ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.2))' : 'linear-gradient(135deg, rgba(17,24,39,0.8), rgba(31,41,55,0.8))',
                      color: 'white',
                      cursor:
                        done || !isOwner ? 'default' : ('pointer' as const),
                      fontSize: 14,
                      textAlign: 'left',
                      opacity: !isOwner && !done ? 0.7 : 1,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {taskMeta.title} {done ? '✅' : ''}
                    </div>
                    {taskMeta.description && (
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.8,
                          marginTop: 2,
                        }}
                      >
                        {taskMeta.description}
                      </div>
                    )}
                    {!done && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          marginTop: 4,
                        }}
                      >
                        +10 puan
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {isOwner && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                style={{
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid #f97316',
                  background: '#111827',
                  color: '#f97316',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                İlerlemeyi Sıfırla 🔄
              </button>
            )}

            {/* Activity feed her zaman görünsün */}
            <div
          style={{
            marginTop: 8,
            borderTop: '1px solid #1f2937',
            paddingTop: 10,
          }}
        >
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>
            Son görev aktiviteleri
          </h2>

          {eventsLoading && (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Eventler yükleniyor...</p>
          )}

          {!eventsLoading && eventsError && (
            <p style={{ fontSize: 12, opacity: 0.8, color: '#f97373' }}>
              Eventler alınırken bir hata oluştu (RPC veya ağ sorunu). Görevler
              yine de çalışıyor, sadece geçmiş liste şu an gösterilemiyor.
            </p>
          )}

          {!eventsLoading &&
            !eventsError &&
            (!events || events.length === 0) && (
              <p style={{ fontSize: 12, opacity: 0.8 }}>
                Henüz görev aktivitesi yok. Görev butonlarına tıkladığında
                burada görünecek.
              </p>
            )}

          {!eventsLoading && !eventsError && events && events.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                fontSize: 12,
              }}
            >
              {events.map((e) => (
                <li
                  key={e.id}
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border: '1px solid #1f2937',
                    marginBottom: 4,
                    background: '#020617',
                  }}
                >
                  <div>
                    {e.type === 'task' && (
                      <>
                        🎯 Görev {(e.taskIndex ?? 0) + 1} tamamlandı — {e.newPoints} puan
                        {e.newLevel !== undefined && `, seviye ${e.newLevel}`}
                      </>
                    )}
                    {e.type === 'daily_reward' && (
                      <>
                        🔥 Günlük ödül alındı — +{e.bonusPoints} puan (Streak: {e.streak} gün)
                      </>
                    )}
                  </div>
                  {formatTime(e.timestampMs) && (
                    <div style={{ opacity: 0.7, marginTop: 2 }}>
                      {formatTime(e.timestampMs)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
            </div>
          </div>
        )}

        {/* Governance Tab */}
        {achievement && activeTab === 'governance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>🏛️ Governance & DAO</h2>
            
            {/* Staking Section */}
            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>💎 Stake Points</h3>
              <div style={{ fontSize: 13, marginBottom: 12, padding: 10, background: '#020617', borderRadius: 6 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#10b981' }}>📊 Mevcut Puanınız:</strong> <span style={{ fontSize: 16, fontWeight: 'bold', color: '#fbbf24' }}>{effectivePoints}</span>
                </div>
                <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
                  💰 Stake ederek günlük %5 kazanç elde edin<br/>
                  ⚠️ Minimum stake miktarı: 10 puan<br/>
                  🔒 Stake edilen puanlar virtual olarak kilitlenir<br/>
                  <span style={{ fontSize: 11, color: '#fbbf24', marginTop: 4, display: 'block' }}>
                    ⚡ Not: Reserved puan takibi tarayıcınızda saklanır
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>💰 Stake Miktarı (puan)</label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="10"
                    min="10"
                    max={effectivePoints}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(96,165,250,0.3)',
                      background: 'rgba(2,6,23,0.8)',
                      color: '#e5e7eb',
                      fontSize: 14,
                      width: 140,
                    }}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!account) {
                      console.log('%c❌ Access Denied', 'color: #ef4444; font-weight: bold;', 'Wallet not connected');
                      setError('❌ Lütfen önce cüzdanınızı bağlayın!');
                      return;
                    }
                    const amount = parseInt(stakeAmount);
                    if (amount < 10) {
                      setError('❌ Minimum stake miktarı 10 puandır!');
                      return;
                    }
                    if (effectivePoints < amount) {
                      setError(`❌ Yeterli puanınız yok! Mevcut: ${effectivePoints}, İstenen: ${amount}`);
                      console.log('%c❌ Insufficient Points', 'color: #ef4444; font-weight: bold;', `Have: ${effectivePoints}, Need: ${amount}`);
                      return;
                    }
                    console.group('%c💰 Staking Points', 'font-size: 14px; font-weight: bold; color: #10b981;');
                    console.log(`%cAmount: ${stakeAmount} points`, 'color: #06b6d4;');
                    console.log(`Pool: ${STAKING_POOL_ID.slice(0, 20)}...`);
                    setIsStaking(true);
                    setError(null);
                    try {
                      const tx = new Transaction();
                      tx.moveCall({
                        target: `${PACKAGE_ID}::governance::stake_points`,
                        arguments: [
                          tx.object(STAKING_POOL_ID),
                          tx.pure.u64(parseInt(stakeAmount)),
                          tx.object(CLOCK_OBJECT),
                        ],
                      });
                      console.log('%c📤 Signing...', 'color: #f59e0b;');
                      const res = await signAndExecuteTransaction({ transaction: tx, chain: 'sui:testnet' });
                      console.log('%c✅ Staking Sent', 'color: #10b981; font-weight: bold;');
                      console.log(`🔗 https://suiscan.xyz/testnet/tx/${res.digest}`);
                      setTxDigest(res.digest);
                      await client.waitForTransaction({ digest: res.digest });
                      console.log('%c✅ Confirmed!', 'color: #10b981; font-weight: bold;');
                      
                      // Reserved points'i güncelle
                      const currentReserved = getReservedPoints();
                      setReservedPoints({
                        ...currentReserved,
                        staked: currentReserved.staked + amount
                      });
                      console.log(`%c🔒 Reserved Points Updated`, 'color: #8b5cf6; font-weight: bold;', `+${amount} staked`);
                      
                      console.groupEnd();
                      refetchAchievement();
                    } catch (err) {
                      console.error('%c❌ Staking Failed', 'color: #ef4444; font-weight: bold;', err);
                      console.groupEnd();
                      const errStr = String(err);
                      if (errStr.includes('InsufficientFunds')) {
                        setError('❌ Yeterli point yok!');
                      } else if (errStr.includes('MoveAbort')) {
                        const match = errStr.match(/MoveAbort.*?, (\d+)\)/);
                        const code = match ? match[1] : 'unknown';
                        setError(`❌ Staking hatası (kod: ${code}): ${errStr}`);
                      } else {
                        setError(`❌ Staking error: ${errStr}`);
                      }
                    } finally {
                      setIsStaking(false);
                    }
                  }}
                  disabled={isStaking || !account}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#10b981',
                    color: 'white',
                    cursor: isStaking || !account ? 'not-allowed' : 'pointer',
                    opacity: isStaking || !account ? 0.5 : 1,
                  }}
                >
                  {isStaking ? 'Staking...' : 'Stake Points'}
                </button>
              </div>
            </div>

            {/* Create Proposal Section */}
            <div style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.9), rgba(31,41,55,0.9))', padding: 20, borderRadius: 16, border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <h3 style={{ fontSize: 18, marginBottom: 12, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>📝 Create Proposal</h3>
              <div style={{ fontSize: 13, marginBottom: 12, padding: 10, background: '#020617', borderRadius: 6 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#10b981' }}>📊 Mevcut Puanınız:</strong> <span style={{ fontSize: 16, fontWeight: 'bold', color: '#fbbf24' }}>{effectivePoints}</span>
                </div>
                <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
                  🗳️ Topluluk için yeni görev önerileri oluşturun<br/>
                  💰 Gereksinim: 10 puan (proposal oluşturma ücreti)<br/>
                  ⏱️ Oylama süresi: 7 gün<br/>
                  ✅ Kabul eşiği: %70 evet oyu
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>📝 Başlık</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder="Örn: Yeni Daily Challenge Görevi"
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(96,165,250,0.3)',
                      background: 'rgba(2,6,23,0.8)',
                      color: '#e5e7eb',
                      fontSize: 14,
                      transition: 'all 0.3s ease',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>💬 Açıklama</label>
                  <textarea
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    placeholder="Görevin detaylı açıklamasını yazın..."
                    rows={3}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(96,165,250,0.3)',
                      background: 'rgba(2,6,23,0.8)',
                      color: '#e5e7eb',
                      fontSize: 14,
                      resize: 'vertical',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={proposalCategory}
                    onChange={(e) => setProposalCategory(parseInt(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #374151',
                      background: '#020617',
                      color: '#e5e7eb',
                      fontSize: 14,
                    }}
                  >
                    <option value={1}>Builder</option>
                    <option value={2}>Social</option>
                    <option value={3}>Explorer</option>
                    <option value={4}>Creator</option>
                  </select>
                  <input
                    type="number"
                    value={proposalPoints}
                    onChange={(e) => setProposalPoints(parseInt(e.target.value))}
                    placeholder="Points (min: 10)"
                    min="10"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #374151',
                      background: '#020617',
                      color: '#e5e7eb',
                      fontSize: 14,
                      width: 100,
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!account) {
                        console.log('%c❌ Access Denied', 'color: #ef4444; font-weight: bold;', 'Wallet not connected');
                        setError('❌ Lütfen önce cüzdanınızı bağlayın!');
                        return;
                      }
                      if (effectivePoints < 10) {
                        setError(`❌ Proposal oluşturmak için en az 10 puana ihtiyacınız var! Mevcut: ${effectivePoints}`);
                        console.log('%c❌ Insufficient Points', 'color: #ef4444; font-weight: bold;', `Have: ${effectivePoints}, Need: 10`);
                        return;
                      }
                      if (!proposalTitle.trim() || !proposalDescription.trim()) {
                        setError('❌ Başlık ve açıklama alanları zorunludur!');
                        return;
                      }
                      console.group('%c📝 Creating Proposal', 'font-size: 14px; font-weight: bold; color: #8b5cf6;');
                      console.log(`%cTitle: "${proposalTitle}"`, 'color: #06b6d4;');
                      console.log(`%cCategory: ${['Builder', 'Social', 'Explorer', 'Creator'][proposalCategory - 1]}`, 'color: #f59e0b;');
                      console.log(`%cPoints: ${proposalPoints}`, 'color: #10b981;');
                      setIsCreatingProposal(true);
                      setError(null);
                      try {
                        const tx = new Transaction();
                        tx.moveCall({
                          target: `${PACKAGE_ID}::governance::create_proposal`,
                          arguments: [
                            tx.object(GOVERNANCE_HUB_ID),
                            tx.pure.string(proposalTitle),
                            tx.pure.string(proposalDescription),
                            tx.pure.u8(proposalCategory),
                            tx.pure.u64(proposalPoints),
                            tx.object(CLOCK_OBJECT),
                          ],
                        });
                        console.log('%c📤 Signing...', 'color: #f59e0b;');
                        const res = await signAndExecuteTransaction({ transaction: tx, chain: 'sui:testnet' });
                        console.log('%c✅ Proposal Created', 'color: #10b981; font-weight: bold;');
                        console.log(`🔗 https://suiscan.xyz/testnet/tx/${res.digest}`);
                        setTxDigest(res.digest);
                        await client.waitForTransaction({ digest: res.digest });
                        console.log('%c✅ Confirmed!', 'color: #10b981; font-weight: bold; font-size: 14px;');
                        console.groupEnd();
                        setProposalTitle('');
                        setProposalDescription('');
                        
                        // Refresh proposals list
                        loadProposals();
                        // Refresh achievement data
                        refetchAchievement();
                      } catch (err) {
                        console.error('❌ Error:', err);
                        console.groupEnd();
                        const errStr = String(err);
                        if (errStr.includes('InsufficientPoints')) {
                          setError('❌ Proposal oluşturmak için en az 50 point gerekli!');
                        } else if (errStr.includes('MoveAbort')) {
                          const match = errStr.match(/MoveAbort.*?, (\d+)\)/);
                          const code = match ? match[1] : 'unknown';
                          setError(`❌ Proposal hatası (kod: ${code}): ${errStr}`);
                        } else {
                          setError(`❌ Proposal error: ${errStr}`);
                        }
                      } finally {
                        setIsCreatingProposal(false);
                      }
                    }}
                    disabled={isCreatingProposal || !account || !proposalTitle || !proposalDescription}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      color: 'white',
                      cursor: isCreatingProposal || !account || !proposalTitle || !proposalDescription ? 'not-allowed' : 'pointer',
                      opacity: isCreatingProposal || !account || !proposalTitle || !proposalDescription ? 0.5 : 1,
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {isCreatingProposal ? '⏳ Creating...' : '✨ Create Proposal'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, opacity: 0.7, padding: 12, background: '#020617', borderRadius: 8 }}>
              <p>💡 <strong>Governance Features:</strong></p>
              <ul style={{ marginLeft: 20, marginTop: 8 }}>
                <li>Create proposals with 50 points requirement</li>
                <li>Community voting (70% threshold to pass)</li>
                <li>7-day voting period</li>
                <li>Stake points to earn 5% daily rewards</li>
              </ul>
            </div>

            {/* Global Proposals & Stats */}
            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937', marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16 }}>🗳️ Active Proposals</h3>
                <button
                  onClick={async () => {
                    setIsLoadingGlobalData(true);
                    try {
                      const [govObj, stakingObj] = await Promise.all([
                        client.getObject({ id: GOVERNANCE_HUB_ID, options: { showContent: true }}),
                        client.getObject({ id: STAKING_POOL_ID, options: { showContent: true }})
                      ]);
                      
                      console.log('🏛️ Governance:', govObj);
                      console.log('💰 Staking Pool:', stakingObj);
                      
                      if (govObj.data?.content && 'fields' in govObj.data.content) {
                        const govFields = govObj.data.content.fields as any;
                        console.log('📋 Governance Fields:', govFields);
                        
                        // VecMap yapısı: proposals.fields.contents
                        const proposalsContents = govFields.proposals?.fields?.contents || [];
                        console.log('📦 Proposals Contents:', proposalsContents);
                        
                        const proposals = proposalsContents.map((p: any) => {
                          const pFields = p.fields?.value?.fields || p.fields || p;
                          return {
                            id: pFields.id || 'unknown',
                            title: pFields.title || 'Untitled',
                            description: pFields.description || '',
                            votes_for: Number(pFields.votes_for || 0),
                            votes_against: Number(pFields.votes_against || 0),
                            reward_points: Number(pFields.reward_points || 0),
                            difficulty: Number(pFields.difficulty || 1),
                            proposer: pFields.proposer || '',
                            executed: pFields.executed || false,
                            ends_at: Number(pFields.ends_at || 0),
                            created_at: Number(pFields.created_at || 0)
                          };
                        });
                        setActiveProposals(proposals);
                        console.log(`✅ Loaded ${proposals.length} proposals`);
                      }
                      
                      if (stakingObj.data?.content && 'fields' in stakingObj.data.content) {
                        const fields = stakingObj.data.content.fields as any;
                        console.log('💎 Staking Fields:', fields);
                        setStakingStats({
                          totalStaked: Number(fields.total_staked || 0),
                          stakers: Number(fields.total_stakers || 0),
                          apr: 5
                        });
                      }
                    } catch (err) {
                      console.error('❌ Failed to load governance data:', err);
                    } finally {
                      setIsLoadingGlobalData(false);
                    }
                  }}
                  disabled={isLoadingGlobalData}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#6366f1',
                    color: 'white',
                    fontSize: 13,
                    cursor: isLoadingGlobalData ? 'wait' : 'pointer',
                  }}
                >
                  {isLoadingGlobalData ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
              </div>
              
              {stakingStats && (
                <div style={{ 
                  background: '#020617', 
                  padding: 12, 
                  borderRadius: 8, 
                  marginBottom: 12,
                  display: 'flex',
                  gap: 16,
                  justifyContent: 'space-around'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>
                      {stakingStats.totalStaked}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Total Staked</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#6366f1' }}>
                      {stakingStats.stakers}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Active Stakers</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f59e0b' }}>
                      5%
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Daily APR</div>
                  </div>
                </div>
              )}
              
              {activeProposals.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: 20 }}>
                  📭 No active proposals. Create the first one!
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {activeProposals.map((proposal: any, idx: number) => (
                    <div key={idx} style={{ 
                      background: '#020617', 
                      padding: 12, 
                      borderRadius: 8, 
                      border: '1px solid #374151'
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>
                        #{proposal.id} - {proposal.title || `Proposal #${idx + 1}`}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                        {proposal.description || 'No description'}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, opacity: 0.7, flexWrap: 'wrap' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>👍 {proposal.votes_for || 0} Upvotes</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>👎 {proposal.votes_against || 0} Downvotes</span>
                        <span>🎁 {proposal.reward_points || 0}pts</span>
                        <span>⚙️ {['Builder', 'Social', 'Explorer', 'Creator'][proposal.difficulty - 1] || 'Unknown'}</span>
                        <span>{proposal.executed ? '✅ Executed' : '⏳ Pending'}</span>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                        💡 Upvote/Downvote için minimum 10 puan gerekli (max 10 voting power)
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#10b981',
                            color: 'white',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          onClick={async () => {
                            if (!account) {
                              setError('❌ Lütfen önce cüzdanınızı bağlayın!');
                              return;
                            }
                            if (effectivePoints < 10) {
                              setError(`❌ Oy vermek için en az 10 puana ihtiyacınız var! Mevcut: ${effectivePoints}`);
                              return;
                            }
                            console.group('🗳️ Voting on Proposal');
                            console.log(`Proposal: #${proposal.id} - ${proposal.title}`);
                            console.log('Vote: For (Yes)');
                            try {
                              const tx = new Transaction();
                              tx.moveCall({
                                target: `${PACKAGE_ID}::governance::vote_on_proposal`,
                                arguments: [
                                  tx.object(GOVERNANCE_HUB_ID),
                                  tx.pure.u64(proposal.id),
                                  tx.pure.bool(true), // vote for
                                  tx.pure.u64(Math.min(effectivePoints, 10)), // voting_power (max 10)
                                  tx.object(CLOCK_OBJECT),
                                ],
                              });
                              const res = await signAndExecuteTransaction({ transaction: tx, chain: 'sui:testnet' });
                              console.log('✅ Vote Sent:', res.digest);
                              setTxDigest(res.digest);
                              await client.waitForTransaction({ digest: res.digest });
                              console.log('✅ Vote Confirmed!');
                              console.groupEnd();
                              
                              // Refresh proposals
                              const govObj = await client.getObject({ id: GOVERNANCE_HUB_ID, options: { showContent: true }});
                              if (govObj.data?.content && 'fields' in govObj.data.content) {
                                const govFields = govObj.data.content.fields as any;
                                const proposalsContents = govFields.proposals?.fields?.contents || [];
                                const refreshedProposals = proposalsContents.map((p: any) => {
                                  const pFields = p.fields?.value?.fields || p.fields || p;
                                  return {
                                    id: pFields.id || 'unknown',
                                    title: pFields.title || 'Untitled',
                                    description: pFields.description || '',
                                    votes_for: Number(pFields.votes_for || 0),
                                    votes_against: Number(pFields.votes_against || 0),
                                    reward_points: Number(pFields.reward_points || 0),
                                    difficulty: Number(pFields.difficulty || 1),
                                    proposer: pFields.proposer || '',
                                    executed: pFields.executed || false,
                                    ends_at: Number(pFields.ends_at || 0),
                                    created_at: Number(pFields.created_at || 0)
                                  };
                                });
                                setActiveProposals(refreshedProposals);
                                console.log('✅ Proposals refreshed');
                              }
                              
                              // Refresh achievement data
                              refetchAchievement();
                            } catch (err) {
                              console.error('❌ Vote Failed:', err);
                              console.groupEnd();
                              setError(`❌ Voting error: ${String(err)}`);
                            }
                          }}
                        >
                          👍 Vote For
                        </button>
                        <button
                          style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#ef4444',
                            color: 'white',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          onClick={async () => {
                            if (!account) {
                              setError('❌ Lütfen önce cüzdanınızı bağlayın!');
                              return;
                            }
                            if (effectivePoints < 10) {
                              setError(`❌ Oy vermek için en az 10 puana ihtiyacınız var! Mevcut: ${effectivePoints}`);
                              return;
                            }
                            console.group('🗳️ Voting on Proposal');
                            console.log(`Proposal: #${proposal.id} - ${proposal.title}`);
                            console.log('Vote: Against (No)');
                            try {
                              const tx = new Transaction();
                              tx.moveCall({
                                target: `${PACKAGE_ID}::governance::vote_on_proposal`,
                                arguments: [
                                  tx.object(GOVERNANCE_HUB_ID),
                                  tx.pure.u64(proposal.id),
                                  tx.pure.bool(false), // vote against
                                  tx.pure.u64(Math.min(effectivePoints, 10)), // voting_power (max 10)
                                  tx.object(CLOCK_OBJECT),
                                ],
                              });
                              const res = await signAndExecuteTransaction({ transaction: tx, chain: 'sui:testnet' });
                              console.log('✅ Vote Sent:', res.digest);
                              setTxDigest(res.digest);
                              await client.waitForTransaction({ digest: res.digest });
                              console.log('✅ Vote Confirmed!');
                              console.groupEnd();
                              
                              // Refresh proposals
                              const govObj = await client.getObject({ id: GOVERNANCE_HUB_ID, options: { showContent: true }});
                              if (govObj.data?.content && 'fields' in govObj.data.content) {
                                const govFields = govObj.data.content.fields as any;
                                const proposalsContents = govFields.proposals?.fields?.contents || [];
                                const refreshedProposals = proposalsContents.map((p: any) => {
                                  const pFields = p.fields?.value?.fields || p.fields || p;
                                  return {
                                    id: pFields.id || 'unknown',
                                    title: pFields.title || 'Untitled',
                                    description: pFields.description || '',
                                    votes_for: Number(pFields.votes_for || 0),
                                    votes_against: Number(pFields.votes_against || 0),
                                    reward_points: Number(pFields.reward_points || 0),
                                    difficulty: Number(pFields.difficulty || 1),
                                    proposer: pFields.proposer || '',
                                    executed: pFields.executed || false,
                                    ends_at: Number(pFields.ends_at || 0),
                                    created_at: Number(pFields.created_at || 0)
                                  };
                                });
                                setActiveProposals(refreshedProposals);
                                console.log('✅ Proposals refreshed');
                              }
                              
                              // Refresh achievement data
                              refetchAchievement();
                            } catch (err) {
                              console.error('❌ Vote Failed:', err);
                              console.groupEnd();
                              setError(`❌ Voting error: ${String(err)}`);
                            }
                          }}
                        >
                          👎 Vote Against
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Tasks Tab */}
        {achievement && activeTab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>🎯 Dynamic Tasks System</h2>
            
            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>🔥 Advanced Features</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
                  <h4 style={{ fontSize: 14, marginBottom: 4 }}>Combo System</h4>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    Complete 3+ tasks within 1 hour to earn 50% bonus points!
                  </p>
                </div>
                <div style={{ background: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
                  <h4 style={{ fontSize: 14, marginBottom: 4 }}>Adaptive Difficulty</h4>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    Task difficulty auto-adjusts based on your performance
                  </p>
                </div>
                <div style={{ background: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🎪</div>
                  <h4 style={{ fontSize: 14, marginBottom: 4 }}>Seasonal Events</h4>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    Time-limited themed events with 50% bonus multipliers
                  </p>
                </div>
                <div style={{ background: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>👥</div>
                  <h4 style={{ fontSize: 14, marginBottom: 4 }}>Referral System</h4>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    Earn 10% bonus when friends use your referral link
                  </p>
                </div>
              </div>
            </div>

            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>📊 Task Categories</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: 'Builder', icon: '🔨', multiplier: '1.0x - 1.5x', desc: 'Development tasks' },
                  { name: 'Social', icon: '💬', multiplier: '1.0x - 1.5x', desc: 'Community engagement' },
                  { name: 'Explorer', icon: '🗺️', multiplier: '1.0x - 1.5x', desc: 'Discovery tasks' },
                  { name: 'Creator', icon: '🎨', multiplier: '1.0x - 1.5x', desc: 'Content creation' },
                ].map((cat) => (
                  <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#020617', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 20 }}>{cat.icon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{cat.desc}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#f59e0b' }}>{cat.multiplier}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Marketplace Tab */}
        {achievement && activeTab === 'marketplace' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>🛒 Points Marketplace</h2>
            
            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>💰 Sell Points</h3>
              <div style={{ fontSize: 13, marginBottom: 12, padding: 10, background: '#020617', borderRadius: 6 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#10b981' }}>📊 Mevcut Puanınız:</strong> <span style={{ fontSize: 16, fontWeight: 'bold', color: '#fbbf24' }}>{effectivePoints}</span>
                </div>
                <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
                  🏪 Puanlarınızı <strong style={{ color: '#60a5fa' }}>SUI token</strong> karşılığında satın<br/>
                  💵 Platform komisyonu: %2.5<br/>
                  ⚡ Blockchain üzerinde anlık ödeme<br/>
                  🔒 Smart contract escrow sistemi<br/>
                  ⚠️ Minimum satış: 10 puan<br/>
                  <span style={{ fontSize: 11, color: '#fbbf24', marginTop: 4, display: 'block' }}>
                    ⚡ Not: Listelenen puanlar tarayıcınızda izlenir
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>💸 Satılacak Miktar (puan)</label>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="10"
                    min="10"
                    max={effectivePoints}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(96,165,250,0.3)',
                      background: 'rgba(2,6,23,0.8)',
                      color: '#e5e7eb',
                      fontSize: 14,
                      width: 140,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>💵 Fiyat (SUI token)</label>
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0.001"
                    min="0.000001"
                    step="0.000001"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(96,165,250,0.3)',
                      background: 'rgba(2,6,23,0.8)',
                      color: '#e5e7eb',
                      fontSize: 14,
                      width: 160,
                    }}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!account) {
                      console.log('%c❌ Access Denied', 'color: #ef4444; font-weight: bold;', 'Wallet not connected');
                      setError('❌ Lütfen önce cüzdanınızı bağlayın!');
                      return;
                    }
                    const listAmount = parseInt(sellAmount);
                    const suiAmount = parseFloat(sellPrice);
                    
                    if (effectivePoints < listAmount) {
                      setError(`❌ Yeterli puanınız yok! Mevcut: ${effectivePoints}, Satmak istenen: ${listAmount}`);
                      console.log('%c❌ Insufficient Points', 'color: #ef4444; font-weight: bold;', `Have: ${effectivePoints}, Need: ${listAmount}`);
                      return;
                    }
                    if (listAmount < 10) {
                      setError('❌ Minimum satış miktarı 10 puandır!');
                      return;
                    }
                    if (isNaN(suiAmount) || suiAmount <= 0) {
                      setError('❌ Geçerli bir SUI fiyatı girin! (Örn: 0.001)');
                      return;
                    }
                    
                    // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
                    const mistAmount = Math.floor(suiAmount * 1_000_000_000);
                    
                    console.group('%c🛒 Listing Points', 'font-size: 14px; font-weight: bold; color: #f59e0b;');
                    console.log(`%cSelling: ${sellAmount} points`, 'color: #06b6d4;');
                    console.log(`%cPrice: ${sellPrice} SUI (${mistAmount} MIST)`, 'color: #10b981;');
                    console.log(`%cFee: 2.5%`, 'color: #6b7280;');
                    setIsListing(true);
                    setError(null);
                    try {
                      const tx = new Transaction();
                      tx.moveCall({
                        target: `${PACKAGE_ID}::governance::list_points`,
                        arguments: [
                          tx.object(MARKETPLACE_ID),
                          tx.pure.u64(parseInt(sellAmount)),
                          tx.pure.u64(mistAmount),
                        ],
                      });
                      console.log('📤 Signing transaction...');
                      const res = await signAndExecuteTransaction({ transaction: tx, chain: 'sui:testnet' });
                      console.log(`✅ Success: https://suiscan.xyz/testnet/tx/${res.digest}`);
                      setTxDigest(res.digest);
                      await client.waitForTransaction({ digest: res.digest });
                      console.log('✅ Confirmed on blockchain');
                      
                      // Reserved points'i güncelle
                      const currentReserved = getReservedPoints();
                      setReservedPoints({
                        ...currentReserved,
                        listed: currentReserved.listed + listAmount
                      });
                      console.log(`%c🔒 Reserved Points Updated`, 'color: #8b5cf6; font-weight: bold;', `+${listAmount} listed`);
                      
                      console.groupEnd();
                      
                      // Refresh marketplace listings
                      const marketObj = await client.getObject({
                        id: MARKETPLACE_ID,
                        options: { showContent: true }
                      });
                      
                      if (marketObj.data?.content && 'fields' in marketObj.data.content) {
                        const mFields = marketObj.data.content.fields as any;
                        const listingsContents = mFields.listings?.fields?.contents || [];
                        
                        const refreshedListings = listingsContents.map((entry: any) => {
                          const lFields = entry.fields?.value?.fields || entry.fields || entry;
                          return {
                            id: lFields.id || 'unknown',
                            seller: lFields.seller || 'Unknown',
                            points_amount: Number(lFields.points_amount || 0),
                            sui_price: Number(lFields.sui_price || 0),
                            active: lFields.active || false
                          };
                        });
                        setMarketplaceListings(refreshedListings);
                        console.log(`✅ Refreshed ${refreshedListings.length} listings:`, refreshedListings);
                      }
                      
                      refetchAchievement();
                    } catch (err) {
                      console.error('❌ Error:', err);
                      console.groupEnd();
                      const errStr = String(err);
                      if (errStr.includes('InsufficientPoints')) {
                        setError('❌ Yeterli point yok!');
                      } else if (errStr.includes('MoveAbort')) {
                        const match = errStr.match(/MoveAbort.*?, (\d+)\)/);
                        const code = match ? match[1] : 'unknown';
                        setError(`❌ Listing hatası (kod: ${code}): ${errStr}`);
                      } else {
                        setError(`❌ Listing error: ${errStr}`);
                      }
                    } finally {
                      setIsListing(false);
                    }
                  }}
                  disabled={isListing || !account}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#f59e0b',
                    color: 'white',
                    cursor: isListing || !account ? 'not-allowed' : 'pointer',
                    opacity: isListing || !account ? 0.5 : 1,
                  }}
                >
                  {isListing ? 'Listing...' : 'List for Sale'}
                </button>
              </div>
            </div>

            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>🔐 Secure Trading</h3>
              <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                <p>✅ Puanlarınızı <strong style={{ color: '#60a5fa' }}>SUI token</strong> karşılığında satın</p>
                <p>✅ Diğer oyunculardan puan satın alın</p>
                <p>✅ Smart contract escrow güvenliği</p>
                <p>✅ %2.5 platform komisyonu</p>
                <p>✅ Anlık blockchain settlement</p>
              </div>
            </div>

            <div style={{ fontSize: 13, opacity: 0.7, padding: 12, background: '#020617', borderRadius: 8 }}>
              💡 <strong>Nasıl çalışır?</strong> Puanlarınızı SUI token karşılığında satabilir, diğer oyunculardan SUI ile puan satın alabilirsiniz. Tüm işlemler Sui blockchain'de smart contract ile güvence altında.
            </div>

            {/* Global Marketplace Listings */}
            <div style={{ background: '#111827', padding: 16, borderRadius: 12, border: '1px solid #1f2937', marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16 }}>🌍 Active Listings</h3>
                <button
                  onClick={async () => {
                    setIsLoadingGlobalData(true);
                    try {
                      const obj = await client.getObject({
                        id: MARKETPLACE_ID,
                        options: { showContent: true }
                      });
                      console.log('🛒 Marketplace Object:', obj);
                      
                      if (obj.data?.content && 'fields' in obj.data.content) {
                        const fields = obj.data.content.fields as any;
                        console.log('📦 Marketplace Fields:', fields);
                        
                        // VecMap yapısı: listings.fields.contents
                        const listingsContents = fields.listings?.fields?.contents || [];
                        console.log('📋 Listings Contents:', listingsContents);
                        
                        const listings = listingsContents.map((entry: any) => {
                          const lFields = entry.fields?.value?.fields || entry.fields || entry;
                          return {
                            id: lFields.id || 'unknown',
                            seller: lFields.seller || 'Unknown',
                            points_amount: Number(lFields.points_amount || 0),
                            sui_price: Number(lFields.sui_price || 0),
                            active: lFields.active || false
                          };
                        });
                        setMarketplaceListings(listings);
                        console.log(`✅ Loaded ${listings.length} marketplace listings:`, listings);
                      }
                    } catch (err) {
                      console.error('❌ Failed to load listings:', err);
                    } finally {
                      setIsLoadingGlobalData(false);
                    }
                  }}
                  disabled={isLoadingGlobalData}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#3b82f6',
                    color: 'white',
                    fontSize: 13,
                    cursor: isLoadingGlobalData ? 'wait' : 'pointer',
                  }}
                >
                  {isLoadingGlobalData ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
              </div>
              
              {marketplaceListings.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: 20 }}>
                  📭 No active listings yet. Be the first to list!
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {marketplaceListings.map((listing: any, idx: number) => (
                    <div key={idx} style={{ 
                      background: '#020617', 
                      padding: 12, 
                      borderRadius: 8, 
                      border: '1px solid #374151',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: 13 }}>
                        <div style={{ marginBottom: 4 }}>
                          💰 <strong>{listing.points_amount || 'N/A'} puan</strong>
                        </div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          💵 Fiyat: <strong style={{ color: '#60a5fa' }}>{(listing.sui_price / 1000000000).toFixed(6)} SUI</strong>
                        </div>
                        <div style={{ opacity: 0.5, fontSize: 11, marginTop: 4 }}>
                          Seller: {listing.seller ? `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}` : 'Unknown'}
                        </div>
                      </div>
                      <button
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#10b981',
                          color: 'white',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          console.log('🛒 Buy listing:', listing);
                          setError('🚧 Buy functionality coming soon!');
                        }}
                      >
                        Buy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!achievement && !effectiveOwner && (
          <p>
            Başlamak için cüzdan bağla ve kendi Achievement NFT&apos;ni mint et.
          </p>
        )}

        {txDigest && (
          <div style={{ fontSize: 12, opacity: 0.8, padding: 8, background: '#022c22', borderRadius: 8, border: '1px solid #065f46' }}>
            ✅ Son işlem:{' '}
            <a 
              href={`https://suiscan.xyz/testnet/tx/${txDigest}`} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontFamily: 'monospace', color: '#10b981', textDecoration: 'underline' }}
            >
              {txDigest.slice(0, 8)}...{txDigest.slice(-6)}
            </a>
          </div>
        )}

        {error && (
          <div 
            style={{ 
              color: '#fca5a5', 
              fontSize: 13, 
              padding: 12, 
              background: '#450a0a', 
              borderRadius: 8, 
              border: '1px solid #7f1d1d',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error}
            <button
              onClick={() => {
                console.log('🔄 Error dismissed');
                setError(null);
              }}
              style={{
                marginLeft: 12,
                padding: '4px 8px',
                borderRadius: 4,
                border: 'none',
                background: '#7f1d1d',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Leaderboard - Always at the bottom of all tabs */}
        {achievement && (
          <div style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.9), rgba(31,41,55,0.9))', padding: 20, borderRadius: 16, border: '1px solid rgba(251,191,36,0.3)', marginTop: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: 20, margin: 0, background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>🏆 Global Leaderboard</h3>
              <button
                  onClick={async () => {
                    setIsLoadingGlobalData(true);
                    try {
                      await loadLeaderboard();
                      await refetchAchievement();
                      console.log('✅ Leaderboard and achievement data refreshed');
                    } catch (err) {
                      console.error('❌ Failed to refresh:', err);
                    } finally {
                      setIsLoadingGlobalData(false);
                    }
                  }}
                  disabled={isLoadingGlobalData}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isLoadingGlobalData ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isLoadingGlobalData ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
              </div>
              
              {leaderboardData.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: 20 }}>
                  📭 No players yet. Complete tasks to get on the board!
                </p>
              ) : (
                <div className="responsive-grid" style={{ display: 'grid', gap: 10 }}>
                  {leaderboardData.map((player: any, idx: number) => {
                    const isCurrentUser = account?.address && player.address.toLowerCase() === account.address.toLowerCase();
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    
                    return (
                      <div key={idx} style={{ 
                        background: isCurrentUser ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(96,165,250,0.1))' : idx < 3 ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))' : 'linear-gradient(135deg, rgba(17,24,39,0.8), rgba(31,41,55,0.8))', 
                        padding: 14, 
                        borderRadius: 12, 
                        border: isCurrentUser ? '2px solid #3b82f6' : `1px solid ${idx === 0 ? 'rgba(251,191,36,0.5)' : idx === 1 ? 'rgba(156,163,175,0.5)' : idx === 2 ? 'rgba(205,127,50,0.5)' : 'rgba(75,85,99,0.3)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.3s ease',
                        boxShadow: isCurrentUser ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 20, minWidth: 40 }}>{medal}</span>
                          <div>
                            <span style={{ fontSize: 13, fontFamily: 'monospace' }}>
                              {player.address ? `${player.address.slice(0, 6)}...${player.address.slice(-4)}` : 'Unknown'}
                            </span>
                            {isCurrentUser && (
                              <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 2 }}>You</div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>
                            ⭐ Lvl {player.level || 0}
                          </span>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>
                            ✅ {player.tasks_completed || 0}/9
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>
                            {isCurrentUser ? effectivePoints : player.points} pts
                          </span>
                          {isCurrentUser && reservedTotal > 0 && (
                            <span style={{ fontSize: 10, opacity: 0.7, color: '#fbbf24' }}>
                              🔒 {reservedTotal}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
