-- ============================================================================
-- APEX TRADER PRO - RELATIONAL DATABASE SCHEMA (SQL DDL)
-- Compatible with PostgreSQL, Supabase, MySQL 8+, SQLite3
-- ============================================================================

-- 1. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    tier VARCHAR(20) DEFAULT 'PRO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ACCOUNTS / WALLET BALANCES
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(32) UNIQUE NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    balance DECIMAL(18, 4) NOT NULL DEFAULT 10000.0000,
    equity DECIMAL(18, 4) NOT NULL DEFAULT 10000.0000,
    used_margin DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    free_margin DECIMAL(18, 4) NOT NULL DEFAULT 10000.0000,
    margin_level DECIMAL(10, 2) DEFAULT 0.00,
    leverage_max INT DEFAULT 100,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, MARGIN_CALL, SUSPENDED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ORDERS TABLE (Pending & Executed Orders)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL, -- MARKET, LIMIT, STOP
    side VARCHAR(10) NOT NULL,       -- BUY, SELL
    units DECIMAL(18, 6) NOT NULL,
    margin DECIMAL(18, 4) NOT NULL,
    leverage INT NOT NULL DEFAULT 10,
    requested_price DECIMAL(18, 6) NOT NULL,
    executed_price DECIMAL(18, 6),
    take_profit DECIMAL(18, 6),
    stop_loss DECIMAL(18, 6),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, FILLED, CANCELLED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP WITH TIME ZONE
);

-- 4. POSITIONS & TRADES TABLE (Open and Closed Positions)
CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    order_id VARCHAR(64) REFERENCES orders(id),
    symbol VARCHAR(20) NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,       -- BUY, SELL
    leverage INT NOT NULL DEFAULT 10,
    margin DECIMAL(18, 4) NOT NULL,
    units DECIMAL(18, 6) NOT NULL,
    entry_price DECIMAL(18, 6) NOT NULL,
    exit_price DECIMAL(18, 6),
    take_profit DECIMAL(18, 6),
    stop_loss DECIMAL(18, 6),
    liquidation_price DECIMAL(18, 6),
    spread_cost DECIMAL(18, 4) DEFAULT 0.00,
    commission DECIMAL(18, 4) DEFAULT 0.00,
    swap DECIMAL(18, 4) DEFAULT 0.00,
    pnl DECIMAL(18, 4) DEFAULT 0.00,
    pnl_percentage DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, CLOSED, LIQUIDATED
    close_reason VARCHAR(50),                   -- MANUAL, TAKE_PROFIT, STOP_LOSS, LIQUIDATION
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 5. TRANSACTIONS LEDGER (Deposit, Withdrawal, PnL settlements)
CREATE TABLE IF NOT EXISTS transactions_ledger (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    trade_id VARCHAR(64) REFERENCES trades(id),
    type VARCHAR(30) NOT NULL, -- DEPOSIT, WITHDRAWAL, TRADE_PROFIT, TRADE_LOSS, COMMISSION
    amount DECIMAL(18, 4) NOT NULL,
    balance_before DECIMAL(18, 4) NOT NULL,
    balance_after DECIMAL(18, 4) NOT NULL,
    payment_method VARCHAR(50), -- BANK_TRANSFER, CRYPTO, CREDIT_CARD, INTERNAL
    tx_hash VARCHAR(128),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. INDEXES FOR HIGH-THROUGHPUT REAL-TIME QUERIES
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account_status ON trades(account_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON transactions_ledger(account_id, created_at DESC);
