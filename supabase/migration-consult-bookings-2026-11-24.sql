-- ============================================================
-- 個別相談の予約前アンケート（/consult）の保存先（2026-11-24 t iku 指示）
--
--   予約スケジュールを入れる前に、以下6項目を必須で受ける。
--     氏名 / 性別 / 年齢 / メールアドレス / 現在の状況（これから挑戦したい・実施中）/
--     今考えているアイディアや企画 / 集めたい希望金額
--
--   🔴 実行しなくても、アンケート送信そのものは動きます（メール通知は届きます）。
--      このSQLは「一覧で見たい・集計したい」ための保存用です。
--      （/api/consult-booking は保存に失敗してもメール送信を続ける作り）
--
--   🔴 RLSを有効にし、ポリシーは作りません。
--      書き込み・参照はサーバー側の service role のみ（anon からは触れません）。
--
--   実行は1回でOK（何度実行しても増えません）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consult_bookings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  gender      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'これから挑戦したい',  -- これから挑戦したい／実施中
  age         integer     NOT NULL,
  email       text        NOT NULL,
  idea        text        NOT NULL,   -- 今考えているアイディアや企画
  amount      text        NOT NULL,   -- 集めたい希望金額（自由記入）
  source      text        NOT NULL DEFAULT 'consult',
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 先にこのSQLを実行していた場合でも「現在の状況」列が増えるようにする（何度実行してもOK）
ALTER TABLE public.consult_bookings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'これから挑戦したい';

ALTER TABLE public.consult_bookings ENABLE ROW LEVEL SECURITY;

-- 管理画面・集計用（新しい順に読むため）
CREATE INDEX IF NOT EXISTS consult_bookings_created_at_idx
  ON public.consult_bookings (created_at DESC);

COMMENT ON TABLE public.consult_bookings IS
  '個別相談の予約前アンケート（/consult）。書き込みは service role のみ';
