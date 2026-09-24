/**
 * DATABASE SERVICE (FIREBASE / LOCALSTORAGE ADAPTER)
 * =====================================================================
 * Mendukung multi-user berdasarkan Username.
 * - Login ke username yang sama akan langsung memuat data akun tersebut.
 * - Akun baru dibuat jika username belum pernah ada.
 * - Mendukung fitur Hapus Akun & Switch Akun.
 * - Sinkronisasi Leaderboard otomatis dari seluruh data username.
 * =====================================================================
 */

import { getFirebaseConfig, isFirebaseConfigured } from './firebase-config.js';

export class DatabaseService {
    constructor() {
        this.isFirebaseReady = false;
        this.db = null;
        this.auth = null;
        this.currentUsername = localStorage.getItem('apex_active_username') || null;
        this.initFirebase();
    }

    async initFirebase() {
        if (!isFirebaseConfigured()) {
            console.log('⚡ Database: Mode LocalStorage (Username-based accounts)');
            this.isFirebaseReady = false;
            return false;
        }

        try {
            if (!window.firebase) return false;
            const config = getFirebaseConfig();
            if (!window.firebase.apps.length) {
                window.firebase.initializeApp(config);
            }

            this.db = window.firebase.firestore ? window.firebase.firestore() : null;
            this.auth = window.firebase.auth ? window.firebase.auth() : null;

            if (this.auth) {
                try {
                    await this.auth.signInAnonymously();
                } catch (e) {}
            }

            this.isFirebaseReady = !!this.db;
            console.log('🔥 Firebase Connected successfully for Multi-User system!');
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            this.isFirebaseReady = false;
            return false;
        }
    }

    sanitizeUsername(username) {
        if (!username) return '';
        return username.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    }

    setCurrentUsername(username) {
        const clean = this.sanitizeUsername(username);
        this.currentUsername = clean;
        if (clean) {
            localStorage.setItem('apex_active_username', clean);
            this.registerUserInLocalRegistry(clean, username.trim());
        } else {
            localStorage.removeItem('apex_active_username');
        }
    }

    registerUserInLocalRegistry(cleanUsername, displayName) {
        try {
            const reg = JSON.parse(localStorage.getItem('apex_users_registry') || '[]');
            const existing = reg.find(u => u.username === cleanUsername);
            if (existing) {
                existing.displayName = displayName;
                existing.lastActive = Date.now();
            } else {
                reg.push({ username: cleanUsername, displayName: displayName, lastActive: Date.now() });
            }
            localStorage.setItem('apex_users_registry', JSON.stringify(reg));
        } catch (e) {}
    }

    /**
     * Memuat data akun pemain berdasarkan username aktif
     */
    async loadGameState() {
        if (!this.currentUsername) return null;
        const clean = this.sanitizeUsername(this.currentUsername);

        // 1. Coba dari Firebase Firestore
        if (this.isFirebaseReady && this.db) {
            try {
                const doc = await this.db.collection('players').doc(clean).get();
                if (doc.exists) {
                    const cloudData = doc.data();
                    localStorage.setItem(`apex_acc_${clean}`, JSON.stringify(cloudData));
                    return cloudData;
                }
            } catch (err) {
                console.warn('Gagal membaca data user dari Firebase:', err);
            }
        }

        // 2. Fallback ke LocalStorage
        try {
            const localData = localStorage.getItem(`apex_acc_${clean}`);
            if (localData) {
                return JSON.parse(localData);
            }
        } catch (e) {
            console.error('Error parsing local account state:', e);
        }

        return null; // Mengindikasikan akun baru
    }

    /**
     * Menyimpan data akun game pemain & update Leaderboard
     */
    async saveGameState(gameState) {
        if (!this.currentUsername) return;
        const clean = this.sanitizeUsername(this.currentUsername);
        const displayName = localStorage.getItem('apex_player_display_name') || this.currentUsername;

        const dataToSave = {
            ...gameState,
            username: clean,
            displayName: displayName,
            avatar: gameState.avatar || "👑",
            lastUpdated: Date.now()
        };

        // Simpan ke local storage
        try {
            localStorage.setItem(`apex_acc_${clean}`, JSON.stringify(dataToSave));
            this.registerUserInLocalRegistry(clean, displayName);
        } catch (e) {}

        // Simpan ke Firebase Firestore
        if (this.isFirebaseReady && this.db) {
            try {
                await this.db.collection('players').doc(clean).set({
                    ...dataToSave,
                    serverTime: window.firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // Sync ke leaderboard collection
                await this.db.collection('leaderboard').doc(clean).set({
                    username: clean,
                    name: displayName,
                    avatar: gameState.avatar || "👑",
                    netWorth: Math.round(gameState.balance || 0),
                    winRate: gameState.stats?.totalTrades > 0 ? ((gameState.stats.winTrades / gameState.stats.totalTrades) * 100).toFixed(1) + '%' : '0.0%',
                    rank: gameState.rankName || 'Novice Trader',
                    trades: gameState.stats?.totalTrades || 0,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.warn('Gagal sync data user ke Firebase:', err);
            }
        }
    }

    /**
     * Hapus akun user sepenuhnya (Reset total)
     */
    async deleteAccount(username) {
        const clean = this.sanitizeUsername(username || this.currentUsername);
        if (!clean) return;

        // Hapus dari LocalStorage
        try {
            localStorage.removeItem(`apex_acc_${clean}`);
            const reg = JSON.parse(localStorage.getItem('apex_users_registry') || '[]');
            const filtered = reg.filter(u => u.username !== clean);
            localStorage.setItem('apex_users_registry', JSON.stringify(filtered));
        } catch (e) {}

        // Hapus dari Firebase
        if (this.isFirebaseReady && this.db) {
            try {
                await this.db.collection('players').doc(clean).delete();
                await this.db.collection('leaderboard').doc(clean).delete();
            } catch (err) {
                console.warn('Gagal menghapus akun di Firebase:', err);
            }
        }

        if (this.currentUsername === clean) {
            this.currentUsername = null;
            localStorage.removeItem('apex_active_username');
            localStorage.removeItem('apex_player_display_name');
        }
    }

    /**
     * Mengambil Leaderboard dari semua user yang terdaftar
     */
    async loadLeaderboard() {
        // 1. Ambil dari Firebase jika ready
        if (this.isFirebaseReady && this.db) {
            try {
                const snapshot = await this.db.collection('leaderboard')
                    .orderBy('netWorth', 'desc')
                    .limit(25)
                    .get();

                if (!snapshot.empty) {
                    const list = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        list.push({
                            ...data,
                            isCurrentPlayer: data.username === this.currentUsername
                        });
                    });
                    return list;
                }
            } catch (err) {
                console.warn('Gagal load leaderboard dari Firebase:', err);
            }
        }

        // 2. Ambil dari seluruh akun lokal
        try {
            const reg = JSON.parse(localStorage.getItem('apex_users_registry') || '[]');
            const list = [];

            reg.forEach(item => {
                const accData = localStorage.getItem(`apex_acc_${item.username}`);
                if (accData) {
                    try {
                        const parsed = JSON.parse(accData);
                        const total = parsed.stats?.totalTrades || 0;
                        const winRate = total > 0 ? ((parsed.stats.winTrades / total) * 100).toFixed(1) + '%' : '0.0%';
                        list.push({
                            username: item.username,
                            name: parsed.displayName || item.displayName || item.username,
                            avatar: parsed.avatar || "👑",
                            netWorth: Math.round(parsed.balance || 0),
                            winRate: winRate,
                            rank: parsed.rankName || 'Trader',
                            trades: total,
                            isCurrentPlayer: item.username === this.currentUsername
                        });
                    } catch (e) {}
                }
            });

            // Urutkan berdasarkan Net Worth tertinggi
            list.sort((a, b) => b.netWorth - a.netWorth);

            // Jika masih kosong / user baru pertama kali
            if (list.length === 0) {
                list.push({
                    username: this.currentUsername || 'kamu',
                    name: localStorage.getItem('apex_player_display_name') || this.currentUsername || 'Trader Kamu',
                    avatar: "👑",
                    netWorth: 10000,
                    winRate: '0.0%',
                    rank: 'Novice Trader',
                    trades: 0,
                    isCurrentPlayer: true
                });
            }

            return list;
        } catch (e) {
            return [];
        }
    }

    getStatus() {
        return {
            isFirebase: this.isFirebaseReady,
            username: this.currentUsername,
            mode: this.isFirebaseReady ? 'Firebase Cloud Connected' : 'Local Mode (Username Storage)'
        };
    }
}

export const dbService = new DatabaseService();
