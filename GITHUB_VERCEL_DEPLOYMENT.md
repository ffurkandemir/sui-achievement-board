# 🚀 GitHub & Vercel Deployment Guide

## 📦 Step 1: Create GitHub Repository

1. Go to: https://github.com/new
2. **Repository name:** `sui-achievement-board`
3. **Description:** `A gamified achievement tracking system with dynamic NFTs, DAO governance, and marketplace on Sui blockchain`
4. **Visibility:** Public (for hackathon visibility)
5. **DO NOT** initialize with README, .gitignore, or license (we already have them)
6. Click **"Create repository"**

## 🔗 Step 2: Push to GitHub

After creating the repository, run these commands:

```bash
cd /home/demir/sui-achievement-board

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sui-achievement-board.git

# Verify remote
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

**If you get authentication error:**
- Use Personal Access Token (PAT) instead of password
- Generate token at: https://github.com/settings/tokens
- Use token as password when prompted

**OR use SSH (if you have SSH key set up):**
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/sui-achievement-board.git
git push -u origin main
```

## ☁️ Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to: https://vercel.com
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your `sui-achievement-board` repository
5. **Configure Project:**
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. Click **"Deploy"**
7. Wait 2-3 minutes for deployment to complete
8. Get your live URL: `https://sui-achievement-board-xxx.vercel.app`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd /home/demir/sui-achievement-board/frontend
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? sui-achievement-board
# - Directory? ./
# - Override settings? No

# For production deployment
vercel --prod
```

## 📝 Step 4: Update README with Live Demo Link

After deployment, update your README.md:

1. Copy your Vercel deployment URL
2. Edit README.md line 40:
   ```markdown
   🌐 **[Try it now on Testnet](https://your-app.vercel.app)**
   ```
3. Commit and push:
   ```bash
   git add README.md
   git commit -m "docs: add live demo URL"
   git push
   ```

## ✅ Step 5: Verify Deployment

1. Visit your Vercel URL
2. Test wallet connection
3. Test NFT minting
4. Test task completion
5. Check if all features work

## 🔧 Troubleshooting

### Build fails on Vercel:
- Check Node.js version (should be 18+)
- Verify `package.json` has all dependencies
- Check build logs for TypeScript errors

### 404 errors on routes:
- Vercel should auto-detect SPA, but if not:
- Create `vercel.json` in frontend:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

### Environment variables:
- Not needed for this project (IDs are hardcoded in App.tsx)
- But if you want to use env vars:
  - Add in Vercel Dashboard → Settings → Environment Variables

## 📊 Post-Deployment Checklist

- [ ] GitHub repository is public
- [ ] README.md has live demo link
- [ ] Vercel deployment is successful
- [ ] App loads and wallet connects
- [ ] All blockchain interactions work
- [ ] Mobile responsiveness works
- [ ] Share link with hackathon judges!

## 🎉 Next Steps

1. Update README badges with your repo stats
2. Add screenshots to README
3. Create a demo video (optional)
4. Share on social media
5. Submit to hackathon

---

**Your Project URLs:**
- GitHub: `https://github.com/YOUR_USERNAME/sui-achievement-board`
- Live Demo: `https://your-app.vercel.app`
- Suiscan: `https://suiscan.xyz/testnet/object/0x01f39ae8802d5cef4118b67dfae61bc291dc71cc8d907bc9c3ff63d31e0f1dc7`

Good luck with your hackathon submission! 🚀
