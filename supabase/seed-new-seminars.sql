-- ============================================
-- 新規セミナー2種のイベント登録（冪等）
--   pillar=2 … AI時代のクラウドファンディング活用セミナー（オンライン）
--   pillar=3 … リアルセミナー＆懇親会
--
-- capacity: オンライン=20名 / リアル=セミナー本体20名（いずれも申込上限の基準）。
-- 懇親会の定員35名は表示専用のため src/lib/seminar-config.ts 側で管理。
-- ============================================

-- 同じ回を二重登録しないよう、同一タイトル＋同一日時の既存行を消してから入れる
DELETE FROM events
WHERE pillar IN (2, 3)
  AND event_date IN (
    '2026-10-05T16:00:00+09:00',
    '2026-11-10T16:00:00+09:00',
    '2026-10-25T15:00:00+09:00',
    '2026-12-08T15:00:00+09:00'
  );

-- ① AI時代のクラウドファンディング活用セミナー（オンライン・pillar=2）
INSERT INTO events (title, type, pillar, description, event_date, duration_minutes, location, capacity, status, streaming_platform)
VALUES
  ('【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー 第1回',
   'seminar', 2,
   'AIを活用してクラウドファンディングのページを作り、夢を実現するための実践セミナー。鴨頭嘉人が特別参加します。',
   '2026-10-05T16:00:00+09:00', 240, 'オンライン（Zoom）', 20, 'upcoming', 'zoom'),
  ('【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー 第2回',
   'seminar', 2,
   'AIを活用してクラウドファンディングのページを作り、夢を実現するための実践セミナー。鴨頭嘉人が特別参加します。',
   '2026-11-10T16:00:00+09:00', 240, 'オンライン（Zoom）', 20, 'upcoming', 'zoom');

-- ② リアルセミナー＆懇親会（pillar=3）
-- duration 300分 = セミナー15:00-18:30＋懇親会18:30-20:00
INSERT INTO events (title, type, pillar, description, event_date, duration_minutes, location, capacity, status, streaming_platform)
VALUES
  ('リアルセミナー＆懇親会（支援者と繋がる交流会） 第1回',
   'networking', 3,
   '鴨頭嘉人がリアル登壇。セミナーのあとは懇親会で支援者と直接つながれます。セミナー会場：エデュケーションギャラリー ／ 懇親会：YAKINIKUMAFIA',
   '2026-10-25T15:00:00+09:00', 300, 'エデュケーションギャラリー（懇親会：YAKINIKUMAFIA）', 20, 'upcoming', NULL),
  ('リアルセミナー＆懇親会（支援者と繋がる交流会） 第2回',
   'networking', 3,
   '鴨頭嘉人がリアル登壇。セミナーのあとは懇親会で支援者と直接つながれます。セミナー会場：エデュケーションギャラリー ／ 懇親会：YAKINIKUMAFIA',
   '2026-12-08T15:00:00+09:00', 300, 'エデュケーションギャラリー（懇親会：YAKINIKUMAFIA）', 20, 'upcoming', NULL);

-- 確認
SELECT title, pillar, event_date, duration_minutes, location, capacity, status
FROM events WHERE pillar IN (2, 3) ORDER BY event_date;

-- ============================================
-- 定員はすべて確定済み（オンライン20名 / リアル セミナー20名）。
-- 懇親会35名は表示専用のため src/lib/seminar-config.ts で管理。
-- ============================================
