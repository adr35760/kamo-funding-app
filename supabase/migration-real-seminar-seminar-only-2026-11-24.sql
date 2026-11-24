-- ============================================================
-- 12/8 リアルセミナー：参加区分「セミナーのみ参加」を追加（2026-11-24 t iku 指示）
--
--   セミナー本編だけの参加枠（15,000円）。決済券は
--   ストア「リアルセミナー参加券（懇親会はご参加できません）」products/73536。
--
-- 🔴 目的は「申込 → 完了メールの決済リンク」で支払ってもらうこと。
--    ストアへ直接飛ばすと申込者名簿（管理画面）に並ばないため、
--    他の2区分と同じく **サイトの申込フォームから申し込める行**を1つ足す。
--
-- 🔴 受付時刻は「セミナーから参加」と同じ 15:30 なので event_date が重なります。
--    区分の判別はコード側で events.title の「【セミナーのみ参加】」で行います
--    （src/lib/seminar-config.ts の realTierFor 第2引数）。タイトルの印を消さないこと。
--
-- 🔴 定員: セミナー会場は **20名**（2026-11-24 t iku確定）で、
--    「セミナーから参加」と**合計20名**を分け合います。
--    行ごとの capacity は 20 にしておき、2区分をまたいだ合計は
--    /api/apply が REAL_SEMINAR_ROOM_CAPACITY（20）で判定します。
--
-- 実行は1回でOK（何度実行しても増えません）。
-- ============================================================

INSERT INTO events (title, type, event_date, pillar, duration_minutes, location, capacity, status, description)
SELECT
  'リアルセミナー＆懇親会（支援者と繋がる交流会） 第2回【セミナーのみ参加】',
  'networking',
  '2026-12-08T15:30:00+09:00',
  3,
  180,                      -- 受付15:30〜セミナー終了18:30（懇親会なし）
  'エデュケーションギャラリー',
  20,
  'upcoming',
  'セミナー本編のみの参加です（懇親会は含みません）。'
WHERE NOT EXISTS (
  SELECT 1 FROM events
  WHERE pillar = 3
    AND title LIKE '%【セミナーのみ参加】%'
);

-- 確認（3行そろうこと。15:30 が2行、18:30 が1行）
SELECT id, title, event_date, duration_minutes, location, capacity, status
FROM events
WHERE pillar = 3
  AND event_date >= '2026-12-01T00:00:00+09:00'
ORDER BY event_date, title;
