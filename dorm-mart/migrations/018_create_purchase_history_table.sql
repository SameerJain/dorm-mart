-- 018_create_purchase_history_table.sql
-- Adds a lightweight purchase_history table that stores, per user,
-- the list of product_ids they have transacted on (as a JSON array).
-- This intentionally co-exists with the legacy purchased_items table
-- until the new Purchase History feature fully replaces it.

CREATE TABLE IF NOT EXISTS purchase_history (
    history_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    items           JSON NOT NULL DEFAULT (JSON_ARRAY()),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_purchase_history_user UNIQUE (user_id),
    CONSTRAINT fk_purchase_history_user
        FOREIGN KEY (user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_purchase_history_items CHECK (JSON_VALID(items))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_purchase_history_user ON purchase_history (user_id);
