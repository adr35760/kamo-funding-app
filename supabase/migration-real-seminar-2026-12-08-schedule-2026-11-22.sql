-- ============================================================
-- 12/8 リアルセミナー＆懇親会：時刻・会場を新日程に統一（2026-11-22 t iku 確定）
--
--   受付      15:00 → 15:30
--   セミナー  15:30〜18:00 → 16:00〜18:30
--   懇親会    18:00〜20:00 → 18:30〜20:30
--   懇親会会場 別会場 → セミナーと同会場（エデュケーションギャラリー）
--
-- 🔴 対象は events テーブルの pillar=3（リアル回）の2行だけです。
--    ・A行（セミナーから参加）  event_date = 2026-12-08 15:00 JST ／ 所要 300分
--    ・B行（交流会から参加）    event_date = 2026-12-08 18:00 JST ／ 所要 120分
--
-- 🔴 コード側（src/lib/seminar-config.ts）の REAL_SEMINAR.sessions / REAL_ATTEND_TIERS の
--    isoDate を 15:30 / 18:30 に変えたので、**このSQLを同じタイミングで実行**してください。
--    片方だけだと、参加区分の判定（realTierFor）が一致せず、
--    /seminar の区分ラベル・内訳と、申込完了メールの決済リンクが出なくなります
--    （間違った情報は出ませんが、案内が欠けます）。
--
-- 🔴 行を消して作り直さないこと（registrations が event_id を参照しています）。
--    既存の行を UPDATE します。何度実行しても結果は同じです。
-- ============================================================

-- ① A行（セミナーから参加）：受付開始 15:30・受付から懇親会終了まで 300分
UPDATE events
SET event_date      = '2026-12-08T15:30:00+09:00',
    duration_minutes = 300,
    location        = 'エデュケーションギャラリー'
WHERE pillar = 3
  AND event_date = '2026-12-08T15:00:00+09:00';

-- ② B行（交流会から参加）：懇親会 18:30〜20:30・120分・会場はセミナーと同じ
UPDATE events
SET event_date      = '2026-12-08T18:30:00+09:00',
    duration_minutes = 120,
    location        = 'エデュケーションギャラリー'
WHERE pillar = 3
  AND event_date = '2026-12-08T18:00:00+09:00';

-- ③ 説明文に残っている旧会場名（別会場）を消す
--    まず「 ／ 懇親会：〈旧会場名〉」の形を丸ごと削り、残りがあれば語だけ消す
UPDATE events
SET description = TRIM(REPLACE(REPLACE(description,
      ' ／ 懇親会：YAKINIKUMAFIA', ''), 'YAKINIKUMAFIA', ''))
WHERE pillar = 3
  AND description LIKE '%YAKINIKUMAFIA%';

UPDATE events
SET location = REPLACE(location, '（懇親会：YAKINIKUMAFIA）', '')
WHERE pillar = 3
  AND location LIKE '%YAKINIKUMAFIA%';

-- ④ 確認（2行が 15:30 / 18:30、会場が1つ、YAKINIKUMAFIA が0件であること）
SELECT id, title, event_date, duration_minutes, location, capacity, status,
       (description LIKE '%YAKINIKUMAFIA%') AS has_old_venue
FROM events
WHERE pillar = 3
  AND event_date >= '2026-12-01T00:00:00+09:00'
ORDER BY event_date;

-- ============================================================
-- 期待する結果
--   2026-12-08 15:30 JST ／ 300分 ／ エデュケーションギャラリー ／ capacity 20 ／ upcoming
--   2026-12-08 18:30 JST ／ 120分 ／ エデュケーションギャラリー ／ capacity 20 ／ upcoming
--   has_old_venue は2行とも false
--
-- 変更していないもの: 料金（サイト側 22,000円）、定員（両行 20）、
--   タイトル・説明文の日付/回次、status、決済券（72012 / 72011）
-- ============================================================
