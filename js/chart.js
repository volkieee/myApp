/**
 * GAMIFIED INTERACTIVE CANVAS CHART (PAN & ZOOM ENABLED)
 * =====================================================================
 * Render grafik Candlestick / Area glow realtime dengan performa tinggi.
 * Fitur Interaktif:
 * - 🖱️ Geser / Drag Layar (Pan) ke kiri & ke kanan melihat riwayat harga lampau.
 * - 🔍 Zoom In / Zoom Out menggunakan Scroll Wheel mouse & Touch pinch.
 * - ⏩ Tombol & Double Click untuk Recenter kembali ke live price realtime.
 * - 🎯 Indikator Posisi Terbuka, Likuidasi, Partikel FX, dan Crosshair Interaktif.
 * =====================================================================
 */

import { engine, ASSETS } from './engine.js';

export class TradingChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.chartType = 'candlestick'; // 'candlestick' or 'line'
        this.hoverPos = null;
        this.particles = [];
        this.width = 0;
        this.height = 0;

        // Pan & Zoom States
        this.panOffset = 0; // Berapa lilin yang digeser dari ujung kanan
        this.visibleCount = 55; // Berapa lilin yang tampil di layar (Zoom level: 15 s.d 180)
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartPan = 0;
        this.touchStartDist = 0;

        this.initCanvas();
        this.bindEvents();
    }

    initCanvas() {
        if (!this.canvas) return;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    bindEvents() {
        if (!this.canvas) return;

        // 1. Mouse Move & Crosshair
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.hoverPos = { x: mouseX, y: mouseY };

            // Dragging Logic
            if (this.isDragging) {
                const chartAreaWidth = this.width - 70;
                const candleWidth = chartAreaWidth / this.visibleCount;
                const deltaPixels = e.clientX - this.dragStartX;
                const candleDelta = Math.round(deltaPixels / candleWidth);

                const maxPan = Math.max(0, (engine.candles[engine.selectedAsset]?.length || 0) - this.visibleCount);
                this.panOffset = Math.max(0, Math.min(maxPan, this.dragStartPan + candleDelta));
            }

            this.render();
        });

        // 2. Mouse Down (Start Dragging / Pan)
        this.canvas.addEventListener('mousedown', (e) => {
            // Cek jika klik tombol Recenter Live
            if (this.panOffset > 0 && this.isClickingRecenterBtn(e)) {
                this.recenter();
                return;
            }

            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartPan = this.panOffset;
            this.canvas.style.cursor = 'grabbing';
        });

        // 3. Mouse Up & Leave
        const stopDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'crosshair';
            }
        };

        window.addEventListener('mouseup', stopDrag);
        this.canvas.addEventListener('mouseleave', () => {
            this.hoverPos = null;
            stopDrag();
            this.render();
        });

        // 4. Double Click to Recenter
        this.canvas.addEventListener('dblclick', () => {
            this.recenter();
        });

        // 5. Mouse Wheel (Zoom In / Zoom Out)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY < 0 ? -5 : 5;
            this.visibleCount = Math.max(15, Math.min(160, this.visibleCount + zoomDelta));
            
            const maxPan = Math.max(0, (engine.candles[engine.selectedAsset]?.length || 0) - this.visibleCount);
            this.panOffset = Math.min(maxPan, this.panOffset);
            this.render();
        }, { passive: false });

        // 6. Touch Events untuk Layar HP / Touchscreen
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.dragStartX = e.touches[0].clientX;
                this.dragStartPan = this.panOffset;
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                this.touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const chartAreaWidth = this.width - 70;
                const candleWidth = chartAreaWidth / this.visibleCount;
                const deltaPixels = e.touches[0].clientX - this.dragStartX;
                const candleDelta = Math.round(deltaPixels / candleWidth);

                const maxPan = Math.max(0, (engine.candles[engine.selectedAsset]?.length || 0) - this.visibleCount);
                this.panOffset = Math.max(0, Math.min(maxPan, this.dragStartPan + candleDelta));
                this.render();
            } else if (e.touches.length === 2) {
                const curDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const pinchDelta = (this.touchStartDist - curDist) * 0.15;
                this.visibleCount = Math.max(15, Math.min(160, Math.round(this.visibleCount + pinchDelta)));
                this.touchStartDist = curDist;
                this.render();
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // 7. Particle Burst Event Listener
        window.addEventListener('apex_trade_burst', (e) => {
            this.spawnTradeBurst(e.detail.type);
        });
    }

    recenter() {
        this.panOffset = 0;
        this.render();
    }

    isClickingRecenterBtn(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const btnX = this.width - 170;
        const btnY = this.height - 55;
        return (x >= btnX && x <= btnX + 90 && y >= btnY && y <= btnY + 26);
    }

    spawnTradeBurst(type) {
        const color = type === 'LONG' ? '#10b981' : '#ef4444';
        const startX = this.width - 90;
        const startY = this.height / 2;

        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 3 + 2,
                color: color,
                alpha: 1,
                decay: Math.random() * 0.03 + 0.02
            });
        }
    }

    setChartType(type) {
        this.chartType = type;
        this.render();
    }

    render() {
        if (!this.ctx || !this.width || !this.height) return;

        const ctx = this.ctx;
        const sym = engine.selectedAsset;
        const allCandles = engine.candles[sym] || [];
        const decimals = ASSETS[sym] ? ASSETS[sym].decimals : 2;

        // Clear Background
        ctx.clearRect(0, 0, this.width, this.height);

        // Gradient Background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#0a0e17');
        bgGrad.addColorStop(1, '#05070b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        if (allCandles.length < 2) return;

        // Slice Visible Candles based on Pan Offset & Zoom Count
        const endIndex = allCandles.length - this.panOffset;
        const startIndex = Math.max(0, endIndex - this.visibleCount);
        const visibleCandles = allCandles.slice(startIndex, endIndex);

        if (visibleCandles.length < 2) return;

        // Min Max calculation
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        visibleCandles.forEach(c => {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
        });

        // Add 12% vertical padding
        const padding = (maxPrice - minPrice) * 0.12 || 1;
        minPrice -= padding;
        maxPrice += padding;

        const priceRange = maxPrice - minPrice;
        const chartAreaWidth = this.width - 70;
        const chartAreaHeight = this.height - 30;

        const getY = (price) => {
            return chartAreaHeight - ((price - minPrice) / priceRange) * chartAreaHeight;
        };

        const candleSpacing = chartAreaWidth / visibleCandles.length;
        const candleWidth = Math.max(2.5, candleSpacing * 0.72);

        // 1. Draw Grid Lines
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';

        for (let i = 0; i <= 5; i++) {
            const y = (chartAreaHeight / 5) * i;
            const p = maxPrice - (priceRange / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(chartAreaWidth, y);
            ctx.stroke();

            // Price Labels on right axis
            ctx.fillStyle = '#64748b';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(p.toFixed(decimals), chartAreaWidth + 8, y + 3);
        }

        // 2. Draw Candlesticks / Line Chart
        if (this.chartType === 'candlestick') {
            visibleCandles.forEach((c, idx) => {
                const x = idx * candleSpacing + (candleSpacing / 2);
                const isBull = c.close >= c.open;
                const candleColor = isBull ? '#10b981' : '#f43f5e';

                // Wick
                ctx.strokeStyle = candleColor;
                ctx.lineWidth = Math.max(1, candleWidth * 0.15);
                ctx.beginPath();
                ctx.moveTo(x, getY(c.high));
                ctx.lineTo(x, getY(c.low));
                ctx.stroke();

                // Body
                const bodyTop = getY(Math.max(c.open, c.close));
                const bodyBottom = getY(Math.min(c.open, c.close));
                const bodyHeight = Math.max(2, bodyBottom - bodyTop);

                ctx.fillStyle = candleColor;
                ctx.fillRect(x - (candleWidth / 2), bodyTop, candleWidth, bodyHeight);
            });
        } else {
            // Glowing Area Line Chart
            ctx.beginPath();
            visibleCandles.forEach((c, idx) => {
                const x = idx * candleSpacing + (candleSpacing / 2);
                const y = getY(c.close);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            const lastX = (visibleCandles.length - 1) * candleSpacing + (candleSpacing / 2);
            ctx.lineTo(lastX, chartAreaHeight);
            ctx.lineTo(candleSpacing / 2, chartAreaHeight);
            ctx.closePath();

            const areaGrad = ctx.createLinearGradient(0, 0, 0, chartAreaHeight);
            areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            areaGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
            ctx.fillStyle = areaGrad;
            ctx.fill();
        }

        // 3. Draw Active Positions Lines
        const activePositions = engine.positions.filter(p => p.symbol === sym);
        activePositions.forEach(pos => {
            const entryY = getY(pos.entryPrice);
            if (entryY >= 0 && entryY <= chartAreaHeight) {
                const color = pos.type === 'LONG' ? '#10b981' : '#ef4444';
                
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, entryY);
                ctx.lineTo(chartAreaWidth, entryY);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = color;
                ctx.fillRect(chartAreaWidth + 2, entryY - 10, 65, 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${pos.type} ${pos.leverage}x`, chartAreaWidth + 34, entryY + 3);
            }

            // Liquidation Line
            const liqY = getY(pos.liqPrice);
            if (liqY >= 0 && liqY <= chartAreaHeight) {
                ctx.setLineDash([2, 4]);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, liqY);
                ctx.lineTo(chartAreaWidth, liqY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // 4. Current Price Line with Pulsing Glow
        const currentPrice = engine.getCurrentPrice(sym);
        const curY = getY(currentPrice);
        const curColor = allCandles[allCandles.length - 1]?.close >= allCandles[allCandles.length - 1]?.open ? '#10b981' : '#f43f5e';

        ctx.strokeStyle = curColor;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(chartAreaWidth, curY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Current Price Badge on Right Axis
        ctx.fillStyle = curColor;
        ctx.beginPath();
        ctx.roundRect(chartAreaWidth + 2, curY - 11, 65, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(currentPrice.toFixed(decimals), chartAreaWidth + 34, curY + 4);

        // 5. Crosshair on Hover
        if (this.hoverPos && this.hoverPos.x < chartAreaWidth && this.hoverPos.y < chartAreaHeight && !this.isDragging) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);

            ctx.beginPath();
            ctx.moveTo(this.hoverPos.x, 0);
            ctx.lineTo(this.hoverPos.x, chartAreaHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, this.hoverPos.y);
            ctx.lineTo(chartAreaWidth, this.hoverPos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const hoverPrice = maxPrice - (this.hoverPos.y / chartAreaHeight) * priceRange;
            ctx.fillStyle = '#334155';
            ctx.fillRect(chartAreaWidth + 2, this.hoverPos.y - 10, 65, 20);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(hoverPrice.toFixed(decimals), chartAreaWidth + 34, this.hoverPos.y + 3);
        }

        // 6. Floating "Recenter / Live Price" Button if Panned Away
        if (this.panOffset > 0) {
            const btnX = this.width - 170;
            const btnY = this.height - 55;

            ctx.fillStyle = 'rgba(14, 19, 31, 0.85)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(btnX, btnY, 90, 26, 13);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⏩ LIVE PRICE', btnX + 45, btnY + 17);
        }

        // 7. Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
