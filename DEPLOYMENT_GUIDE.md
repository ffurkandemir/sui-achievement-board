# 🚀 Sui Achievement Board - Deployment Guide

## Yeni Özellikler ✨

### 1. **Display Standard (NFT Görselleştirme)**
- NFT'ler artık Sui walletlarında ve explorerlarda görsel olarak görünecek
- Dinamik metadata: Level, puan, streak bilgileri otomatik güncellenir
- Walrus'ta host edilen görsel (değiştirilebilir)

### 2. **Shared Leaderboard**
- Tüm kullanıcıların puanları merkezi bir leaderboard'da toplanır
- Gerçek zamanlı sıralama
- Top 100 oyuncu tracking

### 3. **Daily Streaks + Clock**
- Her gün giriş yaparak bonus puan kazanma
- Streak sistemi: Ardışık günler bonus çarpanı
- Sui Clock objesini kullanan zaman bazlı mekanik

---

## 📦 Deployment Adımları

### 1. Smart Contract Deploy

```bash
cd /home/demir/sui-achievement-board/contracts/achievement_nft

# Testnet'e deploy et
sui client publish --gas-budget 100000000

# ÖNEMLİ: Deploy sonrası çıktılardan şunları kaydet:
# - Package ID
# - Leaderboard Object ID (Shared Object)
# - Display Object ID
# - Publisher Object ID
```

**Deploy Çıktısında Aranacaklar:**

```
│ Created Objects:
│  ┌──
│  │ ObjectID: 0x... 
│  │ Type: <PACKAGE_ID>::achievement::Leaderboard    <-- BU LEADERBOARD_ID
│  └──
│  ┌──
│  │ ObjectID: 0x...
│  │ Type: 0x2::display::Display<AchievementNFT>     <-- Display
│  └──
│  ┌──
│  │ ObjectID: 0x...
│  │ Type: 0x2::package::Publisher                   <-- Publisher
│  └──
```

### 2. Frontend Güncelle

`frontend/src/App.tsx` dosyasında 2 satırı güncelle:

```typescript
// Satır 11: Yeni Package ID
const PACKAGE_ID = '0xYENI_PACKAGE_ID_BURAYA';

// Satır 15: Leaderboard Object ID
const LEADERBOARD_ID = '0xLEADERBOARD_OBJECT_ID_BURAYA';
```

### 3. Görsel URL Güncelle (Opsiyonel)

Kendi NFT görselini kullanmak istersen:

1. Görseli Walrus'a upload et veya başka bir CDN kullan
2. `contracts/achievement_nft/sources/achievement.move` dosyasında 92. satırı güncelle:

```move
string::utf8(b"https://YOUR_IMAGE_URL_HERE"),
```

3. Contract'ı tekrar publish et veya Display'i upgrade et

---

## 🧪 Test Adımları

### 1. İlk NFT Mint
```bash
# Frontend'de:
# 1. Cüzdan bağla
# 2. "Achievement NFT Mint Et" butonuna tıkla
# 3. Leaderboard'a otomatik eklenecek
```

### 2. Görev Tamamla
```bash
# Her görev için:
# - Görevi tıkla
# - Transaction onaylama bekle
# - Puan ve level otomatik güncellenecek
# - Leaderboard sıralaması değişecek
```

### 3. Daily Streak Test
```bash
# İlk gün:
# - "Günlük Ödül Al" butonuna tıkla
# - +5 puan alacaksın (streak 1)

# İkinci gün (24 saat sonra):
# - Tekrar claim et
# - +7 puan alacaksın (5 + 2*1)

# Üçüncü gün:
# - +9 puan (5 + 2*2)
```

### 4. NFT Görselini Kontrol Et
```bash
# Sui Explorer'da NFT'ni görüntüle
https://suiscan.xyz/testnet/object/<NFT_OBJECT_ID>

# Veya Sui Wallet'ında "Collectibles" bölümüne bak
```

---

## 🔍 Leaderboard Sorgulama

Leaderboard verilerini görmek için:

```bash
sui client object <LEADERBOARD_OBJECT_ID> --json
```

---

## 📊 Event'leri Dinleme

```bash
# Task completion events
sui client events --query "MoveEventType::<PACKAGE_ID>::achievement::TaskCompletedEvent"

# Daily reward events
sui client events --query "MoveEventType::<PACKAGE_ID>::achievement::DailyRewardClaimedEvent"

# Leaderboard updates
sui client events --query "MoveEventType::<PACKAGE_ID>::achievement::LeaderboardUpdatedEvent"
```

---

## 🎨 Frontend Development

```bash
cd /home/demir/sui-achievement-board/frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🐛 Troubleshooting

### Problem: "Object not found" hatası
**Çözüm:** LEADERBOARD_ID'yi kontrol et, doğru object ID'yi girdiğinden emin ol

### Problem: "Already claimed today" hatası
**Çözüm:** 24 saat beklemelisin (blockchain timestamp'e göre)

### Problem: Display görünmüyor
**Çözüm:** Display object'i wallet'a transfer edildi mi kontrol et, birkaç dakika bekle

### Problem: Leaderboard güncellenmiyor
**Çözüm:** Transaction'ın başarılı olduğunu kontrol et, `sui client object` ile leaderboard'u sorgula

---

## 🚀 Production Deployment

### Mainnet'e geçiş için:

1. `contracts/achievement_nft/Move.toml` dosyasında:
   ```toml
   [dependencies]
   Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }
   ```

2. Frontend'de `main.tsx`:
   ```typescript
   const { networkConfig } = createNetworkConfig({
     mainnet: { url: getFullnodeUrl('mainnet') },
   });
   ```

3. Tekrar deploy et ve test et!

---

## 💡 Hackathon İçin Notlar

Jürilere gösterirken vurgulanacak noktalar:

1. ✅ **Display Standard** - NFT'ler görsel ve metadata'lı
2. ✅ **Shared Objects** - Leaderboard merkezi ve concurrent access
3. ✅ **Clock Integration** - Time-based mechanics
4. ✅ **Event System** - Transparent activity feed
5. ✅ **Composability** - Tüm fonksiyonlar public, başkaları extend edebilir
6. ✅ **Gas Optimization** - Efficient vector operations
7. ✅ **Security** - Owner checks, duplicate prevention

## 📈 Gelecek Geliştirmeler

- [ ] Badge system (dynamic child objects)
- [ ] SUI token rewards
- [ ] NFT fusion mechanics
- [ ] Achievement trading marketplace
- [ ] DAO governance for new achievements
- [ ] Cross-game achievement portability

---

Başarılar! 🎉
