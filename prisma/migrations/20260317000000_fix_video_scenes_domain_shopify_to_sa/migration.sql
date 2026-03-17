-- Fix domain in video_scenes: replace shopify.promonexai.com with sa.promonexai.com
-- Affects image_url, generated_video_url, and fetched_media (url/downloadUrl inside JSONB)

-- image_url (TEXT)
UPDATE video_scenes
SET image_url = REPLACE(image_url, 'shopify.promonexai.com', 'sa.promonexai.com')
WHERE image_url IS NOT NULL
  AND image_url LIKE '%shopify.promonexai.com%';

-- generated_video_url (TEXT)
UPDATE video_scenes
SET generated_video_url = REPLACE(generated_video_url, 'shopify.promonexai.com', 'sa.promonexai.com')
WHERE generated_video_url IS NOT NULL
  AND generated_video_url LIKE '%shopify.promonexai.com%';

-- fetched_media (JSONB): replace domain in entire JSON text (covers url, downloadUrl, or any other key)
UPDATE video_scenes
SET fetched_media = (REPLACE(fetched_media::text, 'shopify.promonexai.com', 'sa.promonexai.com'))::jsonb
WHERE fetched_media IS NOT NULL
  AND fetched_media::text LIKE '%shopify.promonexai.com%';
