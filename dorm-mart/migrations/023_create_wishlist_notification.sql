CREATE TABLE IF NOT EXISTS wishlist_notification (
    seller_id    BIGINT UNSIGNED NOT NULL,
    product_id   BIGINT UNSIGNED NOT NULL,
    title        VARCHAR(255) NOT NULL,
    image_url    VARCHAR(255) DEFAULT NULL,
    unread_count INT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (seller_id, product_id),
    INDEX idx_wn_product_id (product_id),
    INDEX idx_wn_seller_id (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
