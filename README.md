# RapoRon v1.0 初期検証パッケージ

対象：GitHub Pages + Firebase Authentication + Firebase Realtime Database（`rapop-ron`）。

## 導入手順
1. `index.html`・`admin.html`・`play.html`・`js/`・`assets/`・`manifest.webmanifest`・`version.json`・`.nojekyll` をGitHub Pagesの公開対象フォルダへアップロードします。
2. Firebase Console → Authentication → Sign-in methodで **メール/パスワード** と **匿名** を有効にします。
3. Firebase Console → Realtime Database → ルールで **`database.rules.json` の `rules` オブジェクトの内容をまるごと貼り付けて公開** します（既存ルールは変更されます）。`database.rules.json` はGitHubへ置いてもルールとして自動適用されません。
4. GitHub Pages公開URLの `admin.html` で運営アカウントを作成し、ゲームを登録します。参加者用QR/各設置QRのPDFを生成できます。
5. 別ブラウザまたは別端末の参加者用QRから起動し、QR取得・クイズ回答、運営側の結果QR読み取りまで検証します。

## 仕様・注意
- QRスタンプと3～4択クイズの各方式、最大20か所。クイズの参加画面には問題文も正解も出ません。
- クイズは全問回答後、確定すると **同じFirebase匿名ユーザーでは再提出不可** です。
- QR方式は全スタンプを取得したら **CLEAR!** と結果QRが表示されます。
- **結果QRは運営が読み取るとその時点で受付記録が発生し、24時間再使用できません**。誤読み取りでもロックされるため、景品を渡す準備後に読み取ってください。景品設定がなくてもロックされます。
- 同一Firebase UIDでの24時間再利用をRealtime Databaseルールで制限しています。ただし、匿名ユーザーのアカウントをリセットして別UIDを取得する行為や画面・QRの転送などを**完全に防ぐことはできません**。本人確認や厳密な不正対策は別途必要です。
- スタンプ画像は **正確に512×512ピクセル**のPNG/JPG/WebPを個別登録可能です。Firebase Storageは使わず、圧縮WebPをRealtime Database内に保存しています。
- 終了日時を過ぎると新規スタンプ取得・クイズ回答確定はデータベースルール側でも禁止します。
- ホーム画面用・ファビコン用画像と、自動更新チェックを含みます。作業中は確認してから再読み込みします。
- このパッケージでは **Firebase接続の実機テスト、Pagesへの公開、Firebaseルールのデプロイは未実施** です。正式運用前にルールのエミュレーター検証と端末テストが必要です。
- 公開にはHTTPS環境が必要です。ライブラリはCDN読み込みのためオフライン動作は保証されません。

### ファイル
- 画面: `index.html`, `admin.html`, `play.html`
- 処理: `js/common.js`, `js/admin.js`, `js/play.js`, `js/config.js`
- デザイン・画像: `assets/`
- Firebase RTDBルール: `database.rules.json`
- PWA: `manifest.webmanifest`
- 更新情報: `version.json`
