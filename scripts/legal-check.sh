#!/bin/bash
# 法務・原稿系ページの公開前チェック
# 使い方: ./legal-check.sh <base-url>
#   例) ./legal-check.sh https://kamo-funding-app.vercel.app
#       ./legal-check.sh http://localhost:3104
# 判定: NG が1つでも出たら公開しない
BASE="${1:?usage: legal-check.sh <base-url>}"
PAGES="tokushoho terms cancellation privacy"
# 🔴 本文に出てはいけない語
# - <!--    : Markdown原稿に書いたHTMLコメントは読者に表示される（2026-09-10 に実際に踏んだ）
#             ※Reactが出す空マーカー "<!-- -->" は無害なので除外して数える
# - 内部の人名・状態語 : 未確定の情報を「確認中」と書いたまま公開する事故を防ぐ
# - 撤去済みの旧情報   : 差し戻り検知
BAD="t iku|確認中|TODO|FIXME|要確認|未確定|一般社団法人|キュレーター協会|19,800|17億|7日前|35名|銀行振込|振込手数料"
fail=0
for p in $PAGES; do
  html=$(curl -s "$BASE/$p")
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$p")
  # 空マーカー以外のHTMLコメント
  cmt=$(printf '%s' "$html" | grep -o '<!--.\{0,120\}' | grep -v '^<!-- -->' | head -3)
  hits=$(printf '%s' "$html" | sed 's/<[^>]*>/ /g' | grep -oE "$BAD" | sort -u | tr '\n' ' ')
  st="OK"
  # 200 以外は中身を見ていないので、判定できない状態として NG にする
  #（フラグ未設定の本番は404 → 「公開前チェックに通った」と誤読させない）
  [ "$code" != "200" ] && { st="NG(未公開/未到達)"; fail=1; }
  [ -n "$cmt" ] && { st="NG"; fail=1; }
  [ -n "$hits" ] && { st="NG"; fail=1; }
  echo "[$st] /$p (HTTP $code) ${hits:+禁止語: $hits}${cmt:+ HTMLコメント: $cmt}"
done
# 入っていなければならない語（欠落検知）
for need in "合同会社LOCALCREATION"; do
  printf '%s' "$(curl -s "$BASE/tokushoho")" | grep -qF "$need" \
    && echo "[OK] /tokushoho に「$need」あり" \
    || { echo "[NG] /tokushoho に「$need」が無い"; fail=1; }
done
echo "---"; [ $fail -eq 0 ] && echo "結果: 公開OK" || echo "結果: NG あり — 公開しない"
exit $fail
