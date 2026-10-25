import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, update, push, onValue, runTransaction, serverTimestamp, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';
import { firebaseConfig, VERSION } from './config.js?v=1.0.7';
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app), db = getDatabase(app);
export { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, ref, get, set, update, push, onValue, runTransaction, serverTimestamp, query, orderByChild, equalTo };
export const $ = id => document.getElementById(id);
export const show = (id, yes = true) => { var _a; return (_a = $(id)) === null || _a === void 0 ? void 0 : _a.classList.toggle('hide', !yes); };
export const clean = (text) => String(text !== null && text !== void 0 ? text : '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const alertBox = (text, isError = false) => { const n = $('message') || $('status'); if (n) {
    n.textContent = text;
    n.className = 'message' + (isError ? ' error' : ' ok');
    n.classList.remove('hide');
}
else
    alert(text); };
export const escapeCsv = v => '"' + String(v !== null && v !== void 0 ? v : '').replaceAll('"', '""') + '"';
export function makeId(n = 14) { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(v => v.toString(16).padStart(2, '0')).join(''); }
// ゲーム参加用コード（小文字英字＋数字4文字、両方を必ず含む）。
// 36の倍数252未満の乱数だけを採用し、文字ごとの出現率を均等にする。
export function makeGameId() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (;;) {
        let code = '';
        while (code.length < 4) {
            const bytes = new Uint8Array(8);
            crypto.getRandomValues(bytes);
            for (const n of bytes) {
                if (n >= 252) continue;
                code += alphabet[n % alphabet.length];
                if (code.length === 4) break;
            }
        }
        if (/[a-z]/.test(code) && /[0-9]/.test(code)) return code;
    }
}
// 以前に発行した28桁のIDも、既存イベントを壊さないため受け付ける。
export const validGameId = id => /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{4}$/.test(id) || /^[a-f0-9]{28}$/.test(id);
export const eventPath = id => `events/${id}`;
export const urlFor = (filename, params = {}) => { let url = new URL(filename, location.href); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v)); return url.href; };
export function makeQr(value) { if (typeof qrcode !== 'function')
    throw Error('QR作成ライブラリを読み込めません'); const q = qrcode(0, 'M'); q.addData(value, 'Byte'); q.make(); return q.createDataURL(8, 4); }
export function qrImg(value) { let img = document.createElement('img'); img.src = makeQr(value); img.alt = 'QRコード'; return img; }
export function downloadDataUrl(dataUrl, filename) { let a = document.createElement('a'); a.href = dataUrl; a.download = filename; document.body.append(a); a.click(); a.remove(); }
export function localInputDate(epoch) { const date = new Date(epoch); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
export function dateText(v) { return new Date(v).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
export function getError(e) { const code = (e === null || e === void 0 ? void 0 : e.code) || ''; const map = { 'auth/email-already-in-use': 'このメールアドレスは登録済みです', 'auth/invalid-email': 'メールアドレスを確認してください', 'auth/weak-password': 'パスワードは6文字以上にしてください', 'auth/invalid-credential': 'メールアドレスまたはパスワードが違います（Firebaseで作成したアカウントの認証情報を確認してください）', 'auth/user-not-found': 'このメールアドレスのアカウントはありません', 'auth/wrong-password': 'パスワードが違います', 'auth/too-many-requests': '試行回数が多いため一時的に制限されています。しばらくしてから再度お試しください', 'auth/network-request-failed': 'ネットワークに接続できません。通信状態を確認してください', 'auth/unauthorized-domain': 'GitHub PagesのドメインをFirebase Authenticationの承認済みドメインに追加してください', 'auth/operation-not-allowed': 'Firebase Authenticationで必要なログイン方式を有効にしてください', 'permission_denied': 'Realtime Databaseルールとアカウント権限を確認してください', 'PERMISSION_DENIED': 'Realtime Databaseルールとアカウント権限を確認してください' }; return map[code] || (e === null || e === void 0 ? void 0 : e.message) || String(e); }
export function watchVersion(shouldDefer = () => false) { var _a; let shown = false; async function check() { try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok)
        return;
    const data = await res.json();
    if (data.version !== VERSION && !shown) {
        shown = true;
        show('update-banner');
    }
}
catch (_a) { } } ; setInterval(check, 60000); check(); (_a = $('update-reload')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => { if (shouldDefer()) {
    alert('未確定の作業があります。完了・保存してから更新してください。');
    return;
} location.reload(); }); }
export function waitAuth() { return new Promise(resolve => { const stop = onAuthStateChanged(auth, u => { stop(); resolve(u); }); }); }
