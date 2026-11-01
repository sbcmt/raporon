// 4桁IDはゲームの公開IDです。推測可能なので認可はFirebase Databaseルールで行います。
export function generateGameId() {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return String(1000 + buffer[0] % 9000);
}

// 既存の28桁のゲームIDも引き続き利用可能にする。
export function isValidGameId(id) {
    return typeof id === 'string' && /^(?:[0-9]{4}|[a-f0-9]{28})$/.test(id);
}

// reserve(id) はFirebaseトランザクションで空きIDの取得に成功した場合のみtrueを返す。
// 確認(get)→保存(set)では競合を防げないため、両方を一つのトランザクションにする。
export async function reserveGameId(reserve, maxAttempts = 80) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const id = generateGameId();
        if (await reserve(id)) return id;
    }
    throw new Error('空きゲームIDを確保できませんでした。もう一度お試しください。');
}
