-- Support tag and genre based filtering paths.
CREATE INDEX IF NOT EXISTS idx_work_genres_genre_id
    ON work_genres (genre_id);

CREATE INDEX IF NOT EXISTS idx_user_item_tags_tag_id
    ON user_item_tags (tag_id);
