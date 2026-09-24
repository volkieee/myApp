/**
 * GAME & PROGRESSION ENGINE (MULTI-USER SUPPORT)
 * =====================================================================
 * Mengatur level pemain, XP, pangkat trader (Rank), leverage unlock,
 * item/perk shop, Daily Quests, serta integrasi akun username.
 * =====================================================================
 */

import { dbService } from './firebase/db-service.js';
import { sfx } from './audio.js';

export const RANKS = [
    { level: 1, name: "Novice Trader", icon: "🌱", color: "#94a3b8", maxLeverage: 10 },
    { level: 3, name: "Crypto Degan", icon: "⚡", color: "#38bdf8", maxLeverage: 25 },
    { level: 6, name: "Chart Analyst", icon: "📊", color: "#a855f7", maxLeverage: 50 },
    { level: 10, name: "Wall Street Wolf", icon: "🐺", color: "#f59e0b", maxLeverage: 75 },
    { level: 15, name: "Whale Slayer", icon: "🐋", color: "#ec4899", maxLeverage: 100 },
    { level: 25, name: "Apex Overlord", icon: "👑", color: "#10b981", maxLeverage: 100 }
];

export const SHOP_ITEMS = [
    {
        id: "autobot",
        name: "🤖 AI Auto-Trader Bot",
        desc: "Bot trading otomatis yang menghasilkan profit pasif setiap 3 detik!",
        baseCost: 2500,
        costMultiplier: 1.8,
        maxLevel: 5,
        getEffectDesc: (lvl) => lvl === 0 ? "Belum aktif" : `Menghasilkan +$${(lvl * 15).toLocaleString()}/3 detik`
    },
    {
        id: "insurance",
        name: "🛡️ Stop Loss Insurance",
        desc: "Mengembalikan sebagian modal jika posisi terkena Likuidasi!",
        baseCost: 1500,
        costMultiplier: 2.2,
        maxLevel: 4,
        getEffectDesc: (lvl) => lvl === 0 ? "0% proteksi" : `${lvl * 15}% Cashback Likuidasi`
    },
    {
        id: "oracle",
        name: "🔮 Market Oracle Radar",
        desc: "Mendeteksi sinyal sentimen pump & dump sebelum breaking news muncul!",
        baseCost: 3500,
        costMultiplier: 2.5,
        maxLevel: 3,
        getEffectDesc: (lvl) => lvl === 0 ? "Tidak aktif" : `Akurasi radar Level ${lvl}`
    }
];

export const INITIAL_QUESTS = [
    { id: "q_first_trade", title: "Trade Perdana", desc: "Buka 1 posisi Long atau Short apa saja", rewardXp: 50, rewardCash: 500, target: 1, progress: 0, completed: false, claimed: false },
    { id: "q_win_3", title: "Winning Streak", desc: "Dapatkan 3x trade profit berturut-turut", rewardXp: 150, rewardCash: 2000, target: 3, progress: 0, completed: false, claimed: false },
    { id: "q_big_profit", title: "Big Win", desc: "Raih profit lebih dari $500 dalam 1 trade", rewardXp: 200, rewardCash: 2500, target: 1, progress: 0, completed: false, claimed: false },
    { id: "q_high_lev", title: "Adrenaline Junkie", desc: "Buka posisi menggunakan leverage >= 25x", rewardXp: 120, rewardCash: 1500, target: 1, progress: 0, completed: false, claimed: false },
    { id: "q_buy_upgrade", title: "Teknologi Masa Depan", desc: "Beli atau upgrade 1 item di Toko Perk", rewardXp: 100, rewardCash: 1000, target: 1, progress: 0, completed: false, claimed: false },
    { id: "q_reach_lvl3", title: "Naik Pangkat", desc: "Capai Level 3 (Crypto Degan)", rewardXp: 300, rewardCash: 5000, target: 3, progress: 1, completed: false, claimed: false }
];

export const AVATAR_LIST = [
    { id: "crown", icon: "👑", name: "Raja Sultan" },
    { id: "lion", icon: "🦁", name: "Singa Alpha" },
    { id: "wolf", icon: "🐺", name: "Wall Street Wolf" },
    { id: "whale", icon: "🐋", name: "Mega Whale" },
    { id: "bot", icon: "🤖", name: "Cyborg Trader" },
    { id: "diamond", icon: "💎", name: "Diamond Hands" },
    { id: "ninja", icon: "🥷", name: "Shadow Scalper" },
    { id: "rocket", icon: "🚀", name: "To The Moon" }
];

export class GameEngine {
    constructor() {
        this.avatar = "👑";
        this.resetLocalState();
        this.listeners = [];
        this.autoBotTimer = null;
    }

    resetLocalState() {
        this.avatar = "👑";
        this.balance = 10000;
        this.level = 1;
        this.xp = 0;
        this.winStreak = 0;
        this.bestStreak = 0;
        this.upgrades = { autobot: 0, insurance: 0, oracle: 0 };
        this.quests = JSON.parse(JSON.stringify(INITIAL_QUESTS));
        this.stats = {
            totalTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            totalProfit: 0,
            highestWin: 0,
            maxBalance: 10000,
            botEarnings: 0
        };
    }

    async init() {
        if (!dbService.currentUsername) {
            return false;
        }

        const saved = await dbService.loadGameState();
        if (saved) {
            this.avatar = saved.avatar || "👑";
            this.balance = saved.balance !== undefined ? saved.balance : 10000;
            this.level = saved.level || 1;
            this.xp = saved.xp || 0;
            this.winStreak = saved.winStreak || 0;
            this.bestStreak = saved.bestStreak || 0;
            this.upgrades = { ...this.upgrades, ...(saved.upgrades || {}) };
            this.stats = { ...this.stats, ...(saved.stats || {}) };
            
            if (saved.quests && Array.isArray(saved.quests)) {
                this.quests = INITIAL_QUESTS.map(q => {
                    const found = saved.quests.find(sq => sq.id === q.id);
                    return found ? { ...q, ...found } : q;
                });
            }
        } else {
            this.resetLocalState();
            this.notifyChange();
        }

        this.startAutoBotLoop();
        this.notifyChange();
        return true;
    }

    async loginAsUser(username, avatar = "👑") {
        if (!username || !username.trim()) return false;
        this.avatar = avatar || "👑";
        dbService.setCurrentUsername(username.trim());
        localStorage.setItem('apex_player_display_name', username.trim());
        await this.init();
        return true;
    }

    setAvatar(newAvatar) {
        this.avatar = newAvatar;
        this.notifyChange();
    }

    async deleteAccount() {
        if (!dbService.currentUsername) return;
        const user = dbService.currentUsername;
        await dbService.deleteAccount(user);
        this.resetLocalState();
        if (this.autoBotTimer) clearInterval(this.autoBotTimer);
        this.listeners.forEach(cb => cb(this));
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyChange() {
        this.listeners.forEach(cb => cb(this));
        
        if (dbService.currentUsername) {
            const rank = this.getRankInfo();
            const gameState = {
                avatar: this.avatar,
                balance: this.balance,
                level: this.level,
                xp: this.xp,
                winStreak: this.winStreak,
                bestStreak: this.bestStreak,
                upgrades: this.upgrades,
                stats: this.stats,
                quests: this.quests,
                rankName: rank.name
            };
            dbService.saveGameState(gameState);
        }
    }

    getXpNeededForNextLevel() {
        return Math.floor(100 * Math.pow(1.35, this.level - 1));
    }

    getRankInfo() {
        let currentRank = RANKS[0];
        for (const r of RANKS) {
            if (this.level >= r.level) {
                currentRank = r;
            }
        }
        return currentRank;
    }

    addXp(amount) {
        const streakBonus = Math.min(1.0, this.winStreak * 0.1);
        const totalXp = Math.round(amount * (1 + streakBonus));

        this.xp += totalXp;
        let leveledUp = false;

        while (this.xp >= this.getXpNeededForNextLevel()) {
            this.xp -= this.getXpNeededForNextLevel();
            this.level++;
            leveledUp = true;
            const bonusReward = this.level * 1000;
            this.balance += bonusReward;
        }

        if (leveledUp) {
            sfx.playLevelUp();
            this.updateQuestProgress('q_reach_lvl3', this.level);
            window.dispatchEvent(new CustomEvent('apex_level_up', {
                detail: { level: this.level, rank: this.getRankInfo() }
            }));
        }

        this.notifyChange();
        return { leveledUp, gainedXp: totalXp };
    }

    addBalance(amount) {
        this.balance += amount;
        if (this.balance > this.stats.maxBalance) {
            this.stats.maxBalance = this.balance;
        }
        this.notifyChange();
    }

    deductBalance(amount) {
        if (this.balance < amount) return false;
        this.balance -= amount;
        this.notifyChange();
        return true;
    }

    resetAccount() {
        this.balance = 10000;
        this.level = 1;
        this.xp = 0;
        this.winStreak = 0;
        this.upgrades = { autobot: 0, insurance: 0, oracle: 0 };
        this.quests = JSON.parse(JSON.stringify(INITIAL_QUESTS));
        this.stats = {
            totalTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            totalProfit: 0,
            highestWin: 0,
            maxBalance: 10000
        };
        this.notifyChange();
    }

    handleTradeClosed(trade) {
        this.stats.totalTrades++;
        this.updateQuestProgress('q_first_trade', 1);

        if (trade.leverage >= 25) {
            this.updateQuestProgress('q_high_lev', 1);
        }

        if (trade.pnl > 0) {
            this.stats.winTrades++;
            this.stats.totalProfit += trade.pnl;
            this.winStreak++;
            if (this.winStreak > this.bestStreak) {
                this.bestStreak = this.winStreak;
            }
            if (trade.pnl > this.stats.highestWin) {
                this.stats.highestWin = trade.pnl;
            }

            sfx.playWinProfit();
            const xpGained = Math.max(20, Math.floor(trade.pnl / 15));
            this.addXp(xpGained);

            this.updateQuestProgress('q_win_3', this.winStreak);
            if (trade.pnl >= 500) {
                this.updateQuestProgress('q_big_profit', 1);
            }
        } else {
            this.stats.lossTrades++;
            this.winStreak = 0;
            sfx.playLoss();
            this.addXp(10);
        }

        this.addBalance(trade.pnl + trade.margin);
    }

    handleLiquidation(position) {
        this.stats.totalTrades++;
        this.stats.lossTrades++;
        this.winStreak = 0;

        const insuranceLvl = this.upgrades.insurance || 0;
        let cashback = 0;
        if (insuranceLvl > 0) {
            cashback = position.margin * (insuranceLvl * 0.15);
            this.balance += cashback;
        }

        sfx.playLoss();
        this.addXp(15);
        this.notifyChange();

        return cashback;
    }

    updateQuestProgress(questId, progressValue) {
        const quest = this.quests.find(q => q.id === questId);
        if (quest && !quest.completed) {
            quest.progress = Math.max(quest.progress, progressValue);
            if (quest.progress >= quest.target) {
                quest.completed = true;
                window.dispatchEvent(new CustomEvent('apex_quest_complete', { detail: quest }));
            }
            this.notifyChange();
        }
    }

    claimQuestReward(questId) {
        const quest = this.quests.find(q => q.id === questId);
        if (quest && quest.completed && !quest.claimed) {
            quest.claimed = true;
            this.balance += quest.rewardCash;
            this.addXp(quest.rewardXp);
            sfx.playWinProfit();
            this.notifyChange();
            return true;
        }
        return false;
    }

    getItemUpgradeCost(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return 0;
        const currentLvl = this.upgrades[itemId] || 0;
        if (currentLvl >= item.maxLevel) return -1;
        return Math.floor(item.baseCost * Math.pow(item.costMultiplier, currentLvl));
    }

    buyItemUpgrade(itemId) {
        const cost = this.getItemUpgradeCost(itemId);
        if (cost <= 0) return { success: false, msg: "Item sudah mencapai level maksimal!" };

        if (this.balance < cost) {
            return { success: false, msg: `Saldo tidak cukup! Butuh $${cost.toLocaleString()}` };
        }

        this.balance -= cost;
        this.upgrades[itemId] = (this.upgrades[itemId] || 0) + 1;
        sfx.playBuy();
        this.addXp(50);
        this.updateQuestProgress('q_buy_upgrade', 1);
        this.notifyChange();
        return { success: true, newLevel: this.upgrades[itemId] };
    }

    startAutoBotLoop() {
        if (this.autoBotTimer) clearInterval(this.autoBotTimer);
        this.autoBotTimer = setInterval(() => {
            const botLvl = this.upgrades.autobot || 0;
            if (botLvl > 0) {
                const profit = botLvl * 15;
                this.balance += profit;
                this.stats.totalProfit += profit;
                this.stats.botEarnings = (this.stats.botEarnings || 0) + profit;
                this.addXp(2 * botLvl);
                window.dispatchEvent(new CustomEvent('apex_bot_profit', { detail: { profit } }));
            }
        }, 3000);
    }
}

export const game = new GameEngine();
