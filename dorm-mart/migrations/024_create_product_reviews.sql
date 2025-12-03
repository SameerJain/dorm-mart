-- 024_create_product_reviews.sql
-- Creates the product_reviews table to store buyer reviews and ratings for purchased items
-- Reviews include a 0-5 star rating (0.5 increments) and a required text review (max 1000 chars)

CREATE TABLE IF NOT EXISTS product_reviews (
    review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    seller_user_id BIGINT UNSIGNED NOT NULL,
    rating DECIMAL(2,1) NOT NULL,
    review_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (review_id),
    UNIQUE KEY uq_buyer_product_review (buyer_user_id, product_id),
    INDEX idx_product_id (product_id),
    INDEX idx_buyer_user_id (buyer_user_id),
    INDEX idx_seller_user_id (seller_user_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at),
    
    CONSTRAINT fk_review_product
        FOREIGN KEY (product_id)
        REFERENCES INVENTORY(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_review_buyer
        FOREIGN KEY (buyer_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_review_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_rating_range CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT chk_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

