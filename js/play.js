import { auth, db, $, show, clean, alertBox, qrImg, ref, get, set, onValue, serverTimestamp, onAuthStateChanged, signInAnonymously, makeQr, watchVersion, getError, validGameId } from './common.js?v=1.0.8';
const params = new URLSearchParams(location.search);
const gid = params.get('g'), station = Number(params.get('s')), token = params.get('t');
let uid = null, game = null, stamps = {}, submission = null, redeem = null, busy = false, quizDraft = {}, reader = null, unsub = [];
const expiry = () => !game || Date.now() >= Number(game.endsAt);
const resultUrl = () => { const u = new URL('admin.html', location.href); u.searchParams.set('g', gid); u.searchParams.set('u', uid); return u.href; };
function status(message, isError = false) { $('status').textContent = message; $('status').className = 'message' + (isError ? ' error' : ' ok'); }
function drawResult(quiz = false) { show('complete'); show('qr-mode', false); show('quiz-mode', false); $('clear-title').textContent = quiz ? '回答確定' : 'CLEAR!'; $('clear-message').textContent = quiz ? '回答は確定しました。運営スタッフにこちらのQRを提示してください。' : 'コンプリート！ 運営スタッフにこちらのQRを提示してください。'; $('final-qr').replaceChildren(qrImg(resultUrl())); const locked = (redeem === null || redeem === void 0 ? void 0 : redeem.lastRedeemedAt) && Date.now() - redeem.lastRedeemedAt < 86400000; show('used-message', Boolean(locked)); show('final-qr', !locked); if (locked) {
    $('used-message').textContent = 'この結果QRは使用済みです。前回の受付から24時間は再使用できません。';
} }
function ended() { show('ended'); show('qr-mode', false); show('quiz-mode', false); show('complete', false); status('このゲームは終了しました'); }
function stampsView() { if (expiry())
    return ended(); const grid = $('stamp-grid'); grid.replaceChildren(); let got = 0; for (let i = 1; i <= game.count; i++) {
    const acquired = Boolean(stamps[i]), el = document.createElement('div');
    el.className = 'stamp' + (acquired ? ' filled' : '');
    el.innerHTML = `<span class="num">${i}</span>`;
    const img = document.createElement('img');
    img.src = (game.stampImages && game.stampImages[i]) || 'assets/default-stamp.png';
    img.alt = `スタンプ${i}`;
    el.append(img);
    grid.append(el);
    if (acquired)
        got++;
} $('stamp-progress').textContent = `${got} / ${game.count}`; if (got >= game.count)
    return drawResult(false); show('complete', false); show('qr-mode', true); show('quiz-mode', false); }
function draftKey() { return `raporon-draft-${gid}-${uid}`; }
function quizView() { var _a; if (expiry())
    return ended(); if (submission)
    return drawResult(true); show('qr-mode', false); show('complete', false); show('quiz-mode', true); try {
    quizDraft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
}
catch (_b) {
    quizDraft = {};
} ; const area = $('quiz-answers'); area.replaceChildren(); for (let i = 1; i <= game.count; i++) {
    const el = document.createElement('div');
    el.className = 'quiz-question';
    const h = document.createElement('h3');
    h.textContent = `問題 ${i}`;
    el.append(h);
    const choices = document.createElement('div');
    choices.className = 'choice-list';
    for (let j = 1; j <= Number(((_a = game.choiceCounts) === null || _a === void 0 ? void 0 : _a[i]) || 4); j++) {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'radio';
        input.name = 'answer-' + i;
        input.value = j;
        input.checked = quizDraft[i] === j;
        input.addEventListener('change', () => { quizDraft[i] = j; localStorage.setItem(draftKey(), JSON.stringify(quizDraft)); });
        label.append(input, document.createTextNode(String(j)));
        choices.append(label);
    }
    el.append(choices);
    area.append(el);
} }
function parseStation(value) { try {
    const u = new URL(value, location.href);
    if (u.pathname.split('/').pop() !== 'play.html')
        return null;
    const q = u.searchParams;
    return { g: q.get('g'), s: Number(q.get('s')), t: q.get('t') };
}
catch (_a) {
    return null;
} }
async function registerStation(s, t) { if (busy)
    return; if (expiry())
    return ended(); if (game.mode !== 'qr')
    return; busy = true; try {
    if (!Number.isInteger(s) || s < 1 || s > game.count || !(/^[a-f0-9]{48}$/.test(t || '')))
        throw Error('無効な設置QRです');
    if (stamps[s]) {
        status(`${s}番のスタンプは取得済みです`);
        return;
    }
    await set(ref(db, `stamps/${gid}/${uid}/${s}`), { token: t, at: serverTimestamp() });
    status(`${s}番のスタンプを獲得しました！`);
}
catch (e) {
    status(expiry() ? 'このゲームは終了しました' : `スタンプを取得できません：${getError(e)}`, true);
}
finally {
    busy = false;
} }
async function cameraStart() { if (reader)
    return; if (!window.Html5Qrcode) {
    status('カメラ用のライブラリが読み込めません', true);
    return;
} show('play-reader'); const node = 'play-reader'; reader = new Html5Qrcode(node); try {
    await reader.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 220, height: 220 } }, async (value) => { const p = parseStation(value); if (!p || p.g !== gid) {
        status('このゲームの設置QRではありません', true);
        return;
    } await cameraStop(); await registerStation(p.s, p.t); }, () => { });
    show('stop-play-scan');
}
catch (e) {
    status('カメラを使用できません。カメラ権限とHTTPS接続を確認してください。', true);
    try {
        await reader.clear();
    }
    catch (_a) { }
    reader = null;
    show('play-reader', false);
} }
async function cameraStop() { if (!reader)
    return; try {
    await reader.stop();
    await reader.clear();
}
catch (_a) { } reader = null; show('play-reader', false); show('stop-play-scan', false); }
async function load() { if (!gid || !validGameId(gid)) {
    status('有効なゲームIDを指定してください', true);
    return;
} try {
    const snap = await get(ref(db, `games/${gid}`));
    if (!snap.exists()) {
        status('指定されたゲームが見つかりません', true);
        return;
    }
    game = snap.val();
    $('game-title').textContent = game.name || 'スタンプラリー';
    $('game-description').textContent = game.description || '';
    $('end-time').textContent = '終了：' + new Date(game.endsAt).toLocaleString('ja-JP');
    show('play-app');
    if (expiry())
        return ended();
    unsub.push(onValue(ref(db, `redemptions/${gid}/${uid}`), s => { redeem = s.val(); if (document.getElementById('final-qr').children.length)
        drawResult(Boolean(submission)); }, () => { }));
    if (game.mode === 'qr') {
        unsub.push(onValue(ref(db, `stamps/${gid}/${uid}`), s => { stamps = s.val() || {}; stampsView(); }));
        if (token && station)
            await registerStation(station, token);
    }
    else {
        unsub.push(onValue(ref(db, `answers/${gid}/${uid}`), s => { submission = s.val(); quizView(); }));
    }
    status('ゲームを読み込みました');
}
catch (e) {
    status('ゲームを表示できません：' + getError(e), true);
} }
$('open-scan').addEventListener('click', cameraStart);
$('stop-play-scan').addEventListener('click', cameraStop);
$('quiz-form').addEventListener('submit', e => { e.preventDefault(); if (busy || expiry())
    return ended(); for (let i = 1; i <= game.count; i++) {
    if (!quizDraft[i]) {
        status(`問題${i}の回答を選択してください`, true);
        return;
    }
} show('confirm-modal'); });
$('cancel-final').addEventListener('click', () => show('confirm-modal', false));
$('confirm-final').addEventListener('click', async () => { if (busy || expiry())
    return ended(); busy = true; try {
    await set(ref(db, `answers/${gid}/${uid}`), { values: quizDraft, submittedAt: serverTimestamp() });
    localStorage.removeItem(draftKey());
    show('confirm-modal', false);
    status('回答を確定しました');
}
catch (e) {
    status('回答を確定できません：' + getError(e), true);
}
finally {
    busy = false;
} });
watchVersion(() => busy || !!document.querySelector('input[type="radio"]:checked'));
onAuthStateChanged(auth, async (user) => { if (!user) {
    try {
        await signInAnonymously(auth);
    }
    catch (e) {
        status('参加者認証を設定してください：' + getError(e), true);
    }
    return;
} if (uid === user.uid)
    return; uid = user.uid; await load(); });
setInterval(() => { if (game && expiry())
    ended(); }, 20000);
