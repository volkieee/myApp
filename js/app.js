/**
 * APEX TRADER SIMULATOR - MAIN APP ENTRYPOINT
 * =====================================================================
 * Inisialisasi seluruh modul simulator, engine, game progress,
 * canvas chart, dan UI controllers.
 * =====================================================================
 */

import { dbService } from './firebase/db-service.js';
import { game } from './game.js';
import { engine } from './engine.js';
import { TradingChart } from './chart.js';
import { UIController } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Apex Trader Simulator initializing...');

    // 0. Inisialisasi Firebase Cloud Firestore
    await dbService.initFirebase();

    // 1. Inisialisasi Game Progression State (Level, XP, Saldo, Quests)
    await game.init();

    // 2. Inisialisasi Canvas Chart
    const chart = new TradingChart('tradingChartCanvas');

    // 3. Inisialisasi UI Controller & Bindings
    const ui = new UIController(chart);
    window.ApexUI = ui; // Global reference untuk onclick handlers di dynamic HTML
    ui.init();

    // 4. Jalankan Simulasi Pasar Realtime
    engine.startEngine();

    console.log('✨ Apex Trader Simulator siap dimainkan di Live Server!');
});
