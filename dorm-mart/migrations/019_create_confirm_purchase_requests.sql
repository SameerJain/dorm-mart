-- 019_create_confirm_purchase_requests.sql
-- Stores the seller-submitted confirmation payloads that must later be
-- acknowledged by the buyer (or automatically accepted after 24 hours).

CREATE TABLE IF NOT EXISTS confirm_purchase_requests (
    confirm_request_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    scheduled_request_id  BIGINT UNSIGNED NOT NULL,
    inventory_product_id  BIGINT UNSIGNED NOT NULL,
    seller_user_id        BIGINT UNSIGNED NOT NULL,
    buyer_user_id         BIGINT UNSIGNED NOT NULL,
    conversation_id       BIGINT NOT NULL,

    is_successful         BOOLEAN NOT NULL DEFAULT TRUE,
    final_price           DECIMAL(10,2) NULL DEFAULT NULL,
    seller_notes          TEXT NULL DEFAULT NULL,
    failure_reason        ENUM('buyer_no_show','insufficient_funds','other') NULL DEFAULT NULL,
    failure_reason_notes  TEXT NULL DEFAULT NULL,

    status                ENUM('pending','buyer_accepted','buyer_declined','auto_accepted','seller_cancelled') NOT NULL DEFAULT 'pending',
    expires_at            DATETIME NOT NULL,
    buyer_response_at     DATETIME NULL DEFAULT NULL,
    auto_processed_at     DATETIME NULL DEFAULT NULL,

    payload_snapshot      JSON NULL DEFAULT NULL,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_confirm_sched
        FOREIGN KEY (scheduled_request_id)
        REFERENCES scheduled_purchase_requests(request_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_confirm_inventory
        FOREIGN KEY (inventory_product_id)
        REFERENCES INVENTORY(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_confirm_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_confirm_buyer
        FOREIGN KEY (buyer_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_confirm_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(conv_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_confirm_payload_valid CHECK (payload_snapshot IS NULL OR JSON_VALID(payload_snapshot)),
    CONSTRAINT chk_confirm_final_price CHECK (final_price IS NULL OR final_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_confirm_sched ON confirm_purchase_requests (scheduled_request_id);
CREATE INDEX idx_confirm_inventory ON confirm_purchase_requests (inventory_product_id);
CREATE INDEX idx_confirm_status ON confirm_purchase_requests (status);
CREATE INDEX idx_confirm_expires_at ON confirm_purchase_requests (expires_at);
