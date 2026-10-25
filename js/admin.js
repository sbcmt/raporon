import { auth, db, $, show, clean, alertBox, qrImg, makeQr, downloadDataUrl, localInputDate, dateText, makeId, getError, watchVersion, ref, get, set, push, update, onValue, runTransaction, serverTimestamp, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from './common.js?v=1.0.6';
let user = null, allGames = {}, currentId = null, editingId = null, selectedMode = 'qr', entries = [], rewards = [], reader = null, dirty = false;
const params = new URLSearchParams(location.search);
const eventUrl = id => new URL('play.html?g=' + encodeURIComponent(id), location.href).href;
const pointUrl = (id, n, token) => { let u = new URL(eventUrl(id)); u.searchParams.set('s', n); u.searchParams.set('t', token); return u.href; };
const labelMode = m => m === 'qr' ? 'QRスタンプラリー' : 'クイズスタンプラリー';
function notify(msg, error = false) { alertBox(msg, error); }
;
function switchAuth(toSignup = false) {
    show('login-view', !toSignup);
    show('signup-view', toSignup);
    show('message', false);
    if (toSignup && $('email').value && !$('signup-email').value)
        $('signup-email').value = $('email').value;
    if (!toSignup && $('signup-email').value && !$('email').value)
        $('email').value = $('signup-email').value;
}
function showLogin(u) {
    // A participant may already have an anonymous session in this browser.
    // Only a non-anonymous administrator is admitted to the management UI.
    user = u && !u.isAnonymous ? u : null;
    show('auth-panel', !user);
    show('dashboard', Boolean(user));
    show('logout', Boolean(user));
    if (user) {
        show('message', false);
        switchAuth(false);
        refreshList();
    }
}
$('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('login-button');
    button.disabled = true;
    button.textContent = 'ログイン中…';
    try {
        await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
    }
    catch (err) {
        notify('ログインできません：' + getError(err), true);
    }
    finally {
        button.disabled = false;
        button.textContent = 'ログイン';
    }
});
$('signup-button').addEventListener('click', () => switchAuth(true));
$('back-login').addEventListener('click', () => switchAuth(false));
$('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;
    if (password !== $('signup-confirm').value) {
        notify('確認用パスワードが一致しません', true);
        return;
    }
    const button = $('register-button');
    button.disabled = true;
    button.textContent = '登録中…';
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        $('email').value = email;
        $('password').value = '';
        $('signup-password').value = '';
        $('signup-confirm').value = '';
        notify('アカウントを作成しました。イベント管理画面を開きます');
    }
    catch (err) {
        notify('新規登録できません：' + getError(err), true);
    }
    finally {
        button.disabled = false;
        button.textContent = 'アカウントを作成';
    }
});
$('logout').addEventListener('click', () => signOut(auth));
async function refreshList() { if (!user)
    return; try {
    const snap = await get(ref(db, `ownerEvents/${user.uid}`));
    allGames = snap.val() || {};
    const area = $('event-list');
    area.replaceChildren();
    const keys = Object.keys(allGames);
    if (!keys.length) {
        area.textContent = 'まだイベントはありません。「新しいイベント」から登録してください。';
        return;
    }
    for (const id of keys) {
        const s = await get(ref(db, `games/${id}`));
        if (!s.exists())
            continue;
        let ev = s.val();
        const el = document.createElement('article');
        el.className = 'event-card';
        el.innerHTML = `<div><h3>${clean(ev.name)}</h3><p class="muted">${labelMode(ev.mode)}／${ev.count}個／終了 ${clean(dateText(ev.endsAt))}</p><p class="smalltext">ID: ${id}</p></div>`;
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = '管理する';
        btn.onclick = () => openTools(id);
        el.append(btn);
        area.append(el);
    }
}
catch (e) {
    notify(getError(e), true);
} }
function blankEntry(n) { return { n, token: makeId(24), question: '', choices: ['', '', '', ''], correct: 1, choiceCount: 4, image: null }; }
function resetEditor() { editingId = null; selectedMode = 'qr'; entries = Array.from({ length: 5 }, (_, i) => blankEntry(i + 1)); rewards = []; $('event-form').reset(); $('ev-count').value = 5; $('ev-end').value = localInputDate(Date.now() + 86400000); $('ev-mode').value = 'qr'; $('editor-title').textContent = 'イベント作成'; renderEntries(); renderRewards(); show('editor'); show('tools', false); dirty = false; }
$('new-event').onclick = resetEditor;
$('close-editor').onclick = () => { if (dirty && !confirm('未保存の変更があります。閉じますか？'))
    return; show('editor', false); dirty = false; };
$('ev-mode').addEventListener('change', () => { selectedMode = $('ev-mode').value; renderEntries(); dirty = true; });
$('ev-count').addEventListener('change', () => { const n = Number($('ev-count').value); if (!Number.isInteger(n) || n < 1 || n > 20)
    return notify('1〜20を指定してください', true); while (entries.length < n)
    entries.push(blankEntry(entries.length + 1)); entries = entries.slice(0, n); renderEntries(); dirty = true; });
$('event-form').addEventListener('input', () => dirty = true);
async function scaleImage(file) { if (!/image\/(png|jpeg|webp)/.test(file.type))
    throw Error('PNG、JPG、WebPのみ対応しています'); const blobUrl = URL.createObjectURL(file); try {
    const image = new Image();
    image.src = blobUrl;
    await image.decode();
    if (image.width !== 512 || image.height !== 512)
        throw Error('画像は512×512pxにしてください');
    let c = document.createElement('canvas');
    c.width = c.height = 512;
    let x = c.getContext('2d');
    x.drawImage(image, 0, 0, 512, 512);
    let out = c.toDataURL('image/webp', .72);
    if (out.length > 335000)
        throw Error('画像の容量が大きすぎます。別の画像をお試しください');
    return out;
}
finally {
    URL.revokeObjectURL(blobUrl);
} }
function renderEntries() {
    const mode = $('ev-mode').value, area = $('entries');
    area.replaceChildren();
    entries.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'entry';
        el.innerHTML = `<div class="entry-head"><strong>${mode === 'qr' ? 'スタンプ' : '問題'} ${i + 1}</strong>${mode === 'qr' ? '<img alt="スタンプ画像" src="' + (item.image || 'assets/default-stamp.png') + '">' : ''}</div>`;
        if (mode === 'qr') {
            const lab = document.createElement('label');
            lab.textContent = '表示名（任意）';
            const inp = document.createElement('input');
            inp.maxLength = 60;
            inp.value = item.name || '';
            inp.oninput = () => { item.name = inp.value; dirty = true; };
            lab.append(inp);
            el.append(lab);
            const imgLabel = document.createElement('label');
            imgLabel.textContent = 'スタンプ画像 512×512px（未設定時はRapoRonアイコン）';
            const file = document.createElement('input');
            file.type = 'file';
            file.accept = 'image/png,image/jpeg,image/webp';
            file.onchange = async () => { var _a; try {
                if (!((_a = file.files) === null || _a === void 0 ? void 0 : _a[0]))
                    return;
                item.image = await scaleImage(file.files[0]);
                dirty = true;
                renderEntries();
            }
            catch (e) {
                notify(e.message, true);
            } };
            imgLabel.append(file);
            el.append(imgLabel);
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'ghost small';
            reset.textContent = '画像を初期設定に戻す';
            reset.onclick = () => { item.image = null; dirty = true; renderEntries(); };
            el.append(reset);
        }
        else {
            const q = document.createElement('label');
            q.textContent = '印刷用問題文';
            const inp = document.createElement('textarea');
            inp.rows = 2;
            inp.maxLength = 300;
            inp.value = item.question;
            inp.oninput = () => { item.question = inp.value; dirty = true; };
            q.append(inp);
            el.append(q);
            const count = document.createElement('label');
            count.textContent = '選択肢数';
            const sel = document.createElement('select');
            for (const n of [3, 4]) {
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n + '択';
                sel.append(opt);
            }
            sel.value = item.choiceCount;
            sel.onchange = () => { item.choiceCount = Number(sel.value); if (item.correct > item.choiceCount)
                item.correct = 1; dirty = true; renderEntries(); };
            count.append(sel);
            el.append(count);
            const options = document.createElement('div');
            options.className = 'entry-fields';
            for (let c = 1; c <= item.choiceCount; c++) {
                const row = document.createElement('label');
                row.className = 'option-row';
                const span = document.createElement('span');
                span.textContent = c;
                const t = document.createElement('input');
                t.maxLength = 120;
                t.placeholder = '選択肢の内容';
                t.value = item.choices[c - 1] || '';
                t.oninput = () => { item.choices[c - 1] = t.value; dirty = true; };
                row.append(span, t);
                options.append(row);
            }
            el.append(options);
            const corr = document.createElement('label');
            corr.textContent = '正解番号';
            const csel = document.createElement('select');
            for (let c = 1; c <= item.choiceCount; c++) {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = String(c);
                csel.append(opt);
            }
            csel.value = item.correct;
            csel.onchange = () => { item.correct = Number(csel.value); dirty = true; };
            corr.append(csel);
            el.append(corr);
        }
        area.append(el);
    });
}
function renderRewards() { const box = $('rewards'); box.replaceChildren(); rewards.forEach((r, i) => { const row = document.createElement('div'); row.className = 'reward-row'; const n = document.createElement('input'); n.type = 'number'; n.min = 0; n.max = 20; n.value = r.min; n.title = '正解数／取得数の下限'; n.oninput = () => { r.min = Number(n.value); dirty = true; }; const t = document.createElement('input'); t.placeholder = '景品名（空欄ならなし）'; t.maxLength = 80; t.value = r.name || ''; t.oninput = () => { r.name = t.value; dirty = true; }; const del = document.createElement('button'); del.type = 'button'; del.className = 'ghost'; del.textContent = '削除'; del.onclick = () => { rewards.splice(i, 1); dirty = true; renderRewards(); }; row.append(document.createTextNode('以上'), n, t, del); box.append(row); }); }
$('add-reward').onclick = () => { rewards.push({ min: 0, name: '' }); renderRewards(); dirty = true; };
$('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!user) return notify('運営ログインが必要です', true);
    const count = Number($('ev-count').value);
    const endsAt = new Date($('ev-end').value).getTime();
    if (!Number.isInteger(count) || count < 1 || count > 20)
        return notify('ポイント／問題数は1〜20にしてください', true);
    if (!Number.isFinite(endsAt) || endsAt <= Date.now())
        return notify('未来の終了日時を選択してください', true);
    const mode = $('ev-mode').value;
    if (mode === 'quiz' && entries.some(x => !x.question.trim() || x.choices.slice(0, x.choiceCount).some(c => !c.trim())))
        return notify('すべての問題文と選択肢を入力してください', true);
    const id = editingId || makeId(14);
    const saveButton = $('save-event');
    saveButton.disabled = true;
    try {
        // Preserve the original creation time while editing an existing event.
        const oldGame = editingId ? (await get(ref(db, `games/${id}`))).val() : null;
        if (editingId && (!oldGame || oldGame.ownerUid !== user.uid))
            throw Error('編集するイベントが見つからないか、管理権限がありません');
        const publicGame = {
            ownerUid: user.uid,
            name: $('ev-name').value.trim(),
            description: $('ev-desc').value.trim(),
            mode, count, endsAt,
            choiceCounts: {}, stampImages: {},
            createdAt: oldGame?.createdAt || Date.now()
        };
        const def = {
            ownerUid: user.uid,
            entries: {},
            rewards: rewards.filter(r => r.name.trim()).map(r => ({ min: Number(r.min), name: r.name.trim() }))
        };
        for (let i = 1; i <= count; i++) {
            const item = entries[i - 1];
            publicGame.choiceCounts[i] = mode === 'quiz' ? item.choiceCount : 0;
            if (mode === 'qr' && item.image) publicGame.stampImages[i] = item.image;
            def.entries[i] = mode === 'qr'
                ? { token: item.token, name: item.name || '' }
                : { question: item.question, choices: item.choices.slice(0, item.choiceCount), correct: item.correct };
        }
        await set(ref(db, `games/${id}`), publicGame);
        await set(ref(db, `private/${id}`), def);
        await set(ref(db, `ownerEvents/${user.uid}/${id}`), true);
        dirty = false;
        show('editor', false);
        notify('保存しました');
        await refreshList();
        await openTools(id);
    } catch (err) {
        notify('保存できません：' + getError(err), true);
    } finally {
        saveButton.disabled = false;
    }
});
async function editGame() { if (!currentId)
    return; try {
    const [a, b] = await Promise.all([get(ref(db, `games/${currentId}`)), get(ref(db, `private/${currentId}`))]);
    if (!a.exists() || !b.exists())
        throw Error('編集データが見つかりません');
    const g = a.val(), p = b.val();
    editingId = currentId;
    $('ev-name').value = g.name;
    $('ev-desc').value = g.description || '';
    $('ev-mode').value = g.mode;
    $('ev-count').value = g.count;
    $('ev-end').value = localInputDate(g.endsAt);
    entries = Array.from({ length: g.count }, (_, idx) => { var _a, _b; const n = idx + 1, z = p.entries[n] || {}; return { n, token: z.token || makeId(24), name: z.name || '', image: ((_a = g.stampImages) === null || _a === void 0 ? void 0 : _a[n]) || null, question: z.question || '', choices: [...(z.choices || []), '', '', '', ''].slice(0, 4), correct: z.correct || 1, choiceCount: ((_b = g.choiceCounts) === null || _b === void 0 ? void 0 : _b[n]) || 4 }; });
    rewards = p.rewards || [];
    renderEntries();
    renderRewards();
    $('editor-title').textContent = 'イベント編集';
    show('editor');
    show('tools', false);
    dirty = false;
}
catch (e) {
    notify(getError(e), true);
} }
$('edit-current').onclick = editGame;
// Deleting an event requires an explicit confirmation, without entering its game ID.
let deleting = false;
$('delete-current').addEventListener('click', async () => {
    if (!user || !currentId || deleting) return;
    try {
        const snapshot = await get(ref(db, `games/${currentId}`));
        if (!snapshot.exists() || snapshot.val().ownerUid !== user.uid)
            throw Error('削除対象が見つからないか、管理権限がありません');
        $('delete-confirm-game').textContent = snapshot.val().name;
        show('delete-confirm-modal');
        $('cancel-delete').focus();
    } catch (err) { notify('削除対象を確認できません：' + getError(err), true); }
});
$('cancel-delete').addEventListener('click', () => {
    if (!deleting) show('delete-confirm-modal', false);
});
$('confirm-delete').addEventListener('click', async () => {
    if (!user || !currentId || deleting) return;
    deleting = true;
    const id = currentId;
    const confirmButton = $('confirm-delete');
    confirmButton.disabled = true;
    $('cancel-delete').disabled = true;
    $('delete-current').disabled = true;
    try {
        const snapshot = await get(ref(db, `games/${id}`));
        if (!snapshot.exists() || snapshot.val().ownerUid !== user.uid)
            throw Error('削除対象が見つからないか、管理権限がありません');
        // One atomic multi-location update; a failed permission check leaves data intact.
        const paths = {
            [`ownerEvents/${user.uid}/${id}`]: null,
            [`private/${id}`]: null,
            [`stamps/${id}`]: null,
            [`answers/${id}`]: null,
            [`redemptions/${id}`]: null,
            [`games/${id}`]: null
        };
        await update(ref(db), paths);
        show('delete-confirm-modal', false);
        show('tools', false);
        show('editor', false);
        currentId = null;
        notify('イベントを削除しました');
        await refreshList();
    } catch (err) {
        notify('イベントを削除できません：' + getError(err), true);
        show('delete-confirm-modal', false);
    } finally {
        deleting = false;
        confirmButton.disabled = false;
        $('cancel-delete').disabled = false;
        $('delete-current').disabled = false;
    }
});

async function openTools(id) { try {
    const s = await get(ref(db, `games/${id}`));
    if (!s.exists())
        throw Error('ゲームが見つかりません');
    currentId = id;
    const game = s.val();
    $('tools-title').textContent = game.name;
    $('tools-meta').textContent = `${labelMode(game.mode)} ／ ${game.count}個 ／ ${dateText(game.endsAt)}終了`;
    show('tools');
    show('editor', false);
    show('join-qr-area', false);
    await getStats();
    const target = params.get('g'), uid = params.get('u');
    if (target === id && uid)
        await inspectResult(id, uid);
}
catch (e) {
    notify(getError(e), true);
} }
$('back-events').onclick = () => { show('tools', false); currentId = null; refreshList(); };
$('join-qr').onclick = () => { if (!currentId)
    return; const url = eventUrl(currentId), el = $('join-qr-area'); el.replaceChildren(); const h = document.createElement('h3'); h.textContent = '参加者向けQR'; const img = qrImg(url); const p = document.createElement('p'); p.textContent = url; const b = document.createElement('button'); b.textContent = 'QRをPNG保存'; b.onclick = () => downloadDataUrl(img.src, 'RapoRon_参加用QR.png'); el.append(h, img, p, b); show('join-qr-area'); };
function printablePanel(title, body) { const section = document.createElement('section'); section.style.cssText = 'width:730px;min-height:1000px;background:#fff;color:#182e50;padding:50px 56px;font-family:system-ui,"Yu Gothic",sans-serif;border:2px solid #e0e6ef;box-sizing:border-box'; const h = document.createElement('h1'); h.textContent = title; h.style.cssText = 'font-size:32px;border-bottom:5px solid #e35c79;padding-bottom:20px;margin:0 0 55px'; section.append(h, body); return section; }
$('print-pdf').onclick = async () => { if (!currentId)
    return; const button = $('print-pdf'); button.disabled = true; try {
    if (!window.jspdf || !window.html2canvas)
        throw Error('PDF生成ライブラリが読み込めません');
    const [a, b] = await Promise.all([get(ref(db, `games/${currentId}`)), get(ref(db, `private/${currentId}`))]);
    const ev = a.val(), def = b.val();
    const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    for (let i = 1; i <= ev.count; i++) {
        const item = def.entries[i];
        const body = document.createElement('div');
        if (ev.mode === 'quiz') {
            const p = document.createElement('p');
            p.textContent = item.question;
            p.style.cssText = 'font-size:30px;font-weight:800;white-space:pre-wrap';
            body.append(p);
            for (let j = 0; j < item.choices.length; j++) {
                const op = document.createElement('p');
                op.textContent = `${j + 1}.  ${item.choices[j]}`;
                op.style.cssText = 'font-size:25px;margin:25px 0';
                body.append(op);
            }
        }
        else {
            let p = document.createElement('p');
            p.textContent = item.name || `スタンプ ${i}`;
            p.style.cssText = 'font-size:36px;font-weight:800';
            let img = qrImg(pointUrl(currentId, i, item.token));
            img.style.cssText = 'width:450px;height:450px;display:block;margin:42px auto';
            body.append(p, img);
        }
        const note = document.createElement('p');
        note.textContent = ev.mode === 'quiz' ? '回答は参加者用画面で番号を選んでください' : 'QRを読み取ってスタンプを獲得しよう！';
        note.style.cssText = 'font-size:22px;margin-top:70px';
        body.append(note);
        const panel = printablePanel(`${ev.name}  ${ev.mode === 'quiz' ? '問題' : 'スタンプ'} ${i}`, body);
        panel.style.position = 'fixed';
        panel.style.left = '-10000px';
        document.body.append(panel);
        const canvas = await html2canvas(panel, { backgroundColor: '#fff', scale: 1.8 });
        panel.remove();
        if (i > 1)
            pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 210, 297);
    }
    pdf.save(`RapoRon_${ev.mode === 'quiz' ? 'クイズ問題' : '設置用QR'}_${currentId}.pdf`);
    notify('PDFを作成しました（各問題／地点1ページ）');
}
catch (e) {
    notify('PDFを作成できません：' + getError(e), true);
}
finally {
    button.disabled = false;
} };
async function getStats() { if (!currentId)
    return; try {
    const [gameSnap, s, a, r] = await Promise.all([get(ref(db, `games/${currentId}`)), get(ref(db, `stamps/${currentId}`)), get(ref(db, `answers/${currentId}`)), get(ref(db, `redemptions/${currentId}`))]);
    const game = gameSnap.val();
    const ss = s.val() || {}, aa = a.val() || {}, rr = r.val() || {};
    const members = new Set([...Object.keys(ss), ...Object.keys(aa)]);
    let completed = game.mode === 'quiz' ? Object.keys(aa).length : Object.values(ss).filter(x => Object.keys(x || {}).length >= game.count).length;
    let claims = Object.values(rr).reduce((v, x) => v + (x.claimCount || 0), 0);
    $('stats').innerHTML = `<div class="stat">参加者 ${members.size}名</div><div class="stat">完了 ${completed}名</div><div class="stat">結果QR受付 ${claims}回</div>`;
}
catch (e) {
    notify('集計取得に失敗：' + getError(e), true);
} }
$('refresh-stats').onclick = getStats;
$('export-csv').onclick = async () => { var _a, _b; if (!currentId)
    return; try {
    const [g, s, a, r] = await Promise.all(['games', 'stamps', 'answers', 'redemptions'].map(p => get(ref(db, `${p}/${currentId}`))));
    const game = g.val(), st = s.val() || {}, ans = a.val() || {}, red = r.val() || {};
    const uids = new Set([...Object.keys(st), ...Object.keys(ans), ...Object.keys(red)]);
    let rows = ['"参加者UID","方式","取得スタンプ数","回答確定","受付回数","最終受付日時"'];
    for (let uid of uids) {
        const cols = [uid, game.mode, Object.keys(st[uid] || {}).length, !!ans[uid], ((_a = red[uid]) === null || _a === void 0 ? void 0 : _a.claimCount) || 0, ((_b = red[uid]) === null || _b === void 0 ? void 0 : _b.lastRedeemedAt) ? dateText(red[uid].lastRedeemedAt) : ''];
        rows.push(cols.map(c => '"' + String(c).replaceAll('"', '""') + '"').join(','));
    }
    downloadDataUrl('data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + rows.join('\r\n')), 'RapoRon_参加状況.csv');
}
catch (e) {
    notify(getError(e), true);
} };
function resultParts(value) { try {
    const url = new URL(value, location.href);
    if (url.pathname.split('/').pop() !== 'admin.html')
        return null;
    const g = url.searchParams.get('g'), u = url.searchParams.get('u');
    if (!/^[a-f0-9]{28}$/.test(g || '') || !/^[a-zA-Z0-9]{15,64}$/.test(u || ''))
        return null;
    return { g, u };
}
catch (_a) {
    return null;
} }
async function inspectResult(g, u) {
    var _a, _b;
    const panel = $('result-panel');
    panel.replaceChildren();
    show('result-panel');
    try {
        if (!user)
            throw Error('運営ログインが必要です');
        const [gs, pr, ss, as, rs] = await Promise.all([
            get(ref(db, `games/${g}`)), get(ref(db, `private/${g}`)), get(ref(db, `stamps/${g}/${u}`)),
            get(ref(db, `answers/${g}/${u}`)), get(ref(db, `redemptions/${g}/${u}`))
        ]);
        if (!gs.exists() || !pr.exists())
            throw Error('運営権限のあるゲームではありません');
        const game = gs.val(), def = pr.val();
        if (game.ownerUid !== user.uid)
            throw Error('このイベントを管理する権限がありません');
        let count = 0, completed = false;
        if (game.mode === 'quiz') {
            if (!as.exists())
                throw Error('回答はまだ確定していません');
            const vals = as.val().values || {};
            for (let i = 1; i <= game.count; i++)
                if (Number(vals[i]) === Number(def.entries[i].correct))
                    count++;
            completed = true;
        }
        else {
            const stamps = ss.val() || {};
            count = Object.keys(stamps).length;
            completed = count === game.count;
        }
        if (!completed)
            throw Error(`未達成：現在 ${count}/${game.count}`);
        // First valid scan consumes this result QR immediately, even when no prize is configured.
        const entryRef = ref(db, `redemptions/${g}/${u}`);
        const transaction = await runTransaction(entryRef, old => {
            if ((old === null || old === void 0 ? void 0 : old.lastRedeemedAt) && Date.now() - old.lastRedeemedAt < 86400000)
                return;
            return { lastRedeemedAt: serverTimestamp(), claimCount: ((old === null || old === void 0 ? void 0 : old.claimCount) || 0) + 1 };
        }, { applyLocally: false });
        if (!transaction.committed) {
            const snap = await get(entryRef);
            const prev = ((_a = snap.val()) === null || _a === void 0 ? void 0 : _a.lastRedeemedAt) || 0;
            panel.innerHTML = '<h3>使用済みQR</h3><p>この結果QRは前回の読み取りから24時間使用できません。</p>';
            if (prev) {
                const p = document.createElement('p');
                p.textContent = '再利用可能：' + dateText(prev + 86400000);
                panel.append(p);
            }
            return;
        }
        const reward = ((_b = (def.rewards || []).filter(x => count >= x.min).sort((a, b) => b.min - a.min)[0]) === null || _b === void 0 ? void 0 : _b.name) || '景品なし';
        panel.innerHTML = `<h3>${clean(game.name)}／結果確認</h3><div class="result-score">${game.mode === 'quiz' ? `正解 ${count} / ${game.count}` : `達成 ${count} / ${game.count}`}</div><p><strong>景品：${clean(reward)}</strong></p><p>このQRは受付済みです。24時間は再使用できません。</p>`;
        notify('結果QRを受付しました。24時間ロックを記録しました');
        getStats();
    }
    catch (e) {
        panel.textContent = '確認できません：' + getError(e);
    }
}
$('inspect-manual').onclick = () => { const o = resultParts($('result-url').value); if (!o)
    return notify('結果QRの正しいURLを入力してください', true); inspectResult(o.g, o.u); };
$('start-scan').onclick = async () => { if (reader || !window.Html5Qrcode)
    return; reader = new Html5Qrcode('reader'); try {
    await reader.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 230, height: 230 } }, async (val) => { const result = resultParts(val); if (!result) {
        notify('RapoRonの結果QRではありません', true);
        return;
    } await stopReader(); await inspectResult(result.g, result.u); }, () => { });
    $('start-scan').disabled = true;
    $('stop-scan').disabled = false;
}
catch (e) {
    notify('カメラを開始できません：' + getError(e), true);
    try {
        await reader.clear();
    }
    catch (_a) { }
    reader = null;
} };
async function stopReader() { if (!reader)
    return; try {
    await reader.stop();
    await reader.clear();
}
catch (_a) { } reader = null; $('start-scan').disabled = false; $('stop-scan').disabled = true; }
$('stop-scan').onclick = stopReader;
watchVersion(() => dirty);
onAuthStateChanged(auth, u => { showLogin(u); if (user && params.get('g') && params.get('u'))
    openTools(params.get('g')); }, err => notify('Firebase認証の初期化に失敗しました：' + getError(err), true));
