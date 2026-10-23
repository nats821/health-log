# からだログ（Phase 1）

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

## データについて
- 記録は端末のブラウザごとに保存（iPhoneとMacは別々。同期は Phase 3）
- 「未入力」と「×」は別の状態として保存
- 設定画面から CSV（UTF-8 BOM付き）と JSON バックアップを書き出せる
- iPhone Safari は長期間開かないサイトのデータを消すことがあるため、ホーム画面に追加して使い、定期的にバックアップを推奨

## ファイル
- `src/stats.ts` 14暦日平均などの計算 / `src/stats.test.ts` そのテスト
- `src/db.ts` 保存処理 / `src/csv.ts` CSV出力
- `src/screens/` 各画面（Home, Morning, Evening, Graph, Settings）
