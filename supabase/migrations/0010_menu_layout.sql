-- Add menu_layout column to hotel_settings
ALTER TABLE hotel_settings ADD COLUMN menu_layout text DEFAULT 'classic' NOT NULL;
