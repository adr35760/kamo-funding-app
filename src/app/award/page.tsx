import { permanentRedirect } from 'next/navigation';

/**
 * /award — 2026-11-23 t iku指示で終了（11/9に開催済み）。
 *
 * 🔴 **表示は廃止**し、`/seminar`（セミナー日程・お申し込み）へ恒久リダイレクトする。
 *    404で消すより、ブックマーク・被リンク・過去の告知からの流入を拾える。
 *
 * 🔴 AWARD_EVENT の定数自体と、DBの申込データ・メール送信ロジックは残している
 *    （過去の申込者への案内が壊れないように）。表示にだけ出さない。
 */
export default function AwardPage() {
  permanentRedirect('/seminar');
}
