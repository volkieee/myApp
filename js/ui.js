/**
 * USER INTERFACE CONTROLLER & RENDERING ENGINE (MULTI-USER EDITION)
 * =====================================================================
 * Mengelola interaksi DOM, Login Username Onboarding, Manajemen Akun,
 * Leaderboard Sultan Nyata, Modals, Sound SFX, dan Chart Updates.
 * =====================================================================
 */

import { engine, ASSETS } from './engine.js';
import { game, SHOP_ITEMS } from './game.js';
import { eventManager } from './events.js';
import { sfx } from './audio.js';
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, isFirebaseConfigured } from './firebase/firebase-config.js';
import { dbService } from './firebase/db-service.js';

export class UIController {
    constructor(chartInstance) {
        this.chart = chartInstance;
        this.selectedOrderType = 'LONG';
        this.selectedLeverage = 10;
        this.selectedMargin = 100;
        this.useTp = false;
        this.useSl = false;
        this.tpPercent = 50;
        this.slPercent = 25;
        this.activeTab = 'positions';
    }

    async init() {
        this.bindEvents();

        // 1. Cek apakah user sudah punya username aktif
        if (!dbService.currentUsername) {
            this.showLoginModal(true);
        } else {
            await game.init();
            this.renderAll();
        }

        // Listeners dari Engine & Game
        engine.onUpdate((type) => {
            this.handleEngineUpdate(type);
        });

        game.onChange(() => {
            this.renderHeader();
            this.renderOrderFormMetrics();
            this.renderShop();
            this.renderQuests();
        });

        eventManager.onEvent((evt) => {
            this.handleMarketEvent(evt);
        });

        window.addEventListener('apex_level_up', (e) => {
            this.showLevelUpModal(e.detail);
        });

        window.addEventListener('apex_liquidation', (e) => {
            this.showLiquidationAlert(e.detail);
        });

        window.addEventListener('apex_quest_complete', (e) => {
            this.showToast(`🎯 Quest Selesai: ${e.detail.title}! Buka menu Hadiah untuk klaim.`, 'success');
        });

        window.addEventListener('apex_bot_profit', (e) => {
            this.flashBotIndicator(e.detail.profit);
        });

        // Loop rendering chart
        const renderLoop = () => {
            this.chart.render();
            requestAnimationFrame(renderLoop);
        };
        requestAnimationFrame(renderLoop);
    }

    renderAll() {
        this.renderAssetList();
        this.renderHeader();
        this.renderOrderFormMetrics();
        this.renderShop();
        this.renderQuests();
        this.renderHistory();
    }

    handleEngineUpdate(type) {
        this.renderTickerPrice();
        this.renderOrderBook();
        this.renderPositions();
        this.updateSentimentGauge();
        if (type === 'ASSET_CHANGE') {
            this.renderAssetList();
            this.renderOrderFormMetrics();
        }
    }

    showLoginModal(isForced = false) {
        const modal = document.getElementById('loginModal');
        if (!modal) return;
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.style.display = isForced ? 'none' : 'block';
        }
        
        this.renderAvatarSelector('loginAvatarSelector', game.avatar || '👑');
        modal.classList.add('active');
        const input = document.getElementById('loginUsernameInput');
        if (input) setTimeout(() => input.focus(), 150);
    }

    renderAvatarSelector(containerId, selectedAvatar) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const avatars = [
            { icon: "👑", name: "Raja Sultan" },
            { icon: "🦁", name: "Singa Alpha" },
            { icon: "🐺", name: "Wolf" },
            { icon: "🐋", name: "Whale" },
            { icon: "🤖", name: "AI Cyborg" },
            { icon: "💎", name: "Diamond" },
            { icon: "🥷", name: "Ninja" },
            { icon: "🚀", name: "Rocket" }
        ];

        container.innerHTML = avatars.map(a => `
            <div class="avatar-option ${a.icon === selectedAvatar ? 'selected' : ''}" data-avatar="${a.icon}" title="${a.name}">
                ${a.icon}
            </div>
        `).join('');

        container.querySelectorAll('.avatar-option').forEach(el => {
            el.onclick = () => {
                container.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
                el.classList.add('selected');
                sfx.playClick();
            };
        });
    }

    renderHeader() {
        // Current Username & Avatar Display
        const username = dbService.currentUsername || 'Tamu';
        const userBtn = document.getElementById('headerUsernameLabel');
        const userAvatarIcon = document.getElementById('headerAvatarIcon');

        if (userBtn) userBtn.textContent = `@${username}`;
        if (userAvatarIcon) userAvatarIcon.textContent = game.avatar || '👑';

        // Balance
        const balEl = document.getElementById('userBalance');
        if (balEl) balEl.textContent = `$${game.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Level & Rank
        const rank = game.getRankInfo();
        const rankBadge = document.getElementById('userRankBadge');
        if (rankBadge) {
            rankBadge.innerHTML = `<span style="color:${rank.color}">${rank.icon} ${rank.name}</span> (Lv. ${game.level})`;
        }

        // XP Bar
        const xpNeeded = game.getXpNeededForNextLevel();
        const xpPercent = Math.min(100, Math.round((game.xp / xpNeeded) * 100));
        const xpBar = document.getElementById('xpProgressBar');
        const xpText = document.getElementById('xpText');
        if (xpBar) xpBar.style.width = `${xpPercent}%`;
        if (xpText) xpText.textContent = `${game.xp} / ${xpNeeded} XP (${xpPercent}%)`;

        // Win Streak
        const streakEl = document.getElementById('winStreakBadge');
        if (streakEl) {
            if (game.winStreak > 0) {
                streakEl.style.display = 'inline-flex';
                streakEl.innerHTML = `🔥 Streak: <strong>${game.winStreak}x</strong> (+${Math.min(100, game.winStreak * 10)}% XP)`;
            } else {
                streakEl.style.display = 'none';
            }
        }

        // Database Status Badge
        const dbBadge = document.getElementById('dbStatusBadge');
        if (dbBadge) {
            const isCloud = isFirebaseConfigured();
            if (isCloud) {
                dbBadge.className = 'db-badge cloud';
                dbBadge.innerHTML = `<i class="fa-solid fa-cloud"></i> Firebase Sync`;
                dbBadge.title = 'Terhubung ke Firebase Cloud Firestore';
            } else {
                dbBadge.className = 'db-badge local';
                dbBadge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> Local Multi-User`;
                dbBadge.title = 'Mode Offline / LocalStorage (Klik untuk setup Firebase)';
            }
        }
    }

    renderAssetList() {
        const container = document.getElementById('assetListContainer');
        if (!container) return;

        container.innerHTML = '';
        Object.keys(ASSETS).forEach(sym => {
            const asset = ASSETS[sym];
            const pData = engine.prices[sym] || { price: asset.basePrice, change24h: 0 };
            const isSelected = sym === engine.selectedAsset;
            const isUp = pData.change24h >= 0;

            const card = document.createElement('div');
            card.className = `asset-card ${isSelected ? 'active' : ''}`;
            card.onclick = () => {
                sfx.playClick();
                engine.selectAsset(sym);
            };

            card.innerHTML = `
                <div class="asset-info">
                    <i class="${asset.icon}" style="color:${asset.color}"></i>
                    <div>
                        <div class="asset-symbol">${sym}</div>
                        <div class="asset-name">${asset.name}</div>
                    </div>
                </div>
                <div class="asset-pricing">
                    <div class="asset-price">$${pData.price.toFixed(asset.decimals)}</div>
                    <div class="asset-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${pData.change24h.toFixed(2)}%</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderTickerPrice() {
        const sym = engine.selectedAsset;
        const asset = ASSETS[sym];
        const pData = engine.prices[sym];
        if (!pData) return;

        const mainPriceEl = document.getElementById('heroCurrentPrice');
        const mainChangeEl = document.getElementById('heroPriceChange');
        const highEl = document.getElementById('heroHigh24');
        const lowEl = document.getElementById('heroLow24');

        if (mainPriceEl) {
            const prev = parseFloat(mainPriceEl.getAttribute('data-prev') || pData.price);
            mainPriceEl.textContent = `$${pData.price.toFixed(asset.decimals)}`;
            mainPriceEl.setAttribute('data-prev', pData.price);

            if (pData.price > prev) {
                mainPriceEl.className = 'hero-price flash-green';
            } else if (pData.price < prev) {
                mainPriceEl.className = 'hero-price flash-red';
            }
        }

        if (mainChangeEl) {
            const isUp = pData.change24h >= 0;
            mainChangeEl.textContent = `${isUp ? '+' : ''}${pData.change24h.toFixed(2)}%`;
            mainChangeEl.className = `badge-change ${isUp ? 'up' : 'down'}`;
        }

        if (highEl) highEl.textContent = `$${(pData.price * 1.03).toFixed(asset.decimals)}`;
        if (lowEl) lowEl.textContent = `$${(pData.price * 0.97).toFixed(asset.decimals)}`;
    }

    renderOrderBook() {
        const asksContainer = document.getElementById('orderBookAsks');
        const bidsContainer = document.getElementById('orderBookBids');
        if (!asksContainer || !bidsContainer) return;

        const { asks, bids } = engine.orderBook;

        asksContainer.innerHTML = asks.map(a => `
            <div class="ob-row ask">
                <span class="ob-price">${a.price}</span>
                <span class="ob-vol">${a.volume}</span>
            </div>
        `).join('');

        bidsContainer.innerHTML = bids.map(b => `
            <div class="ob-row bid">
                <span class="ob-price">${b.price}</span>
                <span class="ob-vol">${b.volume}</span>
            </div>
        `).join('');
    }

    renderOrderFormMetrics() {
        const sym = engine.selectedAsset;
        const curPrice = engine.getCurrentPrice(sym);
        const lev = this.selectedLeverage;
        const margin = this.selectedMargin;

        const posValue = margin * lev;
        const liqDistance = (curPrice / lev) * 0.9;
        const estLiq = this.selectedOrderType === 'LONG' ? Math.max(0, curPrice - liqDistance) : curPrice + liqDistance;
        const decimals = ASSETS[sym] ? ASSETS[sym].decimals : 2;

        const valEl = document.getElementById('calcPositionValue');
        const liqEl = document.getElementById('calcEstLiq');
        const maxLev = game.getRankInfo().maxLeverage;

        if (valEl) valEl.textContent = `$${posValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (liqEl) liqEl.textContent = `$${estLiq.toFixed(decimals)}`;

        const levBtns = document.querySelectorAll('.lev-btn');
        levBtns.forEach(btn => {
            const btnLev = parseInt(btn.dataset.lev);
            if (btnLev > maxLev) {
                btn.classList.add('locked');
                btn.title = `Terkunci! Butuh Rank lebih tinggi untuk membuka leverage ${btnLev}x`;
            } else {
                btn.classList.remove('locked');
                btn.title = '';
            }
            if (btnLev === this.selectedLeverage) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    renderPositions() {
        const container = document.getElementById('activePositionsList');
        const countBadge = document.getElementById('openPositionsCount');
        if (!container) return;

        const positions = engine.positions;
        if (countBadge) countBadge.textContent = positions.length;

        if (positions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-chart-line"></i>
                    <p>Tidak ada posisi trading aktif. Pilih aset & pasang order Long / Short sekarang!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = positions.map(pos => {
            const isProfit = pos.pnl >= 0;
            const decimals = ASSETS[pos.symbol] ? ASSETS[pos.symbol].decimals : 2;
            return `
                <div class="position-card ${pos.type.toLowerCase()}">
                    <div class="pos-header">
                        <div class="pos-title">
                            <span class="pos-type-badge ${pos.type.toLowerCase()}">${pos.type}</span>
                            <strong>${pos.symbol}</strong>
                            <span class="pos-lev">${pos.leverage}x</span>
                        </div>
                        <div class="pos-pnl ${isProfit ? 'profit' : 'loss'}">
                            ${isProfit ? '+' : ''}$${pos.pnl.toFixed(2)} (${isProfit ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)
                        </div>
                    </div>
                    <div class="pos-details-grid">
                        <div>Entry: <span>$${pos.entryPrice.toFixed(decimals)}</span></div>
                        <div>Current: <span>$${pos.currentPrice.toFixed(decimals)}</span></div>
                        <div>Margin: <span>$${pos.margin.toFixed(2)}</span></div>
                        <div>Liq. Price: <span class="liq-warn">$${pos.liqPrice.toFixed(decimals)}</span></div>
                    </div>
                    <div class="pos-actions">
                        <button class="btn-close-pos" onclick="window.ApexUI.closePosition('${pos.id}')">
                            <i class="fa-solid fa-xmark"></i> Tutup Posisi
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async renderHistory() {
        const container = document.getElementById('tradeHistoryList');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <p>Riwayat order selesai akan tersimpan di profil akunmu.</p>
            </div>
        `;
    }

    renderShop() {
        const container = document.getElementById('shopItemsContainer');
        if (!container) return;

        container.innerHTML = SHOP_ITEMS.map(item => {
            const curLvl = game.upgrades[item.id] || 0;
            const cost = game.getItemUpgradeCost(item.id);
            const isMax = curLvl >= item.maxLevel;
            const canAfford = game.balance >= cost && !isMax;

            return `
                <div class="shop-card">
                    <div class="shop-header">
                        <h4>${item.name}</h4>
                        <span class="shop-level-badge">Level ${curLvl}/${item.maxLevel}</span>
                    </div>
                    <p class="shop-desc">${item.desc}</p>
                    <div class="shop-effect">Status: <strong>${item.getEffectDesc(curLvl)}</strong></div>
                    <button class="btn-upgrade ${canAfford ? 'active' : ''} ${isMax ? 'maxed' : ''}" 
                        onclick="window.ApexUI.buyUpgrade('${item.id}')" ${!canAfford ? 'disabled' : ''}>
                        ${isMax ? 'LEVEL MAKSIMAL' : `<i class="fa-solid fa-bolt"></i> Upgrade ($${cost.toLocaleString()})`}
                    </button>
                </div>
            `;
        }).join('');
    }

    renderQuests() {
        const container = document.getElementById('questsContainer');
        if (!container) return;

        container.innerHTML = game.quests.map(q => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            return `
                <div class="quest-card ${q.claimed ? 'claimed' : q.completed ? 'ready' : ''}">
                    <div class="quest-info">
                        <h4>${q.title}</h4>
                        <p>${q.desc}</p>
                        <div class="quest-reward">
                            <span>🎁 +$${q.rewardCash.toLocaleString()}</span>
                            <span>⭐ +${q.rewardXp} XP</span>
                        </div>
                        <div class="quest-progress-bar">
                            <div class="bar-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                    <div class="quest-action">
                        ${q.claimed ? '<span class="badge-claimed"><i class="fa-solid fa-check"></i> Diklaim</span>' :
                          q.completed ? `<button class="btn-claim-quest pulse" onclick="window.ApexUI.claimQuest('${q.id}')">KLAIM REWARD</button>` :
                          `<span class="quest-status">${q.progress}/${q.target}</span>`}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateSentimentGauge() {
        const sentimentMod = eventManager.getSentimentModifier(engine.selectedAsset);
        const gaugeEl = document.getElementById('sentimentGaugeFill');
        const labelEl = document.getElementById('sentimentLabel');
        if (!gaugeEl || !labelEl) return;

        let pct = 50 + (sentimentMod * 15);
        pct = Math.max(10, Math.min(90, pct));
        gaugeEl.style.width = `${pct}%`;

        if (pct > 60) {
            labelEl.textContent = 'BULLISH SURGE 🚀';
            labelEl.style.color = '#10b981';
        } else if (pct < 40) {
            labelEl.textContent = 'BEARISH PANIC 📉';
            labelEl.style.color = '#ef4444';
        } else {
            labelEl.textContent = 'NEUTRAL / RANGING';
            labelEl.style.color = '#94a3b8';
        }
    }

    handleMarketEvent(evt) {
        if (evt.type === 'EVENT_STARTED') {
            const newsBanner = document.getElementById('breakingNewsBanner');
            const newsText = document.getElementById('breakingNewsText');
            if (newsBanner && newsText) {
                newsText.textContent = `${evt.event.title} - ${evt.event.desc}`;
                newsBanner.className = `breaking-news-bar active ${evt.event.type}`;
            }
            this.showToast(`🚨 BREAKING EVENT: ${evt.event.title}`, evt.event.type === 'positive' ? 'success' : 'error');
        } else if (evt.type === 'EVENT_ENDED') {
            const newsBanner = document.getElementById('breakingNewsBanner');
            if (newsBanner) {
                newsBanner.className = 'breaking-news-bar';
            }
        }
    }

    flashBotIndicator(amount) {
        const botEl = document.getElementById('botEarningsFlash');
        if (botEl) {
            botEl.textContent = `+$${amount} (AI Bot)`;
            botEl.classList.add('show');
            setTimeout(() => botEl.classList.remove('show'), 1200);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    showLevelUpModal(detail) {
        const modal = document.getElementById('levelUpModal');
        const lvlEl = document.getElementById('modalNewLevel');
        const rankEl = document.getElementById('modalNewRank');
        if (modal && lvlEl && rankEl) {
            lvlEl.textContent = `LEVEL ${detail.level}`;
            rankEl.innerHTML = `${detail.rank.icon} ${detail.rank.name} (Max Leverage: ${detail.rank.maxLeverage}x)`;
            modal.classList.add('active');
        }
    }

    showLiquidationAlert(detail) {
        sfx.playLoss();
        this.showToast(`💥 POSISI TERLIKUIDASI! Kerugian: -$${detail.position.margin.toFixed(2)}. ${detail.cashback > 0 ? `🛡️ Asuransi mengembalikan +$${detail.cashback.toFixed(2)}!` : ''}`, 'error');
    }

    bindEvents() {
        // Form Login / Buat Akun
        const loginForm = document.getElementById('loginUsernameForm');
        if (loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                const username = document.getElementById('loginUsernameInput').value.trim();
                if (!username || username.length < 2) {
                    this.showToast('Username minimal 2 karakter!', 'error');
                    return;
                }

                // Ambil avatar yang dipilih
                const selectedOpt = document.querySelector('#loginAvatarSelector .avatar-option.selected');
                const avatar = selectedOpt ? selectedOpt.dataset.avatar : "👑";

                await game.loginAsUser(username, avatar);
                document.getElementById('loginModal').classList.remove('active');
                this.renderAll();
                this.showToast(`Selamat datang ${avatar}, Sultan ${username}!`, 'success');
            };
        }

        // Tombol Switch / Ganti Akun
        const btnSwitchAcc = document.getElementById('btnSwitchAccount');
        if (btnSwitchAcc) {
            btnSwitchAcc.onclick = () => {
                document.getElementById('profileModal').classList.remove('active');
                this.showLoginModal(false);
            };
        }

        // Tombol Hapus Akun Ini (Reset Total)
        const btnDeleteAcc = document.getElementById('btnDeleteAccount');
        if (btnDeleteAcc) {
            btnDeleteAcc.onclick = async () => {
                const user = dbService.currentUsername;
                if (!user) return;

                if (confirm(`⚠️ PERINGATAN: Yakin ingin MENGHAPUS AKUN "${user}"? Semua saldo, level, upgrade, dan statistik trading akan HANGUS TOTAL!`)) {
                    await game.deleteAccount();
                    document.getElementById('profileModal').classList.remove('active');
                    this.showToast(`Akun "${user}" berhasil dihapus bersih!`, 'info');
                    this.showLoginModal(true);
                }
            };
        }

        // Tab Order Type (Long / Short)
        const btnLong = document.getElementById('btnOrderLong');
        const btnShort = document.getElementById('btnOrderShort');
        if (btnLong && btnShort) {
            btnLong.onclick = () => {
                this.selectedOrderType = 'LONG';
                btnLong.classList.add('active');
                btnShort.classList.remove('active');
                this.renderOrderFormMetrics();
                sfx.playClick();
            };
            btnShort.onclick = () => {
                this.selectedOrderType = 'SHORT';
                btnShort.classList.add('active');
                btnLong.classList.remove('active');
                this.renderOrderFormMetrics();
                sfx.playClick();
            };
        }

        // Leverage Buttons
        const levBtns = document.querySelectorAll('.lev-btn');
        levBtns.forEach(btn => {
            btn.onclick = () => {
                const maxLev = game.getRankInfo().maxLeverage;
                const lev = parseInt(btn.dataset.lev);
                if (lev > maxLev) {
                    this.showToast(`Leverage ${lev}x terkunci! Naikkan level trader kamu.`, 'error');
                    return;
                }
                this.selectedLeverage = lev;
                this.renderOrderFormMetrics();
                sfx.playClick();
            };
        });

        // Margin Amount Input
        const marginInput = document.getElementById('inputMarginAmount');
        if (marginInput) {
            marginInput.oninput = (e) => {
                this.selectedMargin = Math.max(1, parseFloat(e.target.value) || 0);
                this.renderOrderFormMetrics();
            };
        }

        // Quick % Margin Buttons
        const pctBtns = document.querySelectorAll('.pct-btn');
        pctBtns.forEach(btn => {
            btn.onclick = () => {
                const pct = parseInt(btn.dataset.pct);
                const amount = Math.floor(game.balance * (pct / 100));
                this.selectedMargin = Math.max(10, amount);
                if (marginInput) marginInput.value = this.selectedMargin;
                this.renderOrderFormMetrics();
                sfx.playClick();
            };
        });

        // Execute Trade Button
        const btnExec = document.getElementById('btnExecuteTrade');
        if (btnExec) {
            btnExec.onclick = () => {
                const res = engine.openPosition({
                    type: this.selectedOrderType,
                    margin: this.selectedMargin,
                    leverage: this.selectedLeverage,
                    tpPercent: this.useTp ? this.tpPercent : null,
                    slPercent: this.useSl ? this.slPercent : null
                });

                if (!res.success) {
                    this.showToast(res.msg, 'error');
                } else {
                    this.showToast(`✅ Berhasil membuka posisi ${this.selectedOrderType} ${engine.selectedAsset}!`, 'success');
                    window.dispatchEvent(new CustomEvent('apex_trade_burst', { detail: { type: this.selectedOrderType } }));
                }
            };
        }

        // Close All Positions (Panic button)
        const btnPanic = document.getElementById('btnPanicCloseAll');
        if (btnPanic) {
            btnPanic.onclick = () => {
                const count = engine.closeAllPositions();
                if (count > 0) {
                    this.showToast(`🚨 Menutup seluruh ${count} posisi aktif!`, 'info');
                }
            };
        }

        // Timeframe Buttons
        const tfBtns = document.querySelectorAll('.tf-btn');
        tfBtns.forEach(btn => {
            btn.onclick = () => {
                tfBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                engine.setTimeframe(btn.dataset.tf);
                sfx.playClick();
            };
        });

        // Chart Type Toggle
        const chartTypeBtn = document.getElementById('btnToggleChartType');
        if (chartTypeBtn) {
            chartTypeBtn.onclick = () => {
                const nextType = this.chart.chartType === 'candlestick' ? 'line' : 'candlestick';
                this.chart.setChartType(nextType);
                chartTypeBtn.innerHTML = nextType === 'candlestick' ? '<i class="fa-solid fa-chart-candlestick"></i> Candles' : '<i class="fa-solid fa-chart-line"></i> Line Area';
                sfx.playClick();
            };
        }

        // Game Simulation Speed (1x, 2x, 5x)
        const speedBtn = document.getElementById('btnSimSpeed');
        if (speedBtn) {
            speedBtn.onclick = () => {
                const speeds = [1, 2, 5];
                const nextIdx = (speeds.indexOf(engine.simulationSpeed) + 1) % speeds.length;
                const newSpeed = speeds[nextIdx];
                engine.setSimulationSpeed(newSpeed);
                speedBtn.innerHTML = `<i class="fa-solid fa-forward"></i> Speed: ${newSpeed}x`;
                sfx.playClick();
            };
        }

        // Audio Mute Toggle
        const audioBtn = document.getElementById('btnToggleAudio');
        if (audioBtn) {
            audioBtn.onclick = () => {
                const muted = sfx.toggleMute();
                audioBtn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                audioBtn.className = `btn-icon ${muted ? 'muted' : ''}`;
            };
        }

        // Trigger Random Market Shock Button (For FUN!)
        const btnShock = document.getElementById('btnTriggerNewsEvent');
        if (btnShock) {
            btnShock.onclick = () => {
                eventManager.triggerRandomEvent();
            };
        }

        // Reset Account Funds
        const btnReset = document.getElementById('btnResetFunds');
        if (btnReset) {
            btnReset.onclick = () => {
                if (confirm('Yakin ingin mereset saldo game ke $10,000 demo cash?')) {
                    game.resetAccount();
                    this.showToast('Akun game berhasil direset ke $10,000!', 'info');
                }
            };
        }

        // Tab Positions vs History
        const tabPos = document.getElementById('tabActivePositions');
        const tabHist = document.getElementById('tabTradeHistory');
        const posView = document.getElementById('activePositionsView');
        const histView = document.getElementById('tradeHistoryView');

        if (tabPos && tabHist && posView && histView) {
            tabPos.onclick = () => {
                this.activeTab = 'positions';
                tabPos.classList.add('active');
                tabHist.classList.remove('active');
                posView.style.display = 'block';
                histView.style.display = 'none';
                sfx.playClick();
            };
            tabHist.onclick = () => {
                this.activeTab = 'history';
                tabHist.classList.add('active');
                tabPos.classList.remove('active');
                posView.style.display = 'none';
                histView.style.display = 'block';
                this.renderHistory();
                sfx.playClick();
            };
        }

        // Modal Open Buttons
        this.setupModalTrigger('btnOpenShopModal', 'shopModal');
        this.setupModalTrigger('btnOpenQuestsModal', 'questsModal');
        this.setupModalTrigger('btnOpenProfileModal', 'profileModal');
        this.setupModalTrigger('btnOpenTutorialModal', 'tutorialModal');
        this.setupModalTrigger('btnOpenLeaderboardModal', 'leaderboardModal');
        this.setupModalTrigger('dbStatusBadge', 'firebaseModal');

        // Close Modals
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.onclick = () => {
                // Jangan izinkan tutup login modal jika belum ada username aktif
                if (el.closest('#loginModal') && !dbService.currentUsername) {
                    return;
                }
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
                sfx.playClick();
            };
        });

        // Firebase Form Submit
        const fbForm = document.getElementById('firebaseConfigForm');
        if (fbForm) {
            const curCfg = getFirebaseConfig();
            document.getElementById('fbApiKey').value = curCfg.apiKey || '';
            document.getElementById('fbAuthDomain').value = curCfg.authDomain || '';
            document.getElementById('fbProjectId').value = curCfg.projectId || '';
            document.getElementById('fbStorageBucket').value = curCfg.storageBucket || '';
            document.getElementById('fbAppId').value = curCfg.appId || '';

            fbForm.onsubmit = async (e) => {
                e.preventDefault();
                const newCfg = {
                    apiKey: document.getElementById('fbApiKey').value.trim(),
                    authDomain: document.getElementById('fbAuthDomain').value.trim(),
                    projectId: document.getElementById('fbProjectId').value.trim(),
                    storageBucket: document.getElementById('fbStorageBucket').value.trim(),
                    appId: document.getElementById('fbAppId').value.trim()
                };

                try {
                    saveFirebaseConfig(newCfg);
                    await dbService.initFirebase();
                    this.renderHeader();
                    this.showToast('🔥 Firebase berhasil disimpan & dikoneksikan!', 'success');
                    document.getElementById('firebaseModal').classList.remove('active');
                } catch (err) {
                    this.showToast(err.message, 'error');
                }
            };

            const btnClearFb = document.getElementById('btnClearFirebase');
            if (btnClearFb) {
                btnClearFb.onclick = () => {
                    clearFirebaseConfig();
                    this.renderHeader();
                    this.showToast('Firebase dibersihkan. Kembali ke Local Mode.', 'info');
                    document.getElementById('firebaseModal').classList.remove('active');
                };
            }
        }
    }

    setupModalTrigger(btnId, modalId) {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = () => {
                if (modalId === 'profileModal') this.renderProfileStats();
                if (modalId === 'leaderboardModal') this.renderLeaderboard();
                modal.classList.add('active');
                sfx.playClick();
            };
        }
    }

    async renderLeaderboard() {
        const container = document.getElementById('leaderboardListContainer');
        const podiumContainer = document.getElementById('leaderboardPodium');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:15px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data sultan...</div>';

        const leaders = await dbService.loadLeaderboard();
        
        // Render Top 3 Podium
        if (podiumContainer) {
            if (leaders.length >= 3) {
                const [first, second, third] = leaders;
                podiumContainer.style.display = 'flex';
                podiumContainer.innerHTML = `
                    <div class="podium-item second">
                        <div class="podium-rank">🥈 #2</div>
                        <div class="podium-avatar">${second.avatar || '🦁'}</div>
                        <div class="podium-name">${second.name || second.username}</div>
                        <div class="podium-wealth">$${second.netWorth.toLocaleString()}</div>
                        <div class="podium-pedestal p2"></div>
                    </div>
                    <div class="podium-item first">
                        <div class="crown-icon">👑</div>
                        <div class="podium-rank">🥇 #1 SULTAN</div>
                        <div class="podium-avatar">${first.avatar || '👑'}</div>
                        <div class="podium-name">${first.name || first.username}</div>
                        <div class="podium-wealth">$${first.netWorth.toLocaleString()}</div>
                        <div class="podium-pedestal p1"></div>
                    </div>
                    <div class="podium-item third">
                        <div class="podium-rank">🥉 #3</div>
                        <div class="podium-avatar">${third.avatar || '🐺'}</div>
                        <div class="podium-name">${third.name || third.username}</div>
                        <div class="podium-wealth">$${third.netWorth.toLocaleString()}</div>
                        <div class="podium-pedestal p3"></div>
                    </div>
                `;
            } else {
                podiumContainer.style.display = 'none';
            }
        }

        // Render List
        container.innerHTML = leaders.map((trader, idx) => {
            const isMe = trader.isCurrentPlayer || trader.username === dbService.currentUsername;
            const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const avatarIcon = trader.avatar || (idx === 0 ? '👑' : idx === 1 ? '🦁' : idx === 2 ? '🐺' : '⚡');
            return `
                <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-left">
                        <span class="lb-rank-badge">${rankMedal}</span>
                        <div class="lb-avatar-icon">${avatarIcon}</div>
                        <div>
                            <div class="lb-name">
                                <span>${trader.name || trader.username}</span>
                                ${isMe ? '<span class="lb-you-tag">AKUN KAMU</span>' : ''}
                            </div>
                            <div class="lb-rank-title">@${trader.username} · ${trader.rank || 'Trader'} · Win Rate: ${trader.winRate || '0%'}</div>
                        </div>
                    </div>
                    <div class="lb-wealth">
                        <strong>$${trader.netWorth.toLocaleString()}</strong>
                        <small>Net Worth</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderProfileStats() {
        const stats = game.stats;
        const total = stats.totalTrades;
        const winRate = total > 0 ? ((stats.winTrades / total) * 100).toFixed(1) : '0.0';
        const rank = game.getRankInfo();
        const username = dbService.currentUsername || 'Trader';
        const netWorth = game.balance;
        const botEarnings = stats.botEarnings || 0;

        const avatarDisplay = document.getElementById('statCurrentAvatar');
        const userDisplay = document.getElementById('statCurrentUsername');
        const rankEl = document.getElementById('statPlayerRank');
        const netWorthEl = document.getElementById('statNetWorth');
        const cashBalanceEl = document.getElementById('statCashBalance');
        const winRateEl = document.getElementById('statWinRate');
        const totalTradesEl = document.getElementById('statTotalTrades');
        const winLossEl = document.getElementById('statWinLossRatio');
        const profitEl = document.getElementById('statTotalProfit');
        const highestWinEl = document.getElementById('statHighestWin');
        const bestStreakEl = document.getElementById('statBestStreak');
        const botIncomeEl = document.getElementById('statBotIncome');

        if (avatarDisplay) avatarDisplay.textContent = game.avatar || '👑';
        if (userDisplay) userDisplay.textContent = `@${username}`;
        if (rankEl) rankEl.innerHTML = `<span style="color:${rank.color}">${rank.icon} ${rank.name} (Level ${game.level})</span>`;
        if (netWorthEl) netWorthEl.textContent = `$${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (cashBalanceEl) cashBalanceEl.textContent = `$${game.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (winRateEl) winRateEl.textContent = `${winRate}%`;
        if (totalTradesEl) totalTradesEl.textContent = total;
        if (winLossEl) winLossEl.textContent = `${stats.winTrades} Menang / ${stats.lossTrades} Kalah`;
        if (profitEl) profitEl.textContent = `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (highestWinEl) highestWinEl.textContent = `+$${(stats.highestWin || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (bestStreakEl) bestStreakEl.textContent = `${game.bestStreak}x Win Streak (Saat ini: ${game.winStreak}x)`;
        if (botIncomeEl) botIncomeEl.textContent = `+$${botEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

        // Render Avatar Options in Profile Modal
        this.renderAvatarSelector('profileAvatarSelector', game.avatar || '👑');
        const profileAvatarOpts = document.querySelectorAll('#profileAvatarSelector .avatar-option');
        profileAvatarOpts.forEach(el => {
            el.onclick = () => {
                profileAvatarOpts.forEach(opt => opt.classList.remove('selected'));
                el.classList.add('selected');
                const chosen = el.dataset.avatar;
                game.setAvatar(chosen);
                if (avatarDisplay) avatarDisplay.textContent = chosen;
                this.renderHeader();
                sfx.playClick();
                this.showToast(`Logo avatar diganti menjadi ${chosen}!`, 'success');
            };
        });
    }

    closePosition(posId) {
        const closed = engine.closePosition(posId, 'MANUAL');
        if (closed) {
            const isProfit = closed.pnl >= 0;
            this.showToast(`Posisi ditutup! ${isProfit ? 'Profit' : 'Loss'}: ${isProfit ? '+' : ''}$${closed.pnl.toFixed(2)}`, isProfit ? 'success' : 'error');
        }
    }

    buyUpgrade(itemId) {
        const res = game.buyItemUpgrade(itemId);
        if (res.success) {
            this.showToast(`🎉 Berhasil upgrade item ke Level ${res.newLevel}!`, 'success');
        } else {
            this.showToast(res.msg, 'error');
        }
    }

    claimQuest(questId) {
        if (game.claimQuestReward(questId)) {
            this.showToast('🎁 Hadiah quest berhasil diklaim!', 'success');
        }
    }
}
