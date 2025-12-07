# Git & GitHub Yükleme Adımları

Bu projeyi GitHub'a yüklemek için aşağıdaki adımları takip edin:

## 1. Git Repository Başlat

```bash
cd /home/demir/sui-achievement-board
git init
```

## 2. Git Kullanıcı Bilgilerini Ayarla (İlk Kez İse)

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 3. Tüm Dosyaları Stage'e Al

```bash
git add -A
```

## 4. İlk Commit'i Oluştur

```bash
git commit -m "Initial commit: Sui Achievement Board with NFTs, DAO, and Marketplace"
```

## 5. GitHub'da Yeni Repository Oluştur

1. GitHub'da oturum açın: https://github.com
2. Sağ üstteki "+" butonuna tıklayın
3. "New repository" seçin
4. Repository adı: `sui-achievement-board`
5. Açıklama: "A gamified achievement tracking system with dynamic NFTs on Sui blockchain"
6. Public seçin (hackathon için görünür olsun)
7. **README veya .gitignore eklemeyin** (zaten var)
8. "Create repository" tıklayın

## 6. Remote Repository Ekle

GitHub'daki repository URL'ini kullanın:

```bash
git remote add origin https://github.com/YOUR_USERNAME/sui-achievement-board.git
```

## 7. Ana Branch'i Ayarla ve Push Et

```bash
git branch -M main
git push -u origin main
```

## 8. Repository'yi Doğrula

GitHub'da repository'nizi ziyaret edin:
```
https://github.com/YOUR_USERNAME/sui-achievement-board
```

## 9. README'yi Güncelle

GitHub kullanıcı adınızı README.md'de değiştirin:
- Satır 35: Package link
- Satır 584: GitHub kullanıcı adı
- Satır 585: Twitter (opsiyonel)
- Satır 597: Live demo link (deploy'dan sonra)
- Frontend package.json repository URL'i

## 10. Vercel'e Deploy (Opsiyonel)

1. https://vercel.com adresine gidin
2. GitHub ile giriş yapın
3. "Import Project" tıklayın
4. `sui-achievement-board` repository'sini seçin
5. Build settings:
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. "Deploy" tıklayın
7. Deploy edilen URL'i README.md'ye ekleyin

## Sonraki Güncellemeler İçin

```bash
# Değişiklikleri göster
git status

# Yeni değişiklikleri ekle
git add .

# Commit oluştur
git commit -m "Açıklayıcı commit mesajı"

# GitHub'a push et
git push
```

## Yararlı Git Komutları

```bash
# Değişiklikleri göster
git diff

# Commit geçmişi
git log --oneline

# Branch oluştur
git checkout -b feature/new-feature

# Branch'ler arası geçiş
git checkout main

# Remote repository durumu
git remote -v
```

## Sorun Giderme

### "Permission denied" Hatası
SSH key ekleyin veya HTTPS kullanın:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/sui-achievement-board.git
```

### "Git not found" Hatası
Git yükleyin:
```bash
sudo apt-get install git  # Linux
brew install git          # macOS
```

### Large Files Uyarısı
`.gitignore` dosyası zaten hazır, ancak sorun olursa:
```bash
git rm --cached <büyük-dosya>
git commit --amend
```

## Hackathon Submission Checklist

- [ ] README.md tamamlandı
- [ ] LICENSE dosyası eklendi
- [ ] .gitignore düzgün çalışıyor
- [ ] Tüm kod commit edildi
- [ ] GitHub repository public
- [ ] Canlı demo linki eklendi (Vercel)
- [ ] Suiscan explorer linkleri çalışıyor
- [ ] Package.json bilgileri güncellendi
- [ ] Video demo hazırlandı (opsiyonel)
- [ ] Screenshots eklendi (opsiyonel)
