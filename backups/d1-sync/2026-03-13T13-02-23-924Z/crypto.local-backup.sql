PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER NOT NULL,
      code TEXT NOT NULL,
      pair TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      core_position_zh TEXT NOT NULL,
      core_position_en TEXT NOT NULL,
      annual_quote_volume_usdt REAL NOT NULL,
      annual_trade_share_pct REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
CREATE TABLE daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      total_quote_volume_usdt REAL NOT NULL,
      up_count INTEGER NOT NULL,
      down_count INTEGER NOT NULL,
      flat_count INTEGER NOT NULL,
      leader_code TEXT,
      leader_change_24h_pct REAL,
      laggard_code TEXT,
      laggard_change_24h_pct REAL,
      generated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
CREATE TABLE daily_coin_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      pair TEXT NOT NULL,
      price_usdt REAL NOT NULL,
      change_24h_pct REAL NOT NULL,
      high_24h REAL NOT NULL,
      low_24h REAL NOT NULL,
      quote_volume_24h_usdt REAL NOT NULL,
      trade_share_pct REAL NOT NULL,
      close_time TEXT NOT NULL,
      FOREIGN KEY(report_id) REFERENCES daily_reports(id)
    );
CREATE TABLE crypto_news_raw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      raw_hash TEXT NOT NULL,
      ingest_status TEXT NOT NULL DEFAULT 'pending'
    );
CREATE TABLE crypto_news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      published_at TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      relevance_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      signal_score INTEGER NOT NULL,
      noise_score INTEGER NOT NULL,
      confidence REAL NOT NULL,
      should_display INTEGER NOT NULL DEFAULT 0,
      is_market_wide INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(raw_id) REFERENCES crypto_news_raw(id)
    );
CREATE TABLE crypto_news_item_coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_item_id INTEGER NOT NULL,
      coin_code TEXT NOT NULL,
      relation_confidence REAL NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    );
CREATE TABLE crypto_news_item_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_item_id INTEGER NOT NULL,
      topic_code TEXT NOT NULL,
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    );
CREATE TABLE crypto_news_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_key TEXT NOT NULL,
      cluster_label TEXT NOT NULL,
      representative_news_item_id INTEGER NOT NULL,
      importance_score INTEGER NOT NULL,
      market_impact TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(representative_news_item_id) REFERENCES crypto_news_items(id)
    );
CREATE TABLE crypto_news_cluster_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id INTEGER NOT NULL,
      news_item_id INTEGER NOT NULL,
      FOREIGN KEY(cluster_id) REFERENCES crypto_news_clusters(id),
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    );
CREATE TABLE crypto_macro_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_key TEXT NOT NULL,
      asset_code TEXT NOT NULL DEFAULT '',
      metric_value REAL,
      value_text TEXT,
      unit TEXT NOT NULL,
      classification TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      meta_json TEXT
    );
DELETE FROM sqlite_sequence;
CREATE UNIQUE INDEX idx_coins_code_unique ON coins(code);
CREATE UNIQUE INDEX idx_coins_rank_unique ON coins(rank);
CREATE UNIQUE INDEX idx_daily_reports_date_unique ON daily_reports(report_date);
CREATE INDEX idx_daily_coin_snapshots_report_code ON daily_coin_snapshots(report_id, code);
CREATE INDEX idx_daily_coin_snapshots_code_report ON daily_coin_snapshots(code, report_id);
CREATE UNIQUE INDEX idx_crypto_news_raw_hash_unique ON crypto_news_raw(raw_hash);
CREATE INDEX idx_crypto_news_raw_published ON crypto_news_raw(published_at);
CREATE INDEX idx_crypto_news_raw_status ON crypto_news_raw(ingest_status);
CREATE UNIQUE INDEX idx_crypto_news_items_raw_id_unique ON crypto_news_items(raw_id);
CREATE INDEX idx_crypto_news_items_published ON crypto_news_items(published_at);
CREATE INDEX idx_crypto_news_items_display ON crypto_news_items(should_display, is_market_wide, published_at);
CREATE UNIQUE INDEX idx_crypto_news_item_coin_unique ON crypto_news_item_coins(news_item_id, coin_code);
CREATE INDEX idx_crypto_news_item_coin_code ON crypto_news_item_coins(coin_code, news_item_id);
CREATE UNIQUE INDEX idx_crypto_news_item_topic_unique ON crypto_news_item_topics(news_item_id, topic_code);
CREATE INDEX idx_crypto_news_item_topic_code ON crypto_news_item_topics(topic_code, news_item_id);
CREATE UNIQUE INDEX idx_crypto_news_clusters_key_unique ON crypto_news_clusters(cluster_key);
CREATE INDEX idx_crypto_news_clusters_rep ON crypto_news_clusters(representative_news_item_id);
CREATE UNIQUE INDEX idx_crypto_news_cluster_member_unique ON crypto_news_cluster_members(cluster_id, news_item_id);
CREATE INDEX idx_crypto_news_cluster_member_item ON crypto_news_cluster_members(news_item_id, cluster_id);
CREATE UNIQUE INDEX idx_crypto_macro_observations_unique ON crypto_macro_observations(indicator_key, asset_code, observed_at);
CREATE INDEX idx_crypto_macro_observations_lookup ON crypto_macro_observations(indicator_key, asset_code, observed_at DESC);