# からだログ（Phase 2）

朝・夜それぞれ1分で記録する、自分専用の健康・ボディメイク記録PWA。

## 使っている技術
- React 18 + TypeScript + Vite（画面）
- Dexie（ブラウザ内の IndexedDB に保存。**外部送信なし**）
- Chart.js（グラフ）
- vite-plugin-pwa（ホーム画面に追加・オフライン動作）
- Vitest（計算ロジックのテスト）

## 起動
```
npm install      # 初回のみ
npm run dev      # http://localhost:5173
```
- デモ表示（サンプル値・本番とは別DB）：http://localhost:5173/?demo=1
- 同じWi‑FiのiPhoneからは、ターミナルに出る `Network: http://192.168.x.x:5173` を開く
  （http のため iPhone では PWA/オフライン機能は効かない。動作確認用）

## テスト・ビルド
```
npm test         # 14暦日平均・週の筋トレ回数・CSV などのテスト
npm run build    # dist/ に本番用ファイルを出力
```

## 画面
ホーム（目標までの距離・進捗バー）／朝・夜の記録／カレンダー／運動の詳細／月次ボディチェック／グラフ（1週〜全期間）／設定・データ（Excel取り込み・CSV・バックアップ）

## 過去データ（Excel）の取り込み
- 設定 →「過去データ（Excel）を取り込む」。ファイルは端末内で処理し、送信しない
- 見出し行（date / 体重 / 体脂肪率 / 睡眠時間 …）を探して列名で対応付け（`src/importDiet.ts`）
- 取り込み前にプレビュー。既存の日は上書きせず「既存のまま／空欄だけ補う」を選択
- 取り込んだ記録には印が付き、設定から取り消せる

## データについて
- 記録は端末のブラウザごとに保存（iPhoneとMacは別々。同期は Phase 3）
- 「未入力」と「×」は別の状態として保存
- 設定画面から CSV（UTF-8 BOM付き）と JSON バックアップを書き出せる
- iPhone Safari は長期間開かないサイトのデータを消すことがあるため、ホーム画面に追加して使い、定期的にバックアップを推奨

## ファイル
- `src/stats.ts` 14暦日平均などの計算 / `src/stats.test.ts` そのテスト
- `src/db.ts` 保存処理 / `src/csv.ts` CSV出力
- `src/screens/` 各画面（Home, Morning, Evening, Graph, Settings）
