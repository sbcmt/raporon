# RapoRon v1.0.2 認証画面・ロゴ修正版（初期検証）

対象：GitHub Pages + Firebase Authentication + Firebase Realtime Database（`rapop-ron`）。

## 導入手順
1. `index.html`・`admin.html`・`play.html`・`js/`・`assets/`・`manifest.webmanifest`・`version.json`・`.nojekyll` をGitHub Pagesの公開対象フォルダへアップロードします。
2. Firebase Console → Authentication → Sign-in methodで **メール/パスワード** と **匿名** を有効にします。
3. Firebase Console → **Realtime Database → ルール**で、**`database.rules.json` の最初の `{` から最後の `}` まで全文（最上位の `"rules"` キーを含む）を貼り付け、「公開」**してください（既存ルールを置き換えます）。**`firebase.json` を貼り付けないでください。** `database.rules.json` はGitHubへ置いてもルールとして自動適用されません。
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

## Firebaseルール修正（v1.0.1）
旧版に含まれていた `numChildren()` は Realtime Database Security Rules では使えません。
`database.rules.json` は全設問・全地点の存在を1〜20個のキーで個別に確認するよう修正済みです。
Firebase Console → Realtime Database → ルールにファイル全文を貼り付けて公開してください。
`firebase.json` をルール画面に貼らないでください。
※ Firebaseへの実接続と実機動作テストは未実施です。公開前にスタンプ未達成・回答未入力・24時間以内の再使用拒否を検証してください。

## v1.0.2 修正点
- 運営者の新規登録を独立画面に変更し、メール、パスワード、パスワード再確認を追加。
- 管理画面へのログイン失敗時のエラーメッセージを改善。Firebaseモジュールが読み込めなかった場合の原因も表示。
- トップ、運営管理、参加者画面のRapoRon表記を正式採用済みの文字ロゴ画像に差し替え。
- Firebase Realtime Databaseルールは v1.0.1 のまま変更していません。再公開不要。

### ログイン・新規登録に失敗する場合
1. Firebase Console の **Authentication > ログイン方法** から「メール/パスワード」が有効か確認してください。「匿名」も参加者のために有効にします。
2. 既にFirebase Consoleでユーザーを登録した場合は「新規登録」でなく「ログイン」を選んでください。
3. **Authentication > 設定 > 承認済みドメイン** を確認し、アプリで認証方法に求められる場合は公開ホスト（例: `ユーザー名.github.io`）を追加してください。URL全体ではなくホスト名を追加します。
4. 操作後に表示されるエラー文を控えてください。
5. 更新後も旧画面が残る場合はブラウザでShift+再読み込み／新しいタブで開き直しを試してください。

### 更新手順
GitHub Pagesの既存ファイルに上書き（`assets/raporon-wordmark.png` は新規ファイル）。
**Firebase Databaseルール：変更なし・更新不要。**
実ブラウザでの認証成功やFirestore/Realtime Databaseへの書き込みは未検証です。
