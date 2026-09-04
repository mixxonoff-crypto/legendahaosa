// =====================================================================
// ОНЛАЙН-СИНХРОНИЗАЦИЯ (Supabase) — ЭТАП 1: кланы + публичные данные игроков
// =====================================================================
// ВАЖНО: вся игровая логика по-прежнему читает/пишет ТОЛЬКО localStorage
// (через ldbRead/ldbWrite) — это осталось без изменений, чтобы не трогать
// тысячи мест в коде и не сломать игру. Этот блок работает "поверх":
//   1) после каждого saveActiveClan()/saveData() — тихо отправляет свежие
//      данные в Supabase (push), не дожидаясь ответа, с троттлингом;
//   2) в фоне каждые SYNC_PULL_INTERVAL_MS — забирает свежие данные ОТ
//      ВСЕХ игроков из Supabase и подмешивает их в localStorage (pull),
//      после чего game UI перерисовывается, если открыт клановый экран.
// Если Supabase недоступен (не настроен ключ, нет сети) — игра продолжает
// работать полностью локально, как раньше, без единой ошибки в консоли.
//
// НАСТРОЙКА: впиши свои значения из Supabase → Project Settings → API.
// =====================================================================
const SUPABASE_URL = "https://ВАШ-ПРОЕКТ.supabase.co";
const SUPABASE_ANON_KEY = "ВАШ-ANON-KEY";

let supa = null;
try {
    if (typeof window.supabase !== 'undefined' && SUPABASE_URL.indexOf("ВАШ-ПРОЕКТ") === -1) {
        supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) { supa = null; }

const SYNC_PULL_INTERVAL_MS = 15000; // как часто подтягиваем чужие изменения

// ---- КЛАНЫ: отправка одного клана на сервер (после любого saveActiveClan) ----
let clanPushTimer = null;
function pushClanToServer(clanData) {
    if (!supa || !clanData || !clanData.name) return;
    // Троттлинг: если за 2 секунды прилетело много вызовов подряд (серия ударов
    // в бою и т.п.) — отправляем на сервер только последнее состояние.
    if (clanPushTimer) clearTimeout(clanPushTimer);
    clanPushTimer = setTimeout(() => {
        supa.from('clans').upsert({
            name_lower: clanData.name.toLowerCase(),
            name: clanData.name,
            owner: clanData.owner,
            data: clanData,
            updated_at: new Date().toISOString()
        }).then(({ error }) => { if (error) console.warn("Sync (clan push) error:", error.message); });
    }, 2000);
}

// ---- КЛАНЫ: подтягиваем ВСЕ кланы с сервера и сливаем в localStorage ----
// Приоритет отдаём той версии, что новее (по updated_at) — простое
// "последняя запись побеждает", этого достаточно для казуальной игры.
async function pullClansFromServer() {
    if (!supa) return;
    const { data, error } = await supa.from('clans').select('*');
    if (error || !data) return;
    const localClans = ldbRead(LOCAL_DB_KEYS.clans);
    data.forEach(row => {
        const local = localClans[row.name_lower];
        const remoteTime = new Date(row.updated_at).getTime();
        const localTime = local && local.updated_at ? local.updated_at : 0;
        if (!local || remoteTime > localTime) {
            localClans[row.name_lower] = { name: row.name, owner: row.owner, data: row.data, updated_at: remoteTime };
        }
    });
    ldbWrite(LOCAL_DB_KEYS.clans, localClans);
    // Если активный клан игрока обновился (например, товарищ по клану
    // прокачал алтарь) — подхватываем свежие данные и обновляем экран.
    if (activePlayer && activePlayer.clanName) {
        const fresh = localClans[activePlayer.clanName.toLowerCase()];
        if (fresh && fresh.data) {
            activeClan = fresh.data;
            if (document.getElementById('clan-main-screen') && !document.getElementById('clan-main-screen').classList.contains('hidden')) updateClanUI();
            if (document.getElementById('clan-tower-screen') && !document.getElementById('clan-tower-screen').classList.contains('hidden')) updateClanTowerUI();
        }
    }
}

// ---- ИГРОКИ: публичный "срез" данных, безопасный для показа другим ----
// (уровень, серебро, кристаллы, время последнего входа — БЕЗ пароля).
// Именно эти данные видят другие игроки в списке участников клана.
let playerPushTimer = null;
function pushPlayerPublicToServer() {
    if (!supa || !activePlayer || !activePlayer.username) return;
    if (playerPushTimer) clearTimeout(playerPushTimer);
    playerPushTimer = setTimeout(() => {
        supa.from('players_public').upsert({
            username_lower: activePlayer.username.toLowerCase(),
            username: activePlayer.username,
            level: activePlayer.level || 1,
            silver: activePlayer.silver || 0,
            crystals: activePlayer.crystals || 0,
            clan_name: activePlayer.clanName || null,
            last_online: new Date().toISOString()
        }).then(({ error }) => { if (error) console.warn("Sync (player push) error:", error.message); });
    }, 3000);
}

// Подтягиваем публичные данные ВСЕХ игроков и подмешиваем их в локальный
// players (только "витринные" поля — level/silver/crystals/lastOnlineTime —
// НЕ трогаем локальный пароль/инвентарь чужих игроков, которых тут и нет).
async function pullPlayersPublicFromServer() {
    if (!supa) return;
    const { data, error } = await supa.from('players_public').select('*');
    if (error || !data) return;
    const localPlayers = ldbRead(LOCAL_DB_KEYS.players);
    data.forEach(row => {
        const key = row.username_lower;
        if (!localPlayers[key]) {
            // Игрок с другого устройства — заведём "витринную" запись без пароля,
            // чтобы его было видно в списке клана. Полноценно залогиниться под
            // ним с этого устройства всё равно нельзя (пароля тут нет).
            localPlayers[key] = { username: row.username, data: {} };
        }
        localPlayers[key].data.level = row.level;
        localPlayers[key].data.silver = row.silver;
        localPlayers[key].data.crystals = row.crystals;
        localPlayers[key].data.lastOnlineTime = new Date(row.last_online).getTime();
    });
    ldbWrite(LOCAL_DB_KEYS.players, localPlayers);
}

// ---- ЧАТ: отправка одного сообщения на сервер сразу после локальной отправки ----
function pushChatMessageToServer(msg) {
    if (!supa) return;
    supa.from('chat_messages').insert({
        username: msg.username,
        text: msg.text,
        gender: msg.gender,
        created_at: new Date(msg.created_at).toISOString()
    }).then(({ error }) => { if (error) console.warn("Sync (chat push) error:", error.message); });
}

// ---- ЧАТ: подтягиваем последние сообщения ОТ ВСЕХ игроков и сливаем с локальными ----
// Дедупликация — по паре (username + created_at): при отправке мы явно передаём на
// сервер тот же created_at, что записан локально, поэтому совпадающие метки времени
// означают "это то же самое сообщение", а не два разных.
async function pullChatMessagesFromServer() {
    if (!supa) return;
    const { data, error } = await supa.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (error || !data) return;
    const local = ldbReadArray(LOCAL_DB_KEYS.chat);
    const localKeys = new Set(local.map(m => `${m.username}|${m.created_at}`));
    data.forEach(row => {
        const created_at = new Date(row.created_at).getTime();
        const key = `${row.username}|${created_at}`;
        if (!localKeys.has(key)) {
            local.push({ username: row.username, text: row.text, gender: row.gender, created_at });
            localKeys.add(key);
        }
    });
    local.sort((a, b) => a.created_at - b.created_at);
    while (local.length > 200) local.shift();
    ldbWriteArray(LOCAL_DB_KEYS.chat, local);
}

// Фоновый цикл: пока страница открыта, регулярно подтягиваем чужие изменения
let syncPullInterval = null;
function startBackgroundSync() {
    if (!supa || syncPullInterval) return;
    syncPullInterval = setInterval(() => {
        pullClansFromServer();
        pullPlayersPublicFromServer();
    }, SYNC_PULL_INTERVAL_MS);
    // и сразу один раз при старте, не дожидаясь первого тика
    pullClansFromServer();
    pullPlayersPublicFromServer();
}

// =====================================================================
// ЛОКАЛЬНАЯ БАЗА ДАННЫХ (localStorage)
// Раньше здесь был Supabase (общий сервер). Теперь ВСЁ хранится только
// в этом браузере: игроки, кланы, чат, заявки в друзья. Между разными
// устройствами/браузерами данные не передаются и не синхронизируются —
// это полностью локальная игра.
// =====================================================================
const LOCAL_DB_KEYS = {
    players: 'chaos_local_players',       // { [usernameLower]: { id, username, password, data } }
    clans: 'chaos_local_clans',            // { [nameLower]: { name, owner, data } }
    chat: 'chaos_local_chat',              // [ { username, text, gender, created_at } ]
    friendships: 'chaos_local_friendships', // [ { id, requester, addressee, status, created_at } ]
    likes: 'chaos_local_likes'             // { [targetUsernameLower]: totalLikesCount }
};

function ldbRead(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (e) { return {}; }
}
function ldbWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function ldbReadArray(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
}
function ldbWriteArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// =====================================================================
// РЕЗЕРВНАЯ КОПИЯ СОХРАНЕНИЯ (экспорт/импорт файла)
// Так как игра полностью локальная (localStorage), очистка кэша браузера
// удаляет весь прогресс безвозвратно. Эти функции позволяют скачать все
// игровые данные этого браузера в один .json файл и восстановить их
// позже — в этом же браузере или в другом/новом после переустановки.
// =====================================================================
const BACKUP_KEYS = [
    'chaos_local_players',      // все персонажи, созданные в этом браузере
    'chaos_local_clans',        // все кланы
    'chaos_local_chat',         // сообщения беседки
    'chaos_local_friendships',  // заявки/списки друзей
    'rpg_chaos_boss',           // состояние мирового босса Бездны Хаоса
    'forum_ideas',              // идеи на форуме
    'chaos_local_likes'         // счётчики лайков профилей (популярность)
];

let backupReturnContext = 'guest';

function openBackupScreen() {
    if (typeof activePlayer !== 'undefined' && activePlayer && typeof saveData === 'function') saveData();
    backupReturnContext = (typeof activePlayer !== 'undefined' && activePlayer) ? 'game' : 'guest';
    ['main-screen', 'login-screen', 'register-screen', 'recovery-screen', 'game-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById('backup-screen').classList.remove('hidden');
    refreshBackupInfo();
    window.scrollTo(0, 0);
}

function closeBackupScreen() {
    document.getElementById('backup-screen').classList.add('hidden');
    if (backupReturnContext === 'game' && typeof activePlayer !== 'undefined' && activePlayer) {
        document.getElementById('game-container').classList.remove('hidden');
        openGameScreen('profile-settings-screen');
    } else {
        document.getElementById('main-screen').classList.remove('hidden');
    }
}

function refreshBackupInfo() {
    const infoBox = document.getElementById('backup-info-text');
    if (!infoBox) return;
    const players = ldbRead(LOCAL_DB_KEYS.players);
    const playerCount = Object.keys(players).length;
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    const clanCount = Object.keys(clans).length;
    const lastBackup = parseInt(localStorage.getItem('chaos_last_backup_reminder') || '0', 10);

    let lastBackupText = "ещё ни разу не делали резервную копию";
    if (lastBackup > 0) {
        const d = new Date(lastBackup);
        lastBackupText = "последняя копия: " + d.toLocaleDateString('ru-RU') + " " + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    infoBox.innerHTML = `В этом браузере сохранено: <b>${playerCount}</b> персонаж(ей), <b>${clanCount}</b> клан(ов).<br>${lastBackupText}.`;
}

function exportSave() {
    const backup = buildBackupPayload();

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `legenda-haosa-save-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem('chaos_last_backup_reminder', Date.now().toString());
    showBackupMessage("✅ Загрузка запущена. Если браузер показал странное имя файла (набор случайных символов) — это нормально для встроенных браузеров редакторов кода, файл всё равно скачался корректно. Для надёжности можно также воспользоваться копированием текста ниже.", true);
    refreshBackupInfo();
}

function triggerImportSave() {
    const input = document.getElementById('backup-import-input');
    if (input) input.click();
}

function importSaveFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        let parsed;
        try {
            parsed = JSON.parse(e.target.result);
        } catch (err) {
            showBackupMessage("❌ Не удалось прочитать файл — это не корректный файл сохранения.", false);
            event.target.value = '';
            return;
        }

        const hasAnyKey = parsed && typeof parsed === 'object' && BACKUP_KEYS.some(k => parsed[k] !== undefined);
        if (!hasAnyKey) {
            showBackupMessage("❌ В этом файле не найдено данных сохранения «Легенды Хаоса».", false);
            event.target.value = '';
            return;
        }

        const ok = confirm("Загрузка сохранения ЗАМЕНИТ всех персонажей, кланы и чат в этом браузере на данные из файла. Текущие локальные данные будут потеряны. Продолжить?");
        if (!ok) { event.target.value = ''; return; }

        BACKUP_KEYS.forEach(k => {
            if (parsed[k] !== undefined) localStorage.setItem(k, parsed[k]);
            else localStorage.removeItem(k);
        });

        showBackupMessage("✅ Сохранение восстановлено! Страница сейчас перезагрузится...", true);
        event.target.value = '';
        setTimeout(() => location.reload(), 1500);
    };
    reader.readAsText(file);
}

function showBackupMessage(text, isSuccess) {
    const box = document.getElementById('backup-msg');
    if (!box) return;
    box.innerText = text;
    box.style.color = isSuccess ? "#7CFC00" : "#ff6666";
    box.classList.remove('hidden');
}

// =====================================================================
// Резервный способ через текст/буфер обмена — на некоторых встроенных
// WebView-браузерах (например, предпросмотр в редакторах кода) скачивание
// файла через blob-ссылку работает некорректно: система показывает
// диалог загрузки со случайным именем файла вместо заданного, а иногда
// скачивание вовсе не завершается. Копирование текста работает надёжно
// в любом браузере, так как не зависит от системного загрузчика файлов.
// =====================================================================
function buildBackupPayload() {
    if (typeof activePlayer !== 'undefined' && activePlayer && typeof saveData === 'function') saveData();
    const backup = { __meta: { game: "Легенда Хаоса", exportedAt: new Date().toISOString(), version: 1 } };
    BACKUP_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) backup[k] = v;
    });
    return backup;
}

function exportSaveAsText() {
    const text = JSON.stringify(buildBackupPayload());
    const box = document.getElementById('backup-text-export-box');
    const area = document.getElementById('backup-text-export-area');
    if (area) area.value = text;
    if (box) box.classList.remove('hidden');

    localStorage.setItem('chaos_last_backup_reminder', Date.now().toString());
    refreshBackupInfo();
    copyBackupText();
}

function copyBackupText() {
    const area = document.getElementById('backup-text-export-area');
    if (!area || !area.value) return;

    area.classList.remove('hidden');
    const box = document.getElementById('backup-text-export-box');
    if (box) box.classList.remove('hidden');

    area.focus();
    area.select();
    try { area.setSelectionRange(0, area.value.length); } catch (e) { /* ignore */ }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(() => {
            showBackupMessage("✅ Текст сохранения скопирован в буфер обмена! Вставьте его в заметки, мессенджер себе и т.п. — это тоже полноценная резервная копия.", true);
        }).catch(() => {
            legacyCopyBackupText(area);
        });
    } else {
        legacyCopyBackupText(area);
    }
}

function legacyCopyBackupText(area) {
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    if (copied) {
        showBackupMessage("✅ Текст сохранения скопирован в буфер обмена! Вставьте его в заметки, мессенджер себе и т.п.", true);
    } else {
        showBackupMessage("Не удалось скопировать автоматически. Текст ниже выделен — скопируйте его вручную (долгое нажатие на поле → «Копировать»).", true);
    }
}

function toggleTextImport() {
    const box = document.getElementById('backup-text-import-box');
    if (box) box.classList.toggle('hidden');
}

function importSaveFromText() {
    const area = document.getElementById('backup-text-import-area');
    const raw = area ? area.value.trim() : "";
    if (!raw) { showBackupMessage("❌ Вставьте текст сохранения в поле перед восстановлением.", false); return; }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        showBackupMessage("❌ Не удалось прочитать текст — убедитесь, что скопирован весь текст целиком, без пропусков.", false);
        return;
    }

    const hasAnyKey = parsed && typeof parsed === 'object' && BACKUP_KEYS.some(k => parsed[k] !== undefined);
    if (!hasAnyKey) {
        showBackupMessage("❌ В этом тексте не найдено данных сохранения «Легенды Хаоса».", false);
        return;
    }

    const ok = confirm("Загрузка сохранения ЗАМЕНИТ всех персонажей, кланы и чат в этом браузере на данные из текста. Текущие локальные данные будут потеряны. Продолжить?");
    if (!ok) return;

    BACKUP_KEYS.forEach(k => {
        if (parsed[k] !== undefined) localStorage.setItem(k, parsed[k]);
        else localStorage.removeItem(k);
    });

    showBackupMessage("✅ Сохранение восстановлено! Страница сейчас перезагрузится...", true);
    setTimeout(() => location.reload(), 1500);
}

// Ненавязчивое напоминание на главном экране игры — если резервная копия
// давно не делалась (или не делалась никогда), предлагаем сделать её.
function checkBackupReminder() {
    const block = document.getElementById('backup-reminder-block');
    if (!block) return;
    const last = parseInt(localStorage.getItem('chaos_last_backup_reminder') || '0', 10);
    const dismissedAt = parseInt(localStorage.getItem('chaos_backup_dismiss') || '0', 10);
    const daysSinceDismiss = (Date.now() - dismissedAt) / 86400000;
    const daysSinceBackup = (Date.now() - last) / 86400000;

    const shouldShow = (last === 0 && daysSinceDismiss > 2) || (last > 0 && daysSinceBackup > 7 && daysSinceDismiss > 7);
    block.classList.toggle('hidden', !shouldShow);
}

function dismissBackupReminder() {
    localStorage.setItem('chaos_backup_dismiss', Date.now().toString());
    const block = document.getElementById('backup-reminder-block');
    if (block) block.classList.add('hidden');
}

// Флаг и целевой игрок для локального восстановления пароля
// (шаг 1: подтверждаем никнейм, шаг 2: сразу задаём новый пароль —
// вся игра локальная, реального сервера подтверждения нет).
let isPasswordRecoveryFlow = false;
let recoveryTargetUsername = null;

let activePlayer = null;

// =====================================================================
// КЛАНЫ — ЛОКАЛЬНОЕ ХРАНИЛИЩЕ (localStorage, ключ 'chaos_local_clans')
// Клан активного игрока кэшируется в activeClan, чтобы бой/шахта/алтари
// могли синхронно читать его статы. После любого изменения вызываем
// saveActiveClan() — она сохраняет весь объект клана в localStorage.
// =====================================================================
let activeClan = null;

function loadActiveClan() {
    if (!activePlayer || !activePlayer.clanName) { activeClan = null; return; }
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    const row = clans[activePlayer.clanName.toLowerCase()];
    activeClan = row ? row.data : null;
}

function saveActiveClan() {
    if (!activeClan || !activeClan.name) return;
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    clans[activeClan.name.toLowerCase()] = { name: activeClan.name, owner: activeClan.owner, data: activeClan, updated_at: Date.now() };
    ldbWrite(LOCAL_DB_KEYS.clans, clans);
    pushClanToServer(activeClan); // онлайн-синхронизация (см. блок в начале файла)
}
let currentAuthUserId = null; // локальный id игрока, привязан к activePlayer
let currentBattleType = "adventure"; 

// Переменные для кузницы (чтобы calculateStats не вызывал ошибку)
let forgeAttack = 0;
let forgeDefense = 0;

// =====================================================================
// КАЧЕСТВА ПРОКАЧКИ ЭКИПИРОВКИ
// Каждые 10 уровней снаряжение переходит на следующее качество.
// Божественное — финальное качество, уровни в нём растут без предела.
// =====================================================================
// Качество экипировки привязано к УРОВНЮ ПРОКАЧКИ ПРЕДМЕТА, т.е. к количеству
// раз, сколько конкретный меч/броня/щит был улучшен ("Улучшений: N" в интерфейсе).
// 0-50 улучшений — Обычное, 50-200 — Редкое, 200-400 — Мифическое,
// 400-700 — Легендарное, 700+ — Божественное.
const EQUIPMENT_QUALITIES = [
    { name: "Обычное",      color: "#9d9d9d", bonusMult: 1,   priceMult: 1,  minCount: 0   },
    { name: "Редкое",       color: "#4da6ff", bonusMult: 1.5, priceMult: 3,  minCount: 50  },
    { name: "Мифическое",   color: "#b366ff", bonusMult: 2.2, priceMult: 8,  minCount: 200 },
    { name: "Легендарное",  color: "#ff4d4d", bonusMult: 3.2, priceMult: 20, minCount: 400 },
    { name: "Божественное", color: "#ffd700", bonusMult: 4.5, priceMult: 50, minCount: 700 }
];

// Возвращает индекс тира качества по числу улучшений предмета
function getQualityTierIndexByCount(trainingCount) {
    let idx = 0;
    for (let i = 0; i < EQUIPMENT_QUALITIES.length; i++) {
        if (trainingCount >= EQUIPMENT_QUALITIES[i].minCount) idx = i;
    }
    return idx;
}

// Возвращает данные о текущем качестве снаряжения по числу улучшений предмета
function getEquipmentQuality(trainingCount) {
    const idx = getQualityTierIndexByCount(trainingCount);
    const isMaxTier = idx === EQUIPMENT_QUALITIES.length - 1;
    const nextTier = EQUIPMENT_QUALITIES[idx + 1];
    return {
        ...EQUIPMENT_QUALITIES[idx],
        index: idx,
        levelInTier: trainingCount,
        levelLabel: isMaxTier
            ? `Улучшений: ${trainingCount} (макс. качество)`
            : `Улучшений: ${trainingCount} (след. качество при ${nextTier.minCount})`
    };
}

// =========================================================================
// СИСТЕМА ЛУТА ИЗ ПОДЗЕМЕЛИЙ: экипировка выпадает с боссов подземелий
// в 5 качествах (Обычное → Божественное). Чем выше качество, тем реже
// оно выпадает (dropWeight) и тем сильнее бонус к характеристикам (statMult)
// и цена продажи (sellBase). Это ОТДЕЛЬНАЯ система от "Тренировки"
// (меч/броня/щит там прокачиваются вручную) — тут вещи просто выпадают.
// =========================================================================
const LOOT_QUALITIES = [
    { name: "Обычное",      color: "#9d9d9d", dropWeight: 58,  statMult: 1,    sellBase: 30    },
    { name: "Редкое",       color: "#3d9dff", dropWeight: 28,  statMult: 1.8,  sellBase: 150   },
    { name: "Мифическое",   color: "#b366ff", dropWeight: 10,  statMult: 3.2,  sellBase: 600   },
    { name: "Легендарное",  color: "#ff8c1a", dropWeight: 3.5, statMult: 6,    sellBase: 3000   },
    { name: "Божественное", color: "#ffd700", dropWeight: 0.5, statMult: 12,   sellBase: 15000  }
];

// Шанс, что с побеждённого босса подземелья выпадет предмет экипировки
const DUNGEON_LOOT_DROP_CHANCE = 0.35;

// Максимальный размер рюкзака (в предметах)
const BACKPACK_MAX_SIZE = 100;

// 7 слотов экипировки. Картинки уже добавлены в папку проекта.
const EQUIPMENT_SLOTS = {
    helmet: { label: "Шлем",   img: "ako.png",  stat: "defense" },
    ring:   { label: "Кольцо", img: "ako1.png", stat: "attack"  },
    cloak:  { label: "Плащ",   img: "ako2.png", stat: "hp"      },
    armor:  { label: "Броня",  img: "ako3.png", stat: "hp"      },
    boots:  { label: "Сапоги", img: "ako4.png", stat: "defense" },
    shield: { label: "Щит",    img: "ako5.png", stat: "defense" },
    sword:  { label: "Меч",    img: "ako6.png", stat: "attack"  }
};

// Названия предметов по слоту и качеству (индекс = качество, 0..4)
const GEAR_NAMES = {
    helmet: ["Кожаный Капюшон",  "Шлем Стража",     "Шлем Провидца",  "Корона Погибели",  "Венец Вознесения"],
    ring:   ["Медное Кольцо",    "Кольцо Дракона",  "Кольцо Теней",   "Перстень Судьбы",  "Кольцо Вечности"],
    cloak:  ["Рваный Плащ",      "Плащ Странника",  "Мантия Теней",   "Плащ Бессмертного","Плащ Хаоса"],
    armor:  ["Кожаная Броня",    "Кольчуга Стража", "Броня Разрушителя","Латы Титана",     "Броня Вознесённого"],
    boots:  ["Дырявые Сапоги",   "Сапоги Скорохода","Сапоги Тени",    "Сапоги Бури",       "Сапоги Вечного Пути"],
    shield: ["Деревянный Щит",   "Щит Стража",      "Щит Хранителя",  "Эгида Титана",      "Щит Абсолюта"],
    sword:  ["Ржавый Меч",       "Клинок Наёмника", "Клинок Теней",   "Меч Разрушения",    "Меч Рыцаря"]
};

// Выбор качества выпавшего предмета по весам (чем выше качество, тем меньше вес)
function rollLootQuality() {
    const total = LOOT_QUALITIES.reduce((s, q) => s + q.dropWeight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < LOOT_QUALITIES.length; i++) {
        if (r < LOOT_QUALITIES[i].dropWeight) return i;
        r -= LOOT_QUALITIES[i].dropWeight;
    }
    return 0;
}

// Сила бонуса предмета зависит от слота (тип характеристики), качества и
// текущего уровня игрока на момент выпадения (фиксируется в предмете навсегда)
function calcGearStatValue(slot, qIdx) {
    const q = LOOT_QUALITIES[qIdx];
    const slotDef = EQUIPMENT_SLOTS[slot];
    const lvl = (activePlayer && activePlayer.level) ? activePlayer.level : 1;
    let base;
    if (slotDef.stat === 'attack') base = lvl * 150;
    else if (slotDef.stat === 'defense') base = lvl * 80;
    else base = lvl * 400; // hp
    return Math.max(1, Math.floor(base * q.statMult));
}

// Генерирует случайный предмет экипировки (случайный слот из 7 + случайное качество)
function generateLootItem() {
    const slots = Object.keys(EQUIPMENT_SLOTS);
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const qIdx = rollLootQuality();
    return {
        id: 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        slot: slot,
        quality: qIdx,
        name: GEAR_NAMES[slot][qIdx],
        statValue: calcGearStatValue(slot, qIdx),
        enchant: 0 // уровень заточки (0-100), см. ENCHANT_MAX_LEVEL ниже
    };
}

// =====================================================================
// ЗАТОЧКА ЭКИПИРОВКИ ЗА КРИСТАЛЛЫ
// У каждого предмета есть отдельный уровень заточки 0-100 (не путать с
// качеством!). Заточка не меняет имя/качество предмета, а просто добавляет
// небольшой процент к его характеристике — по 1% за уровень, до +100% на
// 100 уровне. Стоимость следующего уровня растёт квадратично и вместе с
// уровнем персонажа, чтобы кристаллы оставались значимым расходом и на
// поздней игре.
const ENCHANT_MAX_LEVEL = 100;
const ENCHANT_PERCENT_PER_LEVEL = 0.01; // +1% к статy за уровень заточки

function enchantCost(nextLevel, playerLevel) {
    // РЕБАЛАНС: база выросла (28/7 вместо 20/5), и множитель за уровень персонажа
    // увеличен (0.04 вместо 0.03) — заточка каждой вещи ощутимо кусается по кристаллам,
    // особенно на высоких уровнях, так что приходится выбирать, что качать в первую очередь.
    const base = 28 * nextLevel + 7 * nextLevel * nextLevel;
    return Math.floor(base * (1 + (playerLevel || 1) * 0.04));
}

// Итоговое значение бонуса предмета с учётом заточки (базовое значение не меняется)
function getEffectiveGearStatValue(item) {
    const enchant = item.enchant || 0;
    return Math.floor(item.statValue * (1 + enchant * ENCHANT_PERCENT_PER_LEVEL));
}

// location: 'equipped' (key = слот) или 'backpack' (key = id предмета)
function enchantGearItem(location, key) {
    if (!activePlayer) return;
    const item = location === 'equipped'
        ? (activePlayer.gear && activePlayer.gear[key])
        : (activePlayer.backpack || []).find(it => it.id === key);
    if (!item) return;

    const currentLevel = item.enchant || 0;
    if (currentLevel >= ENCHANT_MAX_LEVEL) {
        showTopToast("⭐ Предмет уже заточен до максимума (+100)!", true);
        return;
    }

    const nextLevel = currentLevel + 1;
    const cost = enchantCost(nextLevel, activePlayer.level);
    if ((activePlayer.crystals || 0) < cost) {
        showTopToast(`❌ Недостаточно кристаллов! Нужно ${formatNum(cost)} 💎`, true);
        return;
    }

    activePlayer.crystals -= cost;
    item.enchant = nextLevel;

    calculateStats();
    saveData(); updateGameUI();
    if (location === 'equipped') { renderEquipmentScreen(); renderProfileGear(); } else { renderBackpackScreen(); }
    showTopToast(`🔨 Предмет заточен до <b>+${nextLevel}</b>!`);
}

// Надеть предмет: старый предмет этого слота (если был) уходит в рюкзак.
// Возвращает false и ничего не меняет, если для старого предмета не хватает места в рюкзаке.
function equipGearItem(item) {
    if (!activePlayer.gear) activePlayer.gear = {};
    if (!activePlayer.backpack) activePlayer.backpack = [];
    const old = activePlayer.gear[item.slot];
    if (old && activePlayer.backpack.length >= BACKPACK_MAX_SIZE) {
        showGameAlert(`🎒 Рюкзак полон (${BACKPACK_MAX_SIZE}/${BACKPACK_MAX_SIZE})! Продайте или наденьте что-то из рюкзака, чтобы освободить место для старого предмета.`);
        return false;
    }
    activePlayer.gear[item.slot] = item;
    if (old) activePlayer.backpack.push(old);
    calculateStats(); // calculateStats() сам вызывает saveData() и updateGameUI()
    return true;
}

// Снять предмет со слота обратно в рюкзак
function unequipToBackpack(slot) {
    if (!activePlayer.gear || !activePlayer.gear[slot]) return;
    if (!activePlayer.backpack) activePlayer.backpack = [];
    if (activePlayer.backpack.length >= BACKPACK_MAX_SIZE) {
        showGameAlert(`🎒 Рюкзак полон (${BACKPACK_MAX_SIZE}/${BACKPACK_MAX_SIZE})! Продайте что-нибудь, чтобы освободить место.`);
        return;
    }
    const item = activePlayer.gear[slot];
    activePlayer.gear[slot] = null;
    activePlayer.backpack.push(item);
    calculateStats();
    renderEquipmentScreen();
}

// Надеть предмет прямо из рюкзака
function equipFromBackpack(itemId) {
    if (!activePlayer.backpack) return;
    const idx = activePlayer.backpack.findIndex(it => it.id === itemId);
    if (idx === -1) return;
    const item = activePlayer.backpack[idx];
    activePlayer.backpack.splice(idx, 1);
    equipGearItem(item);
    renderBackpackScreen();
}

// Продать предмет из рюкзака за серебро (цена зависит от качества)
function sellBackpackItem(itemId) {
    if (!activePlayer.backpack) return;
    const idx = activePlayer.backpack.findIndex(it => it.id === itemId);
    if (idx === -1) return;
    const item = activePlayer.backpack[idx];
    const price = LOOT_QUALITIES[item.quality].sellBase;
    activePlayer.backpack.splice(idx, 1);
    activePlayer.silver += price;
    saveData(); updateGameUI(); renderBackpackScreen();
    showGameAlert(`Продано: <span class="gear-name-${item.quality}">${item.name}</span> за ${formatNum(price)} 🪙`);
}

// Хранит предмет, ожидающий решения игрока (Надеть / В рюкзак) в модалке лута
let activeLootDrop = null;

function statLabelFor(slot) {
    const stat = EQUIPMENT_SLOTS[slot].stat;
    return stat === 'attack' ? 'Атака' : (stat === 'defense' ? 'Защита' : 'HP');
}

// Сравнивает качество предмета с тем, что сейчас надето в этом слоте.
// Возвращает "+" (лучше), "-" (хуже) или "=" (так же), либо "" если слот пуст.
function lootQualityBadge(item) {
    const equipped = activePlayer.gear ? activePlayer.gear[item.slot] : null;
    if (!equipped) return { symbol: "", text: "Слот пуст — есть что надеть!", cls: "loot-better" };
    if (item.quality > equipped.quality) {
        return { symbol: "+", text: `Лучше надетого (${LOOT_QUALITIES[equipped.quality].name})`, cls: "loot-better" };
    }
    if (item.quality < equipped.quality) {
        return { symbol: "-", text: `Хуже надетого (${LOOT_QUALITIES[equipped.quality].name})`, cls: "loot-worse" };
    }
    return { symbol: "=", text: "Такое же качество, как надето", cls: "loot-equal" };
}

function showLootDropModal(item) {
    activeLootDrop = item;
    const slotDef = EQUIPMENT_SLOTS[item.slot];
    const q = LOOT_QUALITIES[item.quality];
    document.getElementById('loot-drop-icon').src = slotDef.img;
    document.getElementById('loot-drop-name').innerHTML = `<span class="gear-name-${item.quality}">${item.name}</span>`;
    document.getElementById('loot-drop-slot').innerText = `${slotDef.label} · ${q.name}`;
    document.getElementById('loot-drop-stat').innerText = `+${formatNum(item.statValue)} к ${statLabelFor(item.slot)}`;
    const badge = lootQualityBadge(item);
    const compareEl = document.getElementById('loot-drop-compare');
    compareEl.className = badge.cls;
    compareEl.innerText = badge.symbol ? `${badge.symbol} ${badge.text}` : badge.text;
    document.getElementById('loot-drop-modal').classList.remove('hidden');
}
function equipLootItemFromDrop() {
    if (!activeLootDrop) return;
    if (!equipGearItem(activeLootDrop)) return; // рюкзак полон — модалка остаётся открытой
    activeLootDrop = null;
    document.getElementById('loot-drop-modal').classList.add('hidden');
}
function stashLootItemFromDrop() {
    if (!activeLootDrop) return;
    if (!activePlayer.backpack) activePlayer.backpack = [];
    if (activePlayer.backpack.length >= BACKPACK_MAX_SIZE) {
        showGameAlert(`🎒 Рюкзак полон (${BACKPACK_MAX_SIZE}/${BACKPACK_MAX_SIZE})! Продайте что-нибудь, чтобы освободить место.`);
        return;
    }
    activePlayer.backpack.push(activeLootDrop);
    saveData();
    activeLootDrop = null;
    document.getElementById('loot-drop-modal').classList.add('hidden');
}

// Экран "Экипировка" — 7 слотов с тем, что сейчас надето
function openEquipmentScreen() {
    renderEquipmentScreen();
    openGameScreen('equipment-screen');
}
function renderEquipmentScreen() {
    if (!activePlayer.gear) activePlayer.gear = {};
    const balanceEl = document.getElementById('equipment-crystals-balance');
    if (balanceEl) balanceEl.innerText = formatNum(activePlayer.crystals || 0);
    const container = document.getElementById('equipment-list-container');
    container.innerHTML = "";
    Object.keys(EQUIPMENT_SLOTS).forEach(slotKey => {
        const slotDef = EQUIPMENT_SLOTS[slotKey];
        const item = activePlayer.gear[slotKey];
        if (item) {
            const q = LOOT_QUALITIES[item.quality];
            const enchLvl = item.enchant || 0;
            const enchTag = enchLvl > 0 ? ` <span style="color:#7ec8ff; font-weight:bold;">+${enchLvl}</span>` : "";
            const isMaxEnch = enchLvl >= ENCHANT_MAX_LEVEL;
            const enchantBtn = isMaxEnch
                ? `<button class="btn-enter-dungeon" disabled style="background:#2c2c2c; color:#6a6a6a;">⭐ Макс. заточка</button>`
                : `<button class="btn-enter-dungeon" style="background:#1a2633; border-color:#2f4a63; color:#7ec8ff;" onclick="enchantGearItem('equipped', '${slotKey}')">🔨 +${enchLvl + 1} — ${formatNum(enchantCost(enchLvl + 1, activePlayer.level))} 💎</button>`;
            container.innerHTML += `<div class="forge-item">
                <img src="${slotDef.img}" class="item-icon gear-q-${item.quality}">
                <div class="item-info">
                    <div class="item-name-row gear-name-${item.quality}">${item.name}${enchTag}</div>
                    <div class="item-quality">${slotDef.label} · ${q.name} · +${formatNum(getEffectiveGearStatValue(item))} ${statLabelFor(slotKey)}</div>
                </div>
                <div class="gear-row-actions">
                    <button class="btn-enter-dungeon" style="background:#333; color:#ddd;" onclick="unequipToBackpack('${slotKey}')">Снять</button>
                    ${enchantBtn}
                </div>
            </div>`;
        } else {
            container.innerHTML += `<div class="forge-item" style="opacity:0.55;">
                <img src="${slotDef.img}" class="item-icon">
                <div class="item-info">
                    <div class="item-name-row">Пусто</div>
                    <div class="item-quality">${slotDef.label} · нет предмета</div>
                </div>
            </div>`;
        }
    });
}

// Экран "Рюкзак" — весь невыетый лут, с возможностью надеть или продать
function openBackpackScreen() {
    renderBackpackScreen();
    openGameScreen('backpack-screen');
}
function renderBackpackScreen() {
    if (!activePlayer.backpack) activePlayer.backpack = [];
    const balanceEl = document.getElementById('backpack-crystals-balance');
    if (balanceEl) balanceEl.innerText = formatNum(activePlayer.crystals || 0);
    const container = document.getElementById('backpack-list-container');
    const emptyText = document.getElementById('backpack-empty-text');
    const countEl = document.getElementById('backpack-count');
    if (countEl) countEl.innerText = `(${activePlayer.backpack.length}/${BACKPACK_MAX_SIZE})`;
    container.innerHTML = "";
    if (activePlayer.backpack.length === 0) {
        emptyText.classList.remove('hidden');
        return;
    }
    emptyText.classList.add('hidden');
    activePlayer.backpack.forEach(item => {
        const slotDef = EQUIPMENT_SLOTS[item.slot];
        const q = LOOT_QUALITIES[item.quality];
        const badge = lootQualityBadge(item);
        const badgeHtml = badge.symbol ? `<span class="${badge.cls}" title="${badge.text}">${badge.symbol}</span> ` : "";
        const enchLvl = item.enchant || 0;
        const enchTag = enchLvl > 0 ? ` <span style="color:#7ec8ff; font-weight:bold;">+${enchLvl}</span>` : "";
        container.innerHTML += `<div class="forge-item">
            <img src="${slotDef.img}" class="item-icon gear-q-${item.quality}">
            <div class="item-info">
                <div class="item-name-row gear-name-${item.quality}">${badgeHtml}${item.name}${enchTag}</div>
                <div class="item-quality">${slotDef.label} · ${q.name} · +${formatNum(getEffectiveGearStatValue(item))} ${statLabelFor(item.slot)}</div>
            </div>
            <div class="gear-row-actions">
                <button class="btn-enter-dungeon" onclick="equipFromBackpack('${item.id}')">Надеть</button>
                <button class="btn-enter-dungeon" style="background:#5c1111; color:#fff;" onclick="sellBackpackItem('${item.id}')">${formatNum(q.sellBase)} 🪙</button>
            </div>
        </div>`;
    });
}

// Отрисовка экипировки слева/справа от аватара на экране Профиля (3 слева, 3 справа,
// кольцо — отдельным слотом прямо под аватаром)
function gearSlotHtml(slotKey) {
    const slotDef = EQUIPMENT_SLOTS[slotKey];
    const item = activePlayer.gear ? activePlayer.gear[slotKey] : null;
    if (item) {
        const enchSuffix = item.enchant > 0 ? ` +${item.enchant}` : "";
        return `<div class="profile-gear-slot gear-q-${item.quality}" title="${item.name}${enchSuffix} (${LOOT_QUALITIES[item.quality].name})"><img src="${slotDef.img}"></div>`;
    }
    return `<div class="profile-gear-slot empty" title="${slotDef.label}: пусто"><img src="${slotDef.img}"></div>`;
}
function renderProfileGear() {
    if (!activePlayer.gear) activePlayer.gear = {};
    const leftSlots = ['helmet', 'armor', 'boots'];
    const rightSlots = ['shield', 'sword', 'cloak'];
    document.getElementById('profile-gear-left').innerHTML = leftSlots.map(gearSlotHtml).join('');
    document.getElementById('profile-gear-right').innerHTML = rightSlots.map(gearSlotHtml).join('');
    document.getElementById('profile-gear-ring').innerHTML = gearSlotHtml('ring');
}

// КАЖДЫЙ МОНСТР ПРИВЯЗАН К СВОЕЙ ЛОКАЦИИ. Игрок проходит локации по очереди:
// побеждает монстра — открывается следующая локация. Редкость локации (rarity/rClass)
// определяет её "статус" в списке локаций, а reqLvl — рекомендованный уровень персонажа.
// Поле lore — короткая сюжетная подпись локации, которая раскрывает историю мира Хаоса
// по мере продвижения игрока: от приграничного леса до сердца Хаоса.
const monsterDatabase = [
    { name: "Волк", locName: "Тёмный Лес", rarity: "Обычная", rClass: "q-common", reqLvl: 1,  hp: 200, maxHp: 200, attack: 12, image: "wolf.jpg", exp: 15, silver: 5, icon: "🐺",
      lore: "Мир Хаоса погружается во тьму. Ты — безымянный воин, уцелевший в разорённой деревне на границе леса. В чаще воют волки — первые тени зла, что просачивается из глубин." },
    { name: "Скелет", locName: "Заброшенное Кладбище", rarity: "Обычная", rClass: "q-common", reqLvl: 3,  hp: 260, maxHp: 260, attack: 16, image: "skelet.jpg", exp: 20, silver: 8, icon: "💀",
      lore: "За лесом — старое кладбище. Мёртвые не находят покоя: кто-то поднимает их из земли своей волей." },
    { name: "Виверна", locName: "Скалистое Ущелье", rarity: "Обычная", rClass: "q-common", reqLvl: 6,  hp: 310, maxHp: 310, attack: 19, image: "viverna.jpg", exp: 25, silver: 10, icon: "🐉",
      lore: "Дальше путь лежит через узкое ущелье, где свили гнёзда дикие виверны." },
    { name: "Химера", locName: "Логово Химеры", rarity: "Редкая", rClass: "q-rare", reqLvl: 9,  hp: 380, maxHp: 380, attack: 24, image: "himera.jpg", exp: 35, silver: 15, icon: "🦁",
      lore: "Слухи о чудовище, разоряющем караваны у горного перевала, оказались правдой — это логово Химеры." },
    { name: "Некромант", locName: "Проклятая Крипта", rarity: "Редкая", rClass: "q-rare", reqLvl: 12, hp: 350, maxHp: 350, attack: 22, image: "nekromant.jpg", exp: 30, silver: 12, icon: "🔮",
      lore: "В крипте под ущельем ты находишь того, кто поднимал мертвецов с кладбища — некроманта, служащего Хаосу." },
    { name: "Рыцарь", locName: "Осаждённая Крепость", rarity: "Редкая", rClass: "q-rare", reqLvl: 15, hp: 550, maxHp: 550, attack: 35, image: "knight.jpg", exp: 60, silver: 25, icon: "⚔️",
      lore: "Некогда неприступная крепость пала под натиском тьмы. Рыцарь, что её защищал, теперь сам служит новому хозяину." },
    { name: "Голем", locName: "Каменный Карьер", rarity: "Редкая", rClass: "q-rare", reqLvl: 18, hp: 800, maxHp: 800, attack: 48, image: "golem.jpg", exp: 90, silver: 40, icon: "🪨",
      lore: "В карьере за крепостью оживший голем, созданный когда-то для охраны шахт, крушит всё на своём пути." },
    { name: "Оборотень", locName: "Лунная Поляна", rarity: "Эпическая", rClass: "q-epic", reqLvl: 21, hp: 1100, maxHp: 1100, attack: 65, image: "werewolf.jpg", exp: 130, silver: 65, icon: "🐺",
      lore: "Ты пересекаешь границу обычных земель. На Лунной Поляне под полной луной пробуждается Оборотень — страж Эпических земель." },
    { name: "Берсерк", locName: "Поле Забытых Битв", rarity: "Эпическая", rClass: "q-epic", reqLvl: 23, hp: 1500, maxHp: 1500, attack: 85, image: "berserk.jpg", exp: 180, silver: 90, icon: "🪓",
      lore: "Здесь столетия назад пал целый легион. Единственный, кто всё ещё сражается среди костей — обезумевший Берсерк." },
    { name: "Черный Воин", locName: "Чёрная Цитадель", rarity: "Эпическая", rClass: "q-epic", reqLvl: 24, hp: 2000, maxHp: 2000, attack: 110, image: "bigdark.jpg", exp: 240, silver: 130, icon: "🛡️",
      lore: "Чёрная Цитадель — последний оплот перед неизведанным. Её страж не пропускает никого, кто не доказал свою силу." },
    { name: "Дракон", locName: "Драконьи Пики", rarity: "Мифическая", rClass: "q-mythic", reqLvl: 25, hp: 2800, maxHp: 2800, attack: 140, image: "drakon.jpg", exp: 320, silver: 180, icon: "🐉",
      lore: "Ты достиг Мифических земель. Древний Дракон впервые за века поднялся из логова — в одиночку с такой силой лучше не тягаться..." },
    { name: "Друид", locName: "Изначальная Роща", rarity: "Мифическая", rClass: "q-mythic", reqLvl: 28, hp: 3800, maxHp: 3800, attack: 180, image: "dryid.jpg", exp: 420, silver: 240, icon: "🌿",
      lore: "В сердце рощи Друид хранит тайну — источник, откуда началось само пришествие Хаоса." },
    { name: "Кентавр", locName: "Бескрайние Степи", rarity: "Легендарная", rClass: "q-legend", reqLvl: 32, hp: 5000, maxHp: 5000, attack: 230, image: "centaur.jpg", exp: 550, silver: 320, icon: "🏹",
      lore: "Легендарные земли открываются бескрайними степями. Кентавры-кочевники испытывают силу каждого чужака." },
    { name: "Ведьма", locName: "Ведьмин Лес", rarity: "Легендарная", rClass: "q-legend", reqLvl: 36, hp: 6500, maxHp: 6500, attack: 290, image: "witch.jpg", exp: 700, silver: 420, icon: "🧹",
      lore: "Ведьма плетёт заклинания, удерживающие Легендарные земли в вечном сумраке." },
    { name: "Ниндзя", locName: "Скрытая Деревня", rarity: "Божественная", rClass: "q-divine", reqLvl: 40, hp: 8500, maxHp: 8500, attack: 360, image: "ninja.jpg", exp: 900, silver: 550, icon: "🥷",
      lore: "Божественные земли скрыты от смертных глаз. Ниндзя охраняет вход, испытывая лишь достойных." },
    { name: "Тролль", locName: "Мост Забытых Троллей", rarity: "Божественная", rClass: "q-divine", reqLvl: 45, hp: 11000, maxHp: 11000, attack: 450, image: "troll.jpg", exp: 1150, silver: 700, icon: "👹",
      lore: "Последний рубеж перед сердцем Хаоса. Тролль стоит на мосту, за которым, если верить легендам, обитает сам источник тьмы." },
];

// Пролог, который видит игрок перед самым первым боем в игре.
const STORY_PROLOGUE = "🌑 <b>Мир Хаоса.</b><br><br>Когда-то эти земли процветали. Но однажды пришла Тьма — и вместе с ней чудовища, безумие и разрушение.<br><br>Ты очнулся на пепелище родной деревни, не помня почти ничего, кроме одного: если никто не остановит Хаос, скоро не останется даже пепла.<br><br>Твой путь начинается здесь — в Тёмном Лесу.";

// На каком индексе локации (Дракон / Драконьи Пики, первая Мифическая) при первом
// прохождении игроку предлагается вступить в клан или создать свой.
const CLAN_INVITE_LOCATION_INDEX = 10;
// Минимальный уровень персонажа для входа на Арену Хаоса.
const ARENA_REQ_LEVEL = 5;

const dungeonDatabase = [
    { name: "Огр", hp: 2500, maxHp: 2500, attack: 90, image: "ogrik.jpg", exp: 350, silver: 500, icon: "👹", reqLvl: 5, qText: "Обычное подземелье", qClass: "q-common" },
    { name: "Великан", hp: 15000, maxHp: 15000, attack: 350, image: "velikan.jpg", exp: 2500, silver: 4000, icon: "🗿", reqLvl: 15, qText: "Мифическое подземелье", qClass: "q-mythic" },
    { name: "Ледяной Титан", hp: 35000, maxHp: 35000, attack: 680, image: "ledtitan.jpg", exp: 3000, silver: 12000, icon: "❄️", reqLvl: 20, qText: "Легендарное подземелье", qClass: "q-legend" },
    { name: "Паладин", hp: 80000, maxHp: 80000, attack: 1400, image: "paladin.jpg", exp: 5000, silver: 15000, icon: "🛡️", reqLvl: 25, qText: "Божественное подземелье", qClass: "q-divine" },
    { name: "Лорд", hp: 200000, maxHp: 200000, attack: 3000, image: "lord.jpg", exp: 7500, silver: 20000, icon: "👑", reqLvl: 30, qText: "Древнее подземелье", qClass: "q-ancient" },
    { name: "Огненный Элементаль", hp: 450000, maxHp: 450000, attack: 7000, image: "oges.jpg", exp: 10000, silver: 25000, icon: "🔥", reqLvl: 35, qText: "Эпическое подземелье", qClass: "q-epic" },
    { name: "Минотавр", hp: 700000, maxHp: 700000, attack: 10000, image: "minotavr.jpg", exp: 12500, silver: 50000, icon: "🐂", reqLvl: 45, qText: "Героическое подземелье", qClass: "q-heroic" },
    { name: "Грифон", hp: 1200000, maxHp: 1200000, attack: 18000, image: "grifon.jpg", exp: 15000, silver: 75000, icon: "🦅", reqLvl: 48, qText: "Мистическое подземелье", qClass: "q-mythic" },
    { name: "Чёрный Дракон", hp: 2500000, maxHp: 2500000, attack: 35000, image: "blackdrakon.jpg", exp: 17500, silver: 10000, icon: "🐉", reqLvl: 50, qText: "Темное подземелье", qClass: "q-dark" },
    { name: "Графиня Тьмы", hp: 10000000, maxHp: 10000000, attack: 150000, image: "grafina.jpg", exp: 20000, silver: 125000, icon: "🧛", reqLvl: 56, qText: "Запретное подземелье", qClass: "q-dark" },
    { name: "Теризла", hp: 20000000, maxHp: 20000000, attack: 300000, image: "terik.jpg", exp: 22500, silver: 130000, icon: "😈", reqLvl: 60, qText: "Хаотичное подземелье", qClass: "q-chaotic" },
    { name: "Король Мёртвых", hp: 50000000, maxHp: 50000000, attack: 500000, image: "king_dead.jpg", exp: 25000, silver: 150000, icon: "👑", reqLvl: 100, qText: "Демоническое подземелье", qClass: "q-black" },
    { name: "Повелитель Пустоты", hp: 150000000, maxHp: 150000000, attack: 900000, image: "void_lord.jpg", exp: 30000, silver: 200000, icon: "🌌", reqLvl: 120, qText: "Астральный разлом", qClass: "q-dark" },
    { name: "Титан Стихий", hp: 300000000, maxHp: 300000000, attack: 1500000, image: "elemental_titan.jpg", exp: 35000, silver: 250000, icon: "🌀", reqLvl: 140, qText: "Пик Стихий", qClass: "q-epic" },
    { name: "Хранитель Бездны", hp: 700000000, maxHp: 700000000, attack: 3000000, image: "abyss_guardian.jpg", exp: 40000, silver: 300000, icon: "💀", reqLvl: 160, qText: "Сердце Бездны", qClass: "q-black" },
    { name: "Диабло", hp: 1500000000, maxHp: 1500000000, attack: 5000000, image: "dia.jpg", exp: 50000, silver: 400000, icon: "👹", reqLvl: 180, qText: "Пылающий Ад", qClass: "q-epic" },
    { name: "Владыка Преисподней", hp: 3000000000, maxHp: 3000000000, attack: 8000000, image: "dia1.jpg", exp: 65000, silver: 550000, icon: "🔥", reqLvl: 200, qText: "Сердце Преисподней", qClass: "q-dark" },
    { name: "Архангел", hp: 6500000000, maxHp: 6500000000, attack: 12000000, image: "dia2.jpg", exp: 80000, silver: 750000, icon: "👿", reqLvl: 220, qText: "Гробница Падших", qClass: "q-black" },
    { name: "Принц Лжи", hp: 12000000000, maxHp: 12000000000, attack: 18000000, image: "dia3.jpg", exp: 100000, silver: 1000000, icon: "👁️", reqLvl: 240, qText: "Искаженная Реальность", qClass: "q-chaotic" },
    { name: "Первородное Зло", hp: 25000000000, maxHp: 25000000000, attack: 30000000, image: "dia4.jpg", exp: 130000, silver: 150000, icon: "🌋", reqLvl: 260, qText: "Исток Тьмы", qClass: "q-ancient" },
    { name: "Вестник Апокалипсиса", hp: 50000000000, maxHp: 50000000000, attack: 45000000, image: "via.jpg", exp: 170000, silver: 2200000, icon: "☄️", reqLvl: 280, qText: "Угасающий Мир", qClass: "q-dark" },
    { name: "Небесный Жнец", hp: 100000000000, maxHp: 100000000000, attack: 70000000, image: "via1.jpg", exp: 220000, silver: 3000000, icon: "⚔️", reqLvl: 300, qText: "Небесный Предел", qClass: "q-divine" },
    { name: "Император Пустоты", hp: 220000000000, maxHp: 220000000000, attack: 110000000, image: "via2.jpg", exp: 280000, silver: 4000000, icon: "🔮", reqLvl: 320, qText: "Глубины Разлома", qClass: "q-black" },
    { name: "Звездный Пожиратель", hp: 450000000000, maxHp: 450000000000, attack: 180000000, image: "via3.jpg", exp: 350000, silver: 550000, icon: "🌌", reqLvl: 340, qText: "Космический Ужас", qClass: "q-mythic" },
    { name: "Абсолютный Хаос", hp: 1000000000000, maxHp: 1000000000000, attack: 300000000, image: "via4.jpg", exp: 450000, silver: 8000000, icon: "🌀", reqLvl: 360, qText: "Колыбель Искажения", qClass: "q-chaotic" }
];

let currentMonster = null;
let currentMonsterIndex = 0;

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ СОКРАЩЕНИЯ ЧИСЕЛ
function formatNum(number) {
    number = parseFloat(number);
    if (isNaN(number)) return "0";
    
    if (number >= 1000000000) {
        return (number / 1000000000).toFixed(1).replace('.0', '') + 'ккк';
    }
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1).replace('.0', '') + 'м';
    }
    if (number >= 10000) {
        return (number / 1000).toFixed(1).replace('.0', '') + 'к';
    }
    
    return number.toLocaleString('ru-RU');
}

function toRoman(num) {
    if (num < 1) return "";
    const lookup = { M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1 };
    let roman = "";
    for (let i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
    return roman;
}

// НОВЫЕ СБАЛАНСИРОВАННЫЕ ФОРМУЛЫ ОПЫТА И ЦЕНЫ ЭНЕРГИИ
// РЕБАЛАНС: прокачка нового игрока сделана в 2 раза медленнее равномерно на всех
// уровнях — требуемый опыт просто удвоен (600 + lvl²*40 = 2 × (300 + lvl²*20)).
// Так как атака/защита/hp, тренировка и добыча в шахтах уже завязаны на уровень
// игрока, это одно изменение равномерно растягивает всю игру, а не только старт.
function getRequiredExp(level) { 
    // РЕБАЛАНС v2: чистая квадратичная формула (600 + lvl²×40) слишком сильно
    // задирала стоимость именно ПОЗДНИХ уровней (35-45+, конец первого круга
    // приключений и переход между кругами) — на 45 уровне требовалось совокупно
    // ~1.2 млн опыта. Смягчаем: часть квадратичного веса переносим в линейный —
    // требуемый опыт на уровнях, которые уже пройдены игроками (до ~10), почти
    // не меняется, а вот к 45 уровню суммарный путь короче примерно на 27%.
    return 600 + (level * level * 25) + (level * 120); 
}

function getEnergyPrice(level) { 
    // Цена восстановления энергии заметно повышена — раньше это было слишком дёшево
    // относительно серебра, получаемого с монстров, и обесценивало энергию как ресурс.
    // РЕБАЛАНС: цена поднята ещё на ~50%, чтобы серебро ощущалось более ценным ресурсом.
    return 450 + (level * level * 12); 
}

// Максимум энергии растёт вместе с уровнем игрока: +100 энергии за каждый новый уровень.
// Раньше максимум был всегда фиксирован на 1000, из-за чего он не рос вообще.
function getMaxEnergyForLevel(level) {
    return 100 + (Math.max(0, level - 1) * 100);
}

function getHpPrice(level) { 
    // РЕБАЛАНС: цена восстановления HP поднята на ~50% в паре с ценой энергии.
    return 150 + (level * level * 3); 
}

// СЛОЖНАЯ ФОРМУЛА ОПЫТА ДЛЯ КЛАНА (Клан больше не будет качаться слишком быстро)
function getRequiredClanExp(level) {
    return 5000 + (level * level * 250);
}

function getKyivDateString() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function formatFullKyivDateTime(timestamp) {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Kyiv', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp));
}

// ВСПЛЫВАЮЩАЯ НАДПИСЬ СВЕРХУ ЭКРАНА (не блокирует экран, сама скрывается)
let topToastTimer = null;
function showTopToast(text, isError = false) {
    const toast = document.getElementById('top-toast');
    if (!toast) return;
    clearTimeout(topToastTimer);

    toast.innerHTML = text;
    toast.classList.toggle('toast-error', !!isError);
    toast.classList.remove('hidden');
    // небольшая задержка, чтобы сработал CSS-переход появления
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    topToastTimer = setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.classList.add('hidden'), 250);
    }, 1800);
}

// КРАСИВЫЕ ОКОШКИ УВЕДОМЛЕНИЙ (ЗАМЕНА ALERT И CONFIRM)
function showGameAlert(text, callback = null) {
    document.getElementById('game-alert-title').innerText = "Вестник Хаоса";
    document.getElementById('game-alert-text').innerHTML = text;
    const controls = document.getElementById('game-alert-controls');
    controls.innerHTML = `<button class="btn btn-primary" style="padding: 8px 20px; width: auto;" id="game-alert-ok-btn">ОК</button>`;
    document.getElementById('game-alert-modal').classList.remove('hidden');
    document.getElementById('game-alert-ok-btn').onclick = function() {
        document.getElementById('game-alert-modal').classList.add('hidden');
        if (callback) callback();
    };
}

function showGameConfirm(text, onConfirm) {
    document.getElementById('game-alert-title').innerText = "Выбор судьбы";
    document.getElementById('game-alert-text').innerHTML = text;
    const controls = document.getElementById('game-alert-controls');
    controls.innerHTML = `
        <button class="btn btn-primary" style="padding: 8px 20px; width: 50%;" id="game-confirm-yes">Да</button>
        <button class="btn btn-secondary" style="padding: 8px 20px; width: 50%;" id="game-confirm-no">Отмена</button>
    `;
    document.getElementById('game-alert-modal').classList.remove('hidden');
    document.getElementById('game-confirm-yes').onclick = function() {
        document.getElementById('game-alert-modal').classList.add('hidden');
        onConfirm();
    };
    document.getElementById('game-confirm-no').onclick = function() {
        document.getElementById('game-alert-modal').classList.add('hidden');
    };
}

function openScreen(screenId) {
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('register-screen').classList.add('hidden');
    document.getElementById('recovery-screen').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    const backupScr = document.getElementById('backup-screen');
    if (backupScr) backupScr.classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

// =====================================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ ПО НИКНЕЙМУ
// =====================================================================

function openRecoveryScreen() {
    document.getElementById('recovery-username').value = "";
    document.getElementById('recovery-new-password').value = "";
    document.getElementById('recovery-new-password-confirm').value = "";
    document.getElementById('recovery-step-1').classList.remove('hidden');
    document.getElementById('recovery-step-2').classList.add('hidden');
    const msg = document.getElementById('recovery-msg');
    msg.classList.add('hidden'); msg.innerHTML = "";
    openScreen('recovery-screen');
}

async function sendRecoveryCode() {
    const username = document.getElementById('recovery-username').value.trim();
    const msg = document.getElementById('recovery-msg');

    function showMsg(text, isError) {
        msg.innerHTML = text;
        msg.className = isError ? "log-error" : "log-success";
        msg.classList.remove('hidden');
    }

    if (username === "") { showMsg("❌ Введите никнейм!", true); return; }

    // Игра полностью локальная — просто проверяем, что персонаж с таким ником
    // существует в этом браузере, и сразу пускаем к смене пароля.
    const players = ldbRead(LOCAL_DB_KEYS.players);
    const record = players[username.toLowerCase()];

    if (record) {
        isPasswordRecoveryFlow = true;
        recoveryTargetUsername = username.toLowerCase();
        document.getElementById('recovery-new-password').value = "";
        document.getElementById('recovery-new-password-confirm').value = "";
        document.getElementById('recovery-step-1').classList.add('hidden');
        document.getElementById('recovery-step-2').classList.remove('hidden');
        msg.classList.add('hidden');
    } else {
        showMsg("❌ Персонаж с таким никнеймом не найден.", true);
    }
}

async function confirmPasswordReset() {
    const newPass = document.getElementById('recovery-new-password').value.trim();
    const confirmPass = document.getElementById('recovery-new-password-confirm').value.trim();
    const msg = document.getElementById('recovery-msg');

    function showMsg(text, isError) {
        msg.innerHTML = text;
        msg.className = isError ? "log-error" : "log-success";
        msg.classList.remove('hidden');
    }

    if (!isPasswordRecoveryFlow || !recoveryTargetUsername) {
        showMsg("❌ Сначала подтвердите никнейм на предыдущем шаге.", true);
        return;
    }
    if (newPass === "" || newPass.length < 6) { showMsg("❌ Пароль должен быть не короче 6 символов!", true); return; }
    if (newPass !== confirmPass) { showMsg("❌ Пароли не совпадают!", true); return; }

    const players = ldbRead(LOCAL_DB_KEYS.players);
    const record = players[recoveryTargetUsername];
    if (!record) { showMsg("❌ Персонаж не найден.", true); return; }
    record.password = newPass;
    ldbWrite(LOCAL_DB_KEYS.players, players);

    isPasswordRecoveryFlow = false;
    recoveryTargetUsername = null;

    showGameAlert("Пароль успешно изменён! Теперь вы можете войти.", function() {
        openScreen('login-screen');
    });
}

function openGameScreen(subScreenId) {
    // Если уходим с экрана конкретной шахты — гасим её таймер обратного отсчёта
    if (mineTimerInterval) { clearInterval(mineTimerInterval); mineTimerInterval = null; }

    document.getElementById('game-menu-screen').classList.add('hidden');
    document.getElementById('adventure-battle-screen').classList.add('hidden');
    const locationsScr = document.getElementById('locations-screen');
    if (locationsScr) locationsScr.classList.add('hidden');
    const forgeScr = document.getElementById('forge-screen');
    if (forgeScr) forgeScr.classList.add('hidden');
    document.getElementById('dungeon-screen').classList.add('hidden');
    const equipmentScr = document.getElementById('equipment-screen');
    if (equipmentScr) equipmentScr.classList.add('hidden');
    const backpackScr = document.getElementById('backpack-screen');
    if (backpackScr) backpackScr.classList.add('hidden');
    document.getElementById('clan-none-screen').classList.add('hidden');
    const clanBrowseScr = document.getElementById('clan-browse-screen');
    if (clanBrowseScr) clanBrowseScr.classList.add('hidden');
    document.getElementById('clan-main-screen').classList.add('hidden');
    document.getElementById('clan-settings-screen').classList.add('hidden');
    document.getElementById('clan-members-screen').classList.add('hidden');
    document.getElementById('gold-mine-screen').classList.add('hidden');
    const minesScr = document.getElementById('mines-screen');
    if (minesScr) minesScr.classList.add('hidden');
    const mineDetailScr = document.getElementById('mine-detail-screen');
    if (mineDetailScr) mineDetailScr.classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('profile-settings-screen').classList.add('hidden');
const supremacyScr = document.getElementById('supremacy-screen');
if (supremacyScr) supremacyScr.classList.add('hidden');
const chatScr = document.getElementById('chat-screen');
if (chatScr) chatScr.classList.add('hidden');
  const tavernScr = document.getElementById('tavern-screen');
if (tavernScr) tavernScr.classList.add('hidden');

    // Локация Бездны Хаоса
    const abyssScr = document.getElementById('chaos-abyss-screen');
    if (abyssScr) abyssScr.classList.add('hidden');
    
    // Локация Арены Хаоса
    const arenaScr = document.getElementById('arena-screen');
    if (arenaScr) arenaScr.classList.add('hidden');

    // Экран Башни Клана
    const towerScr = document.getElementById('clan-tower-screen');
    if (towerScr) towerScr.classList.add('hidden');
    
    const trainingScr = document.getElementById('training-screen');
    if (trainingScr) trainingScr.classList.add('hidden');

    // Экран Ежедневных Квестов
    const questsScr = document.getElementById('quests-screen');
    if (questsScr) questsScr.classList.add('hidden');

    // Экран Форума
    const forumScr = document.getElementById('forum-screen');
    if (forumScr) forumScr.classList.add('hidden');

    // Экран Таблицы Лидеров
    const leaderboardScr = document.getElementById('leaderboard-screen');
    if (leaderboardScr) leaderboardScr.classList.add('hidden');

    // Экран Друзей
    const friendsScr = document.getElementById('friends-screen');
    if (friendsScr) friendsScr.classList.add('hidden');

    // Экран Админ-панели
    const adminScr = document.getElementById('admin-panel-screen');
    if (adminScr) adminScr.classList.add('hidden');

    document.getElementById(subScreenId).classList.remove('hidden');
    window.scrollTo(0, 0); 
    if (subScreenId === 'game-menu-screen') {
        checkDailyChestStatus(); updateFriendRequestBadge(); checkBackupReminder();
        const adminBtn = document.getElementById('admin-panel-menu-btn');
        if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin());
        const arenaBtn = document.getElementById('menu-arena-btn');
        if (arenaBtn && activePlayer) {
            const arenaLocked = activePlayer.level < ARENA_REQ_LEVEL;
            arenaBtn.innerHTML = arenaLocked ? `🔒 Арена Хаоса (с ${ARENA_REQ_LEVEL} ур.)` : `🏟️ Арена Хаоса`;
            arenaBtn.style.opacity = arenaLocked ? "0.6" : "1";
        }
    }
}

async function handleRegister() {
    const user = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-password').value.trim();
    if (user === "" || pass === "") { showGameAlert("Заполните все поля!"); return; }
    if (pass.length < 6) { showGameAlert("Пароль должен быть не короче 6 символов!"); return; }

    // Проверяем, не занят ли никнейм (локально, в этом браузере)
    const players = ldbRead(LOCAL_DB_KEYS.players);
    const usernameKey = user.toLowerCase();
    if (players[usernameKey]) { showGameAlert("Никнейм занят!"); return; }

    const newUserId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const playerData = {
        username: user, hp: 1000, maxHp: 1000, energy: 100, maxEnergy: 100,
        level: 1, exp: 0, silver: (user.toLowerCase() === 'admin') ? 1000000 : 10,
        battleCircle: 1, currentMonsterIndex: 0, equipment: { shlem: 0, arms: 0, mech: 0, sapogi: 0, shit: 0 },
        training: { sword: 0, armor: 0, shield: 0 },
        gear: {}, backpack: [],
        likesGivenLog: {}, // кому и в какой день (Киев) этот игрок уже ставил лайк
        crystals: 0, // валюта Шахты Кристаллов
        mines: {
            gold: { level: 1, working: false, startTime: 0 },
            crystal: { level: 1, working: false, startTime: 0 }
        },
        lastChestClaimDate: "", regTimestamp: Date.now(), lastOnlineTime: Date.now(),
        avatarData: "profile.jpg", aboutText: "", gender: "Не указан",
        clanName: "", lastSilverDepositDate: "", silverDepositedToday: 0,
        hasEnteredWorld: false
    };

    players[usernameKey] = { id: newUserId, username: user, password: pass, data: playerData };
    ldbWrite(LOCAL_DB_KEYS.players, players);

    showGameAlert("Персонаж успешно создан!", function() { openScreen('login-screen'); });
}

async function handleLogin() {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    if (user === "" || pass === "") { showGameAlert("Заполните никнейм и пароль!"); return; }

    const players = ldbRead(LOCAL_DB_KEYS.players);
    const record = players[user.toLowerCase()];
    if (!record) { showGameAlert("Персонаж не найден!"); return; }
    if (record.password !== pass) { showGameAlert("Неверный пароль!"); return; }

    currentAuthUserId = record.id;

    const player = record.data;
    player.username = record.username;
    player.userId = currentAuthUserId;

    if (record.username.toLowerCase() === 'admin') { player.silver = 1000000; }
    activePlayer = player;
    activePlayer.lastSeenTimeFormatted = formatFullKyivDateTime(activePlayer.lastOnlineTime);

    if (!activePlayer.training) {
        activePlayer.training = { sword: 0, armor: 0, shield: 0 };
    }
    if (!activePlayer.gear) activePlayer.gear = {};
    if (!activePlayer.backpack) activePlayer.backpack = [];
    if (!activePlayer.likesGivenLog) activePlayer.likesGivenLog = {};
    if (typeof activePlayer.crystals !== "number") activePlayer.crystals = 0;
    if (!activePlayer.mines) activePlayer.mines = {};
    if (!activePlayer.mines.gold) activePlayer.mines.gold = { level: 1, working: false, startTime: 0 };
    if (!activePlayer.mines.crystal) activePlayer.mines.crystal = { level: 1, working: false, startTime: 0 };
    // Убираем старый текст "о себе", который раньше проставлялся всем по умолчанию —
    // теперь у не заполнивших это поле игроков строка "О себе" просто не показывается.
    if (activePlayer.aboutText === "В этом мире главное — человеком быть!" || activePlayer.aboutText === "Не заполнено") {
        activePlayer.aboutText = "";
    }

    checkMultiLevelUp(); loadActiveClan(); calculateStats(); saveData(); updateGameUI(); checkDailyChestStatus();
    resumeArenaAutoBattleIfNeeded();
    startBackgroundSync(); // онлайн-синхронизация кланов/игроков (см. блок в начале файла)
    openScreen('game-container');

    // Определяем, заходит ли игрок в мир первый раз (для старых сохранений без этого поля
    // считаем "уже входил", если у персонажа уже есть хоть какой-то прогресс).
    if (activePlayer.hasEnteredWorld === undefined) {
        activePlayer.hasEnteredWorld = (activePlayer.level > 1 || activePlayer.exp > 0 || activePlayer.currentMonsterIndex > 0 || activePlayer.battleCircle > 1);
    }

    if (!activePlayer.hasEnteredWorld) {
        // Первый вход в игру — показываем пролог истории, затем сразу бросаем персонажа
        // в первую локацию (Тёмный Лес), без промежуточного захода в главное меню.
        activePlayer.hasEnteredWorld = true; saveData();
        showGameAlert(STORY_PROLOGUE, function() { enterLocation(0); });
    } else {
        openGameScreen('game-menu-screen');
    }
}

function openProfileScreen() {
    if (!activePlayer) return;
    document.getElementById('profile-title-name').innerText = `${activePlayer.username}, ${activePlayer.level} ур.`;
    document.getElementById('profile-avatar-img').src = activePlayer.avatarData;
    let mObj = monsterDatabase[activePlayer.currentMonsterIndex] || monsterDatabase[0];
    document.getElementById('profile-current-stage').innerText = mObj.name + (activePlayer.battleCircle > 1 ? " " + toRoman(activePlayer.battleCircle) : " I");
    document.getElementById('profile-attack').innerText = formatNum(activePlayer.attack);
    document.getElementById('profile-hp').innerText = formatNum(activePlayer.hp);
    document.getElementById('profile-defense').innerText = formatNum(activePlayer.defense);
    renderStatBreakdown();
    document.getElementById('profile-about-text').innerText = activePlayer.aboutText || "";
    const aboutRow = document.getElementById('profile-about-row');
    if (aboutRow) aboutRow.classList.toggle('hidden', !activePlayer.aboutText);
    document.getElementById('profile-gender-text').innerText = activePlayer.gender;
    document.getElementById('profile-reg-date').innerText = formatFullKyivDateTime(activePlayer.regTimestamp);
    document.getElementById('profile-last-seen').innerText = activePlayer.lastSeenTimeFormatted || "Только что";
    document.getElementById('profile-id').innerText = activePlayer.userId;
    const likesBadge = document.getElementById('profile-likes-badge');
    if (likesBadge) likesBadge.innerText = `❤️ ${formatNum(getLikesCount(activePlayer.username))}`;
    renderProfileGear();
    openGameScreen('profile-screen');
}

// Разбивка характеристик по источникам: "База" (уровень + Тренировочный Зал)
// и "Трофеи" (экипировка из подземелий) — плюс % от Алтаря Войны клана, если активен.
function renderStatBreakdown() {
    const box = document.getElementById('profile-stat-breakdown');
    if (!box) return;
    const b = activePlayer.statBreakdown;
    if (!b) { box.innerHTML = ""; return; }
    const warLine = b.warBonusPercent > 0
        ? `<div>⚔️ Алтарь Войны клана: <span class="text-orange">+${b.warBonusPercent}%</span> ко всем статам</div>`
        : "";
    box.innerHTML = `
        <div class="stat-breakdown-row"><span>🏋️ База (уровень + тренировка):</span> ⚔️${formatNum(b.baseAttack)} · 🛡️${formatNum(b.baseDefense)} · ❤️${formatNum(b.baseHp)}</div>
        <div class="stat-breakdown-row"><span>🧥 Трофеи (экипировка):</span> ⚔️${formatNum(b.gearAttack)} · 🛡️${formatNum(b.gearDefense)} · ❤️${formatNum(b.gearHp)}</div>
        ${warLine}
    `;
}

function triggerAvatarUpload() { document.getElementById('avatar-input').click(); }
function handleAvatarUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { activePlayer.avatarData = e.target.result; document.getElementById('profile-avatar-img').src = e.target.result; saveData(); };
    reader.readAsDataURL(file);
}

function openProfileSettings() {
    document.getElementById('settings-username-input').value = activePlayer.username;
    document.getElementById('settings-about-input').value = activePlayer.aboutText;
    document.getElementById('settings-gender-select').value = activePlayer.gender;
    document.getElementById('settings-old-password-input').value = "";
    document.getElementById('settings-new-password-input').value = "";
    document.getElementById('settings-new-password-confirm-input').value = "";
    const pwMsg = document.getElementById('password-change-msg');
    if (pwMsg) { pwMsg.classList.add('hidden'); pwMsg.innerHTML = ""; }
    openGameScreen('profile-settings-screen');
}

async function saveProfileSettings() {
    const pwMsg = document.getElementById('password-change-msg');
    const oldPassword = document.getElementById('settings-old-password-input').value;
    const newPassword = document.getElementById('settings-new-password-input').value;
    const confirmPassword = document.getElementById('settings-new-password-confirm-input').value;

    // Меняем пароль, только если игрок что-то ввёл в поля нового пароля
    if (newPassword !== "" || confirmPassword !== "") {
        if (newPassword !== confirmPassword) {
            if (pwMsg) { pwMsg.innerHTML = "❌ Новые пароли не совпадают!"; pwMsg.className = "log-error"; pwMsg.classList.remove('hidden'); }
            return;
        }
        if (newPassword.length < 6) {
            if (pwMsg) { pwMsg.innerHTML = "❌ Пароль слишком короткий (мин. 6 символов)!"; pwMsg.className = "log-error"; pwMsg.classList.remove('hidden'); }
            return;
        }
        // Проверяем текущий пароль по локальной записи игрока
        const playersForPw = ldbRead(LOCAL_DB_KEYS.players);
        const pwRecord = playersForPw[activePlayer.username.toLowerCase()];
        if (!pwRecord || pwRecord.password !== oldPassword) {
            if (pwMsg) { pwMsg.innerHTML = "❌ Неверный текущий пароль!"; pwMsg.className = "log-error"; pwMsg.classList.remove('hidden'); }
            return;
        }
        pwRecord.password = newPassword;
        ldbWrite(LOCAL_DB_KEYS.players, playersForPw);
        if (pwMsg) { pwMsg.innerHTML = "✔️ Пароль успешно изменён!"; pwMsg.className = "log-success"; pwMsg.classList.remove('hidden'); }
    }

    const newUsername = document.getElementById('settings-username-input').value.trim();

    // Проверка на пустое поле
    if (newUsername === "") {
        showGameAlert("Никнейм не может быть пустым!");
        return;
    }

    // Если игрок решил изменить ник
    if (newUsername !== activePlayer.username) {
        // Проверяем формат ника (буквы, цифры, _, 3-16 символов)
        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]{3,16}$/.test(newUsername)) {
            showGameAlert("Никнейм: 3-16 символов (буквы, цифры, _)");
            return;
        }
        // Проверяем, не занят ли новый ник другим игроком (локально)
        const playersForRename = ldbRead(LOCAL_DB_KEYS.players);
        if (playersForRename[newUsername.toLowerCase()]) {
            showGameAlert("Этот никнейм уже занят другим воином Хаоса!");
            return;
        }

        const oldKey = activePlayer.username.toLowerCase();
        const renameRecord = playersForRename[oldKey];
        if (renameRecord) {
            delete playersForRename[oldKey];
            renameRecord.username = newUsername;
            playersForRename[newUsername.toLowerCase()] = renameRecord;
            ldbWrite(LOCAL_DB_KEYS.players, playersForRename);
        }

        // Присваиваем новый ник
        activePlayer.username = newUsername;
    }

    // Сохраняем остальные данные
    activePlayer.aboutText = document.getElementById('settings-about-input').value.trim();
    activePlayer.gender = document.getElementById('settings-gender-select').value;
    
    saveData();
    openProfileScreen(); 
    
    // Обновляем интерфейс (нижний инфо-бар и прочее), чтобы сразу показать новый ник
    if (typeof updateGameUI === 'function') {
        updateGameUI();
    }
}

function checkDailyChestStatus() {
    const todayStr = getKyivDateString();
    const chestBlock = document.getElementById('daily-chest-block');
    const statusText = document.getElementById('daily-chest-status');
    const chestBtn = document.getElementById('daily-chest-btn');
    if (activePlayer.lastChestClaimDate === todayStr) {
        if (chestBlock) chestBlock.style.display = "none";
    } else {
        if (chestBlock) chestBlock.style.display = "";
        statusText.innerText = "🎁 Ваша ежедневная награда готова!"; chestBtn.disabled = false; chestBtn.innerText = "Получить награду";
    }
}

function showChestModal() { 
    document.getElementById('chest-result').innerText = "Вы можете открыть сундук раз в сутки и получить ценное серебро!";
    document.getElementById('chest-modal-controls').innerHTML = `<button class="btn btn-primary" style="background:#cc7a00; border-color:#ff9900;" onclick="openDailyChest()">Открыть сундук</button>`;
    document.getElementById('chest-modal').classList.remove('hidden');
}

function closeChestModal() { document.getElementById('chest-modal').classList.add('hidden'); checkDailyChestStatus(); }

function openDailyChest() {
    const todayStr = getKyivDateString(); if (activePlayer.lastChestClaimDate === todayStr) return;
    let rewardSilver = Math.floor(Math.random() * 9901) + 100; activePlayer.silver += rewardSilver; activePlayer.lastChestClaimDate = todayStr;
    saveData(); updateGameUI();
    document.getElementById('chest-result').innerHTML = `🎉 Вы получили <span style="color:#ffae19; font-weight:bold;">${formatNum(rewardSilver)}</span> серебра!`;
    document.getElementById('chest-modal-controls').innerHTML = `<button class="btn btn-secondary" onclick="closeChestModal()">Закрыть</button>`;
}

// ЛОГИКА ТРЕНИРОВКИ СНАРЯЖЕНИЯ
function openTrainingScreen() {
    if (!activePlayer) return;
    if (!activePlayer.training) activePlayer.training = { sword: 0, armor: 0, shield: 0 };
    
    // Скрываем и чистим старые сообщения при входе в тренировку
    const msgBox = document.getElementById('training-msg');
    if (msgBox) {
        msgBox.classList.add('hidden');
        msgBox.innerHTML = "";
    }
    
    updateTrainingUI();
    openGameScreen('training-screen');
}

function updateTrainingUI() {
    const t = activePlayer.training;

    const swordQ = getEquipmentQuality(t.sword);
    const armorQ = getEquipmentQuality(t.armor);
    const shieldQ = getEquipmentQuality(t.shield);

    const swordPrice = Math.round((t.sword + 1) * 20 * swordQ.priceMult);
    const armorPrice = Math.round((t.armor + 1) * 20 * armorQ.priceMult);
    const shieldPrice = Math.round((t.shield + 1) * 20 * shieldQ.priceMult);

    const swordBonus = Math.floor(t.sword * 0.05 * activePlayer.level * 1000 * swordQ.bonusMult);
    const armorBonus = Math.floor(t.armor * 0.05 * activePlayer.level * 100 * armorQ.bonusMult);
    const shieldBonus = Math.floor(t.shield * 0.05 * activePlayer.level * 500 * shieldQ.bonusMult);

    document.getElementById('train-quality-sword').innerText = swordQ.name;
    document.getElementById('train-quality-sword').style.color = swordQ.color;
    document.getElementById('train-level-sword').innerText = swordQ.levelLabel;
    document.getElementById('train-bonus-sword').innerText = formatNum(swordBonus);
    document.getElementById('price-train-sword').innerText = formatNum(swordPrice);

    document.getElementById('train-quality-armor').innerText = armorQ.name;
    document.getElementById('train-quality-armor').style.color = armorQ.color;
    document.getElementById('train-level-armor').innerText = armorQ.levelLabel;
    document.getElementById('train-bonus-armor').innerText = formatNum(armorBonus);
    document.getElementById('price-train-armor').innerText = formatNum(armorPrice);

    document.getElementById('train-quality-shield').innerText = shieldQ.name;
    document.getElementById('train-quality-shield').style.color = shieldQ.color;
    document.getElementById('train-level-shield').innerText = shieldQ.levelLabel;
    document.getElementById('train-bonus-shield').innerText = formatNum(shieldBonus);
    document.getElementById('price-train-shield').innerText = formatNum(shieldPrice);
}

function upgradeEquipment(type) {
    if (!activePlayer) return;
    const t = activePlayer.training;
    const currentLvl = t[type];
    const qBefore = getEquipmentQuality(currentLvl);
    const price = Math.round((currentLvl + 1) * 20 * qBefore.priceMult);
    const msgBox = document.getElementById('training-msg');

    if (activePlayer.silver < price) {
        if (msgBox) {
            msgBox.innerHTML = `❌ Недостаточно серебра для тренировки!`;
            msgBox.className = "log-error"; 
            msgBox.classList.remove('hidden');
        }
        return;
    }

    activePlayer.silver -= price;
    t[type] += 1;
    const qAfter = getEquipmentQuality(t[type]);

    // КВЕСТ: Улучшить экипировку 10 раз
    addQuestProgress("training", 1);

    calculateStats();
    if (type === 'armor') {
        activePlayer.hp = activePlayer.maxHp;
    }

    saveData();
    updateGameUI();
    updateTrainingUI();

    if (msgBox) {
        let equipmentName = "Характеристика";
        if (type === 'sword') equipmentName = "Острый Меч";
        if (type === 'armor') equipmentName = "Тяжелая Броня";
        if (type === 'shield') equipmentName = "Стальной Щит";

        if (qAfter.index > qBefore.index) {
            msgBox.innerHTML = `🎉 ${equipmentName} достиг нового качества: <span style="color:${qAfter.color}; font-weight:bold;">${qAfter.name}</span>!`;
        } else {
            msgBox.innerHTML = `✔️ ${equipmentName} улучшен до уровня ${qAfter.levelLabel} (<span style="color:${qAfter.color}; font-weight:bold;">${qAfter.name}</span>)!`;
        }
        msgBox.className = "log-success"; 
        msgBox.classList.remove('hidden');
    }
}

// РАСЧЁТ СТАТИСТИКИ С УЧЁТОМ АЛТАРЯ ВОЙНЫ (+1% ЗА УРОВЕНЬ)
function calculateStats() {
    if (!activePlayer) return;
    
    if (!activePlayer.training) activePlayer.training = { sword: 0, armor: 0, shield: 0 };
    const t = activePlayer.training;

    const swordQ = getEquipmentQuality(t.sword);
    const armorQ = getEquipmentQuality(t.armor);
    const shieldQ = getEquipmentQuality(t.shield);

    const swordBonus = Math.floor(t.sword * 0.05 * activePlayer.level * 1000 * swordQ.bonusMult);
    const armorBonus = Math.floor(t.armor * 0.05 * activePlayer.level * 100 * armorQ.bonusMult);
    const shieldBonus = Math.floor(t.shield * 0.05 * activePlayer.level * 500 * shieldQ.bonusMult);

    // Бонусы от экипировки, добытой в подземельях (шлем/кольцо/плащ/броня/сапоги/щит/меч)
    let gearAttack = 0, gearDefense = 0, gearHp = 0;
    if (activePlayer.gear) {
        Object.keys(activePlayer.gear).forEach(slotKey => {
            const it = activePlayer.gear[slotKey];
            if (!it) return;
            const slotDef = EQUIPMENT_SLOTS[slotKey];
            if (!slotDef) return;
            if (slotDef.stat === 'attack') gearAttack += getEffectiveGearStatValue(it);
            else if (slotDef.stat === 'defense') gearDefense += getEffectiveGearStatValue(it);
            else gearHp += getEffectiveGearStatValue(it);
        });
    }

    // Базовые статы игрока — источник "База" (уровень + Тренировочный Зал)
    let baseStatAttack = 15 + (activePlayer.level * 1000) + forgeAttack + swordBonus;
    let baseStatDefense = 10 + (activePlayer.level * 500) + forgeDefense + shieldBonus;
    let baseStatHp = 1000 + (activePlayer.level * 100) + armorBonus;

    // Итоговые статы = "База" + "Трофеи" (экипировка из подземелий)
    let baseAttack = baseStatAttack + gearAttack;
    let baseDefense = baseStatDefense + gearDefense;
    let baseMaxHp = baseStatHp + gearHp;

    // Считаем бонус от Алтаря Войны (+1% за уровень) — только если алтарь АКТИВИРОВАН и срок не истёк
    let warBonusPercent = 0;
    if (activePlayer.clanName && activeClan && activeClan.altarWar && isAltarActive(activeClan, 'altarWar')) {
        warBonusPercent = activeClan.altarWar * 1;
    }

    // Сохраняем разбивку по источникам для отображения на экране Профиля
    // ("База" — уровень + Тренировочный Зал, "Трофеи" — экипировка из подземелий)
    activePlayer.statBreakdown = {
        baseAttack: baseStatAttack, baseDefense: baseStatDefense, baseHp: baseStatHp,
        gearAttack: gearAttack, gearDefense: gearDefense, gearHp: gearHp,
        warBonusPercent: warBonusPercent
    };

    // Пересчитываем максимум энергии от уровня (никогда не уменьшаем, чтобы не ломать
    // значения, выставленные вручную через админ-панель)
    const newMaxEnergy = getMaxEnergyForLevel(activePlayer.level);
    if (!activePlayer.maxEnergy || newMaxEnergy > activePlayer.maxEnergy) {
        activePlayer.maxEnergy = newMaxEnergy;
    }
    if (activePlayer.energy > activePlayer.maxEnergy) activePlayer.energy = activePlayer.maxEnergy;

    activePlayer.attack = Math.floor(baseAttack * (1 + warBonusPercent / 100));
    activePlayer.defense = Math.floor(baseDefense * (1 + warBonusPercent / 100));
    activePlayer.maxHp = Math.floor(baseMaxHp * (1 + warBonusPercent / 100));

    // Админ-бонус к атаке/защите (задаётся через админ-панель). Прибавляется ПОСЛЕ
    // основного расчёта, поэтому не сбрасывается при левел-апе/прокачке/перезаходе —
    // в отличие от прямого редактирования attack/defense, которые каждый раз
    // пересчитываются заново по формуле и любое ручное значение было бы тут же стёрто.
    if (activePlayer.adminAttackBonus) activePlayer.attack += activePlayer.adminAttackBonus;
    if (activePlayer.adminDefenseBonus) activePlayer.defense += activePlayer.adminDefenseBonus;
    activePlayer.attack = Math.max(0, activePlayer.attack);
    activePlayer.defense = Math.max(0, activePlayer.defense);
   
    saveData();
    updateGameUI();
}

function checkMultiLevelUp() {
    let levelUpOccurred = false; 
    let required = getRequiredExp(activePlayer.level);
    
    while (activePlayer.exp >= required) { 
        activePlayer.exp -= required; 
        activePlayer.level += 1; 

        required = getRequiredExp(activePlayer.level); 
        levelUpOccurred = true; 
    }
    
    if (levelUpOccurred) { 
        calculateStats(); 
        activePlayer.hp = activePlayer.maxHp; 
        activePlayer.energy = activePlayer.maxEnergy; 
    }

    return levelUpOccurred;
}
 
function updateGameUI() {
    if (!activePlayer) return; 
    let nextExpLimit = getRequiredExp(activePlayer.level);
    document.getElementById('display-hp').innerText = formatNum(activePlayer.hp);
    document.getElementById('display-energy').innerText = formatNum(activePlayer.energy);
    document.getElementById('display-attack').innerText = formatNum(activePlayer.attack); 
    document.getElementById('display-defense').innerText = formatNum(activePlayer.defense);
    document.getElementById('display-username').innerText = activePlayer.username; 
    document.getElementById('display-level').innerText = activePlayer.level;
    document.getElementById('display-exp').innerText = formatNum(activePlayer.exp); 
    document.getElementById('display-next-exp').innerText = formatNum(nextExpLimit);
    document.getElementById('display-silver').innerText = formatNum(activePlayer.silver);
    const crystalsEl = document.getElementById('display-crystals');
    if (crystalsEl) crystalsEl.innerText = formatNum(activePlayer.crystals || 0);
    document.getElementById('exp-bar-fill').style.width = `${Math.min(100, (activePlayer.exp / nextExpLimit) * 100)}%`;
}

function logout() {
    saveData();
    unsubscribeFromChat();
    activePlayer = null;
    activeClan = null;
    currentAuthUserId = null;
    openScreen('main-screen');
}
function saveData() {
    if (!activePlayer || !currentAuthUserId) return;
    activePlayer.lastOnlineTime = Date.now();
    const { username, userId, ...playerDataToSave } = activePlayer; // username/userId хранятся отдельными полями, не дублируем в data
    const players = ldbRead(LOCAL_DB_KEYS.players);
    const key = (username || "").toLowerCase();
    if (!players[key]) return;
    players[key].data = playerDataToSave;
    players[key].username = username;
    ldbWrite(LOCAL_DB_KEYS.players, players);
    pushPlayerPublicToServer(); // онлайн-синхронизация (см. блок в начале файла)
}


function openDungeonMenu() {
    const container = document.getElementById('dungeon-list-container'); container.innerHTML = "";
    dungeonDatabase.forEach((dung, idx) => {
        let isLocked = activePlayer.level < dung.reqLvl;
        container.innerHTML += `<div class="forge-item"><img src="${dung.image}" class="item-icon"><div class="item-info"><div class="item-name-row">${dung.icon} ${dung.name}</div><div class="item-quality ${dung.qClass}">${dung.qText}</div></div>${isLocked ? `<button class="btn-enter-dungeon" disabled>С ${dung.reqLvl} ур.</button>` : `<button class="btn-enter-dungeon" onclick="startDungeonBattle(${idx})">Войти</button>`}</div>`;
    });
    openGameScreen('dungeon-screen');
}
function startDungeonBattle(dungeonIdx) {
    currentBattleType = "dungeon"; const dungBoss = dungeonDatabase[dungeonIdx];
    currentMonster = { shortName: dungBoss.name, name: dungBoss.name, hp: dungBoss.hp, maxHp: dungBoss.maxHp, attack: dungBoss.attack, image: dungBoss.image, exp: dungBoss.exp, silver: dungBoss.silver, icon: dungBoss.icon };
    document.getElementById('monster-name').innerText = `${currentMonster.icon} ${currentMonster.name} [БОСС]`;
    document.getElementById('monster-hp').innerText = formatNum(currentMonster.hp); 
    document.getElementById('monster-max-hp').innerText = formatNum(currentMonster.maxHp);
    document.getElementById('monster-img').src = currentMonster.image; document.getElementById('battle-log').className = "hidden";
    const locTag = document.getElementById('battle-location-tag');
    const locLore = document.getElementById('battle-location-lore');
    if (locTag) {
        locTag.innerHTML = `📍 ${dungBoss.icon} ${dungBoss.name} <span class="${dungBoss.qClass}">(${dungBoss.qText})</span>`;
        locTag.classList.remove('hidden');
    }
    if (locLore) { locLore.innerText = ""; locLore.classList.add('hidden'); }
    resetBattleButtons(); openGameScreen('adventure-battle-screen');
}

// Проверка: разблокирована ли локация с данным индексом для игрока.
// Локация становится "открытой сюжетно" по мере продвижения (idx <= currentMonsterIndex
// в рамках текущего круга).
function isLocationDiscovered(idx) {
    return idx <= activePlayer.currentMonsterIndex;
}

// Круг (battleCircle) — это повторное прохождение тех же 16 локаций, но с усиленными
// монстрами (их HP/атака/exp/серебро домножаются на номер круга — см. loadMonster).
// Чтобы цепочка локаций была бесконечной и требуемый уровень персонажа непрерывно рос
// (а не сбрасывался в начале каждого нового круга), к базовому "рек. ур." локации
// прибавляется (circle - 1) * CIRCLE_LEVEL_STEP. Шаг равен рек. уровню последней
// локации (Тролль, 45) — так первая локация нового круга всегда требует чуть больше
// уровня, чем последняя локация предыдущего круга, и цепочка растёт без разрывов и скачков.
const CIRCLE_LEVEL_STEP = monsterDatabase[monsterDatabase.length - 1].reqLvl;
function effectiveReqLvl(idx, circle) {
    return monsterDatabase[idx].reqLvl + (circle - 1) * CIRCLE_LEVEL_STEP;
}
function isBelowRecommendedLevel(idx) {
    return activePlayer.level < effectiveReqLvl(idx, activePlayer.battleCircle);
}
// Уже пройденные в этом круге локации (idx < currentMonsterIndex) остаются доступны
// всегда — можно фармить их повторно на любом уровне. А вот НОВАЯ, ещё не пройденная
// локация (idx === currentMonsterIndex) требует, чтобы персонаж реально достиг её
// требуемого уровня (с учётом круга) — иначе кнопка "Войти" заблокирована.
function isLevelLocked(idx) {
    const isCleared = idx < activePlayer.currentMonsterIndex;
    if (isCleared) return false;
    return isBelowRecommendedLevel(idx);
}

// Кнопка "⚔️ Приключения" в главном меню теперь ведёт в список локаций,
// а не сразу в бой — игрок сам выбирает, в какую открытую локацию войти.
function startAdventure() {
    openLocationsScreen();
}

// Экран со списком всех локаций: пройденные, текущая (доступная), заблокированные по уровню
// и ещё не открытые сюжетно (появятся только после победы над монстром предыдущей локации).
function openLocationsScreen() {
    const container = document.getElementById('locations-list-container');
    container.innerHTML = "";
    const circle = activePlayer.battleCircle;
    monsterDatabase.forEach((loc, idx) => {
        const discovered = isLocationDiscovered(idx);
        const isCurrent = idx === activePlayer.currentMonsterIndex;
        const isCleared = idx < activePlayer.currentMonsterIndex;
        const reqLvlNow = effectiveReqLvl(idx, circle);
        const belowRec = discovered && isBelowRecommendedLevel(idx);
        const lvlLocked = discovered && isLevelLocked(idx);

        let rowClass = "forge-item";
        if (!discovered) rowClass += " loc-item-locked";
        else if (lvlLocked) rowClass += " loc-item-locked";
        else if (isCurrent) rowClass += " loc-item-current";
        else if (isCleared) rowClass += " loc-item-cleared";

        let statusTag = "";
        if (isCleared) statusTag = `<span class="loc-tag loc-tag-done">✔ пройдена</span>`;
        else if (lvlLocked) statusTag = `<span class="loc-tag" style="background:#4a2a10; color:#ff9955; border:1px solid #ff9955;">🔒 с ${reqLvlNow} ур.</span>`;
        else if (isCurrent) statusTag = `<span class="loc-tag loc-tag-current">➤ доступна</span>`;

        let nameDisplay = discovered ? `${loc.icon} ${loc.locName}` : `❓ Неизведанная территория`;
        let monsterDisplay = discovered ? `${loc.icon} ${loc.name}${circle > 1 ? " " + toRoman(circle) : ""}` : `???`;
        let rarityDisplay = discovered ? `<span class="${loc.rClass}">${loc.rarity}</span>` : `<span class="q-common">???</span>`;
        let recDisplay = (discovered && belowRec) ? ` · <span style="color:#ff9955;">рек. ур. ${reqLvlNow}</span>` : (discovered ? ` · рек. ур. ${reqLvlNow}` : "");

        let btnHtml;
        if (!discovered) {
            btnHtml = `<button class="btn-enter-dungeon" disabled>🔒 Не открыто</button>`;
        } else if (lvlLocked) {
            btnHtml = `<button class="btn-enter-dungeon" disabled>🔒 С ${reqLvlNow} ур.</button>`;
        } else {
            btnHtml = `<button class="btn-enter-dungeon" onclick="enterLocation(${idx})">Войти</button>`;
        }

        container.innerHTML += `<div class="${rowClass}">
            <img src="${loc.image}" class="item-icon">
            <div class="item-info">
                <div class="item-name-row">${nameDisplay}${statusTag}</div>
                <div class="item-quality">${rarityDisplay}${recDisplay} · ${monsterDisplay}</div>
            </div>
            ${btnHtml}
        </div>`;
    });
    openGameScreen('locations-screen');
}

// Вход в конкретную локацию по её индексу (клик "Войти" в списке локаций)
function enterLocation(idx) {
    if (!isLocationDiscovered(idx)) { showGameAlert("Эта локация ещё не открыта. Пройдите предыдущие локации."); return; }
    if (isLevelLocked(idx)) { showGameAlert(`Эта локация откроется с ${effectiveReqLvl(idx, activePlayer.battleCircle)} уровня. Наберите опыт в текущей локации или подземельях.`); return; }
    currentBattleType = "adventure";
    currentMonsterIndex = idx;
    loadMonster(currentMonsterIndex);
    document.getElementById('battle-log').className = "hidden";
    resetBattleButtons();
    openGameScreen('adventure-battle-screen');
}

// Загрузка монстра
function loadMonster(index) {
    if (index >= monsterDatabase.length) { activePlayer.battleCircle += 1; activePlayer.currentMonsterIndex = 0; index = 0; currentMonsterIndex = 0; saveData(); }
    const dbMonster = monsterDatabase[index]; const circle = activePlayer.battleCircle;
    currentMonster = { shortName: dbMonster.name, name: dbMonster.name, hp: dbMonster.hp * circle, maxHp: dbMonster.maxHp * circle, attack: dbMonster.attack * circle, image: dbMonster.image, exp: dbMonster.exp * circle, silver: dbMonster.silver * circle, icon: dbMonster.icon };
    document.getElementById('monster-name').innerText = `${currentMonster.icon} ${currentMonster.name}${circle > 1 ? " " + toRoman(circle) : ""}`;
    document.getElementById('monster-hp').innerText = formatNum(currentMonster.hp); 
    document.getElementById('monster-max-hp').innerText = formatNum(currentMonster.maxHp);
    document.getElementById('monster-img').src = currentMonster.image;
    const locTag = document.getElementById('battle-location-tag');
    const locLore = document.getElementById('battle-location-lore');
    if (locTag) {
        if (currentBattleType === "adventure") {
            locTag.innerHTML = `📍 ${dbMonster.locName} <span class="${dbMonster.rClass}">(${dbMonster.rarity})</span>`;
            locTag.classList.remove('hidden');
            if (locLore) { locLore.innerText = dbMonster.lore || ""; locLore.classList.remove('hidden'); }
        } else {
            locTag.innerHTML = ""; locTag.classList.add('hidden');
            if (locLore) { locLore.innerText = ""; locLore.classList.add('hidden'); }
        }
    }
}

function resetBattleButtons() {
    document.getElementById('battle-controls').innerHTML = `<button class="btn btn-attack" onclick="attackMonster()">⚔️ Ударить</button>`;
    document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Покинуть бой</button>`;
}

function attackMonster() {
    if (!activePlayer || !currentMonster || currentMonster.hp <= 0) return;
    const logBox = document.getElementById('battle-log');

    if (activePlayer.hp <= 0) {
        let hpPrice = getHpPrice(activePlayer.level);
        document.getElementById('battle-controls').innerHTML = ``;
        logBox.innerHTML = `💀 Вы погибли!<br><button class="btn-buy-energy" onclick="buyHp(${hpPrice})">❤️ Восстановить HP за ${formatNum(hpPrice)} 🪙</button>`;
        logBox.className = "log-error"; logBox.classList.remove('hidden'); return;
    }

    if (activePlayer.energy < 2) {
        let currentPrice = getEnergyPrice(activePlayer.level);
        logBox.innerHTML = `У вас не хватает энергии!<br><button class="btn-buy-energy" onclick="buyEnergy(${currentPrice})">🔋 Восстановить энергию за ${formatNum(currentPrice)} 🪙</button>`;
        logBox.className = "log-error"; logBox.classList.remove('hidden'); return;
    }
    
    // Тратим 2 энергии и засчитываем в квест расхода энергии
    activePlayer.energy -= 2; 
    addQuestProgress("energy_spend", 2);

    logBox.className = ""; logBox.classList.remove('hidden');
    let roundLog = ""; let playerDamage = Math.floor(Math.random() * 6) + Math.floor(activePlayer.attack * 0.8);
    currentMonster.hp = Math.max(0, currentMonster.hp - playerDamage);
    document.getElementById('monster-hp').innerText = formatNum(currentMonster.hp); showDamageAnimation(playerDamage); playMonsterAttackAnim();
    roundLog += `<div class="log-line-player">Вы ударили ${currentMonster.shortName} на ${formatNum(playerDamage)} хп.</div>`;
    if (currentMonster.hp === 0) { handleMonsterDeath(roundLog); return; }

    let finalMonsterDamage = Math.max(1, (Math.floor(Math.random() * 5) + Math.floor(currentMonster.attack * 0.8)) - activePlayer.defense);
    activePlayer.hp = Math.max(0, activePlayer.hp - finalMonsterDamage);
    roundLog += `<div class="log-line-monster">${currentMonster.shortName} ударил Вас на ${formatNum(finalMonsterDamage)} хп.</div>`;
    if (activePlayer.hp === 0) {
        let hpPrice = getHpPrice(activePlayer.level);
        roundLog += `<div class="log-line-system">💀 Вы погибли!</div>`;
        document.getElementById('battle-controls').innerHTML = `<button class="btn btn-attack" onclick="buyHp(${hpPrice})">❤️ Восстановить HP за ${formatNum(hpPrice)} 🪙</button>`;
        document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Назад</button>`;
    }
    logBox.innerHTML = roundLog; saveData(); updateGameUI();
}

function buyHp(price) {
    const logBox = document.getElementById('battle-log'); if (activePlayer.silver < price) { logBox.innerHTML = `Недостаточно монет!`; logBox.className = "log-error"; return; }
    activePlayer.silver -= price; activePlayer.hp = activePlayer.maxHp;
    resetBattleButtons();
    logBox.innerHTML = `Вы восстановили HP за ${formatNum(price)} серебра`; logBox.className = "log-success";
    saveData(); updateGameUI();
}

function buyEnergy(price) {
    const logBox = document.getElementById('battle-log'); if (activePlayer.silver < price) { logBox.innerHTML = `Недостаточно монет!`; logBox.className = "log-error"; return; }
    activePlayer.silver -= price; activePlayer.energy = activePlayer.maxEnergy; logBox.innerHTML = `Вы восстановили энергию за ${formatNum(price)} серебра`; logBox.className = "log-success"; saveData(); updateGameUI(); resetBattleButtons();
}
function showDamageAnimation(amount) {
    const zone = document.getElementById('damage-effect-zone'); const num = document.createElement('div'); num.classList.add('floating-damage');
    num.innerText = `-${formatNum(amount)}`; num.style.left = `${Math.floor(Math.random() * 80) + 100}px`; zone.appendChild(num); setTimeout(() => { num.remove(); }, 600);
}

// Зум вперёд-назад по картинке монстра в момент удара (Приключения и Подземелье)
function playMonsterAttackAnim() {
    const img = document.getElementById('monster-img');
    if (!img) return;
    img.classList.remove('monster-attack-anim');
    void img.offsetWidth; // форсируем reflow, чтобы анимация перезапустилась при повторных ударах подряд
    img.classList.add('monster-attack-anim');
}

function handleMonsterDeath(existingLog) {
    // Засчитываем прогресс квестов
    let droppedLoot = null;
    if (currentBattleType === "dungeon") {
        addQuestProgress("dungeons", 1); // Квест: Сходить в подземелье и убить там 5 монстров
        // Шанс выпадения экипировки с босса подземелья (см. DUNGEON_LOOT_DROP_CHANCE)
        if (Math.random() < DUNGEON_LOOT_DROP_CHANCE) {
            droppedLoot = generateLootItem();
        }
    } else {
        addQuestProgress("monsters", 1); // Квест: Пройти 12 монстров в Приключении
    }

    // ВЫЧИСЛЯЕМ БОНУС К ОПЫТУ ОТ АЛТАРЯ МУДРОСТИ (+2% ЗА УРОВЕНЬ) — только если активирован и срок не истёк
    let expBonusPercent = 0;
    if (activePlayer.clanName && activeClan && activeClan.altarWisdom && isAltarActive(activeClan, 'altarWisdom')) {
        expBonusPercent = activeClan.altarWisdom * 2;
    }
    let finalMonsterExp = Math.floor(currentMonster.exp * (1 + expBonusPercent / 100));

    activePlayer.exp += finalMonsterExp; 
    activePlayer.silver += currentMonster.silver;
    
    let currentLvlBefore = activePlayer.level; let levelUpOccurred = checkMultiLevelUp();

    // НАДЁЖНОЕ НАЧИСЛЕНИЕ ОПЫТА КЛАНУ (С НОВОЙ КВАДРАТИЧНОЙ ФОРМУЛОЙ)
    if (activePlayer.clanName && activeClan) {
        const clan = activeClan;
        // Мягко инициализируем поля, если их нет
        if (clan.exp === undefined) clan.exp = 0;
        if (clan.level === undefined) clan.level = 1;

        // Начисляем опыт клану
        clan.exp += finalMonsterExp;

        // Рассчитываем уровень клана по новой формуле
        let reqClanExp = getRequiredClanExp(clan.level);
        let clanLevelUp = false;

        while (clan.exp >= reqClanExp) {
            clan.exp -= reqClanExp; 
            clan.level += 1; 
            reqClanExp = getRequiredClanExp(clan.level);
            clanLevelUp = true;
        }

        // Записываем полученный опыт в общую таблицу вклада
        if (!clan.stats) clan.stats = {};
        if (!clan.stats[activePlayer.username]) {
            clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
        }
        if (clan.stats[activePlayer.username].exp === undefined) {
            clan.stats[activePlayer.username].exp = 0;
        }
        clan.stats[activePlayer.username].exp += finalMonsterExp;

        // Сохраняем обновленный объект клана локально
        saveActiveClan();

        // Если уровень клана повысился, выводим сообщение в лог боя
        if (clanLevelUp) {
            existingLog += `<div style="color: #df7fe0; font-weight: bold; margin-top: 5px;">🏰 Уровень Клана повышен до ${clan.level}! 🏰</div>`;
        }
    }

    let justDiscoveredLoc = null; let wasFirstCycle = false; let newCircleStarted = false;
    if (currentBattleType === "adventure") {
        wasFirstCycle = activePlayer.battleCircle === 1;
        activePlayer.currentMonsterIndex += 1;
        // Последняя локация круга пройдена — сразу переходим на новый, более сложный круг:
        // те же локации и монстры, но сильнее (см. домножение на battleCircle в loadMonster),
        // и с более высоким требуемым уровнем (см. effectiveReqLvl/CIRCLE_LEVEL_STEP).
        if (activePlayer.currentMonsterIndex >= monsterDatabase.length) {
            activePlayer.battleCircle += 1;
            activePlayer.currentMonsterIndex = 0;
            newCircleStarted = true;
        }
        currentMonsterIndex = activePlayer.currentMonsterIndex;
        // Если это первое прохождение (circle не изменился) и индекс указывает на новую локацию —
        // она только что была открыта победой над предыдущим монстром.
        if (wasFirstCycle && !newCircleStarted && currentMonsterIndex < monsterDatabase.length) {
            justDiscoveredLoc = monsterDatabase[currentMonsterIndex];
        }
    }
    saveData(); updateGameUI(); const logBox = document.getElementById('battle-log');
    let systemLog = `<div class="log-line-system">⚔️ Победа! Получено: Опыт +${formatNum(finalMonsterExp)} | Серебро +${formatNum(currentMonster.silver)}</div>`;
    if (droppedLoot) {
        const q = LOOT_QUALITIES[droppedLoot.quality];
        systemLog += `<div class="lvl-up-text" style="color:${q.color};">✨ Выпал предмет: <span class="gear-name-${droppedLoot.quality}">${droppedLoot.name}</span> (${q.name})!</div>`;
    }
    if (levelUpOccurred) systemLog += `<div class="lvl-up-text">⭐ Новый уровень (+${activePlayer.level - currentLvlBefore})! ⭐</div>`;
    if (newCircleStarted) systemLog += `<div class="lvl-up-text" style="color:#ffcc4d;">🔁 Все локации круга ${toRoman(activePlayer.battleCircle - 1)} пройдены! Начинается круг ${toRoman(activePlayer.battleCircle)} — те же земли, но монстры сильнее.</div>`;
    if (justDiscoveredLoc) systemLog += `<div class="lvl-up-text" style="color:#4da6ff;">🗺️ Открыта новая локация: ${justDiscoveredLoc.icon} ${justDiscoveredLoc.locName}!</div><div style="color:#8a8a8a; font-style:italic; font-size:12px; margin-top:4px;">${justDiscoveredLoc.lore || ""}</div>`;
    logBox.innerHTML = existingLog + systemLog;

    if (currentBattleType === "adventure") {
        document.getElementById('battle-controls').innerHTML = `<button class="btn btn-adventure" onclick="openLocationsScreen()">🗺️ К локациям</button>`;
    } else {
        document.getElementById('battle-controls').innerHTML = ``;
    }
    document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Назад</button>`;

    // Приглашение вступить в клан или создать свой — показывается один раз, когда игрок
    // впервые добирается до первой Мифической локации (Драконьи Пики).
    if (justDiscoveredLoc && currentMonsterIndex === CLAN_INVITE_LOCATION_INDEX && !activePlayer.clanName && !activePlayer.clanPromptShown) {
        activePlayer.clanPromptShown = true; saveData();
        showGameConfirm(
            `Вы прошли через самые опасные обычные земли и стоите на пороге <b>Мифических локаций</b>! Дальше будет ещё труднее. Вступите в клан или создайте свой, чтобы стать сильнее вместе с другими героями?`,
            function() { openClanMenu(); }
        );
    }

    // Если с босса подземелья выпала экипировка — предлагаем игроку сразу
    // надеть её или положить в рюкзак (с небольшой задержкой, чтобы сперва
    // был виден лог боя).
    if (droppedLoot) {
        const lootToShow = droppedLoot;
        setTimeout(function() { showLootDropModal(lootToShow); }, 500);
    }
}
function leaveBattle() { currentBattleType === "adventure" ? openLocationsScreen() : openDungeonMenu(); }

function updateKyivTime() {
    const timeElement = document.getElementById('kyiv-time'); if (!timeElement) return;
    timeElement.innerText = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
setInterval(updateKyivTime, 1000);

// КЛАНОВАЯ СИСТЕМА
async function openClanMenu() {
    if (!activePlayer) return;
    if (!activePlayer.clanName) { openGameScreen('clan-none-screen'); return; }
    await loadActiveClan();
    if (!activeClan) {
        // Клан не найден в общей базе (например, был удалён) — сбрасываем привязку
        activePlayer.clanName = ""; saveData();
        openGameScreen('clan-none-screen');
        return;
    }
    updateClanUI(); openGameScreen('clan-main-screen');
}

// Список всех реально существующих кланов для вступления — без всякой платы,
// в отличие от основания собственного клана. Новичку не нужно возвращаться в главное
// меню: экран доступен прямо с "Вы не состоите в клане".
async function openClanBrowseScreen() {
    await pullClansFromServer(); // сначала подтягиваем кланы, созданные другими игроками
    const container = document.getElementById('clan-browse-list-container');
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    const clanRows = Object.values(clans).filter(row => row && row.data);

    if (clanRows.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#888; padding: 20px 10px;">Кланов пока нет. Будь первым — основай свой!</div>`;
    } else {
        clanRows.sort((a, b) => (b.data.level || 1) - (a.data.level || 1));
        container.innerHTML = clanRows.map(row => {
            const c = row.data;
            const memberCount = c.stats ? Object.keys(c.stats).length : 0;
            return `<div class="forge-item">
                <img src="${c.logo || 'clan.png'}" class="item-icon">
                <div class="item-info">
                    <div class="item-name-row">🛡️ ${escapeHTML(c.name)}</div>
                    <div class="item-quality">⭐ ${formatNum(c.level || 1)} ур. · 👥 ${memberCount} чел. · 👑 ${escapeHTML(c.owner || "—")}</div>
                </div>
                <button class="btn-enter-dungeon" onclick="joinClan('${escapeHTML(c.name).replace(/'/g, "\\'")}')">Вступить</button>
            </div>`;
        }).join('');
    }
    openGameScreen('clan-browse-screen');
}

// Мгновенное вступление в существующий клан — бесплатно (в отличие от основания своего).
async function joinClan(clanName) {
    if (!activePlayer || activePlayer.clanName) return;
    await pullClansFromServer(); // убедимся, что клан ещё существует и берём его актуальные данные
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    const row = clans[clanName.toLowerCase()];
    if (!row || !row.data) { showGameAlert("Этот клан больше не существует."); openClanBrowseScreen(); return; }

    const clanData = row.data;
    if (!clanData.stats) clanData.stats = {};
    if (!clanData.stats[activePlayer.username]) clanData.stats[activePlayer.username] = { gold: 0, exp: 0 };

    activePlayer.clanName = clanData.name;
    activeClan = clanData;
    saveActiveClan(); saveData(); updateGameUI(); updateClanUI();
    openGameScreen('clan-main-screen');
    showGameAlert(`Добро пожаловать в клан "<b>${escapeHTML(clanData.name)}</b>"!`);
}

async function createClan() {
    const clanNameInput = document.getElementById('clan-create-name').value.trim();
    if (!clanNameInput) return showGameAlert("Введите название клана!");
    if (clanNameInput.length < 3) return showGameAlert("Название слишком короткое!");
    if (activePlayer.silver < 1000) { return showGameAlert("Недостаточно серебра! Требуется 1,000 🪙"); }

    await pullClansFromServer(); // проверяем занятость имени по общей базе, а не только по этому браузеру
    const clansForCheck = ldbRead(LOCAL_DB_KEYS.clans);
    if (clansForCheck[clanNameInput.toLowerCase()]) { return showGameAlert("Такой клан уже существует!"); }

    const clanData = { 
        name: clanNameInput, 
        level: 1, 
        exp: 0, 
        gold: 0, 
        about: "Приветствуем воинов Хаоса!", 
        logo: "clan.png", 
        owner: activePlayer.username,
        altarWar: 0,
        altarWisdom: 0,
        altarWealth: 0,
        altarSupremacy: 0,
        altarWarActive: false,
        altarWisdomActive: false,
        altarWealthActive: false,
        altarSupremacyActive: false,
        lastMineDate: "",
        minedToday: 0,
        stats: {} // Хранилище статистики вкладов
    };
    clanData.stats[activePlayer.username] = { gold: 0, exp: 0 }; 

    clansForCheck[clanNameInput.toLowerCase()] = { name: clanNameInput, owner: activePlayer.username, data: clanData };
    ldbWrite(LOCAL_DB_KEYS.clans, clansForCheck);
    pushClanToServer(clanData); // онлайн-синхронизация

    activePlayer.silver -= 1000; activePlayer.clanName = clanNameInput;
    activeClan = clanData;
    saveData(); updateGameUI(); updateClanUI(); openGameScreen('clan-main-screen');
    showGameAlert(`Клан "<b>${clanNameInput}</b>" успешно основан!`);
}

// =====================================================================
// ЛИЧНЫЕ ШАХТЫ (Золотая и Кристальная) — НЕ путать с "Золотой Шахтой Клана"
// ниже (это разные фичи: эта — личная добыча игрока, та — общий клановый
// клик-майнинг). Игрок отправляет персонажа "на смену" на 2 часа, платя
// энергию за спуск; по истечении смены забирает награду. Золотая Шахта
// приносит обычное серебро, Шахта Кристаллов — новую валюту "кристаллы".
// Обе шахты качаются до 100 уровня за свою же добытую валюту: чем глубже
// шахта, тем дороже спуск (+10 энергии за уровень) и тем больше добыча.
// =====================================================================
const MINE_MAX_LEVEL = 100;
const MINE_CYCLE_MS = 2 * 60 * 60 * 1000; // смена длится 2 часа

// Добыча шахты теперь учитывает не только её собственный уровень (1-100), но и
// уровень персонажа — иначе на высоких уровнях шахта безнадёжно отстаёт от
// арены, где награда растёт вместе с игроком. Множитель 6 (золото) и 0.3
// (кристаллы) подобраны так, чтобы полная смена на макс. уровне шахты давала
// примерно 60-80% от эффективности "одного клика" на арене за то же
// количество энергии — шахта остаётся выгодной пассивной альтернативой,
// но активный бой на арене всё ещё чуть выгоднее.
const MINE_TYPES = {
    gold: {
        label: "Золотая Шахта",
        icon: "🪙",
        img: "shgold.jpg",
        currencyField: "silver",
        currencyLabel: "Серебро",
        currencyIcon: "🪙",
        yieldForLevel: (lvl, playerLevel) => Math.floor(40 + lvl * 35 + lvl * (playerLevel || 1) * 6),
        upgradeCostForLevel: (nextLvl) => nextLvl * nextLvl * 32 // РЕБАЛАНС: апгрейд дороже (+~30%)
    },
    crystal: {
        label: "Шахта Кристаллов",
        icon: "💎",
        img: "shkris.jpg",
        currencyField: "crystals",
        currencyLabel: "Кристаллы",
        currencyIcon: "💎",
        yieldForLevel: (lvl, playerLevel) => Math.floor(5 + lvl * 4.4 + lvl * (playerLevel || 1) * 0.3),
        upgradeCostForLevel: (nextLvl) => nextLvl * nextLvl * 4 // РЕБАЛАНС: апгрейд дороже (+~30%)
    }
};

let currentMineType = null;
let mineTimerInterval = null;

function ensureMinesData() {
    if (!activePlayer.mines) activePlayer.mines = {};
    if (!activePlayer.mines.gold) activePlayer.mines.gold = { level: 1, working: false, startTime: 0 };
    if (!activePlayer.mines.crystal) activePlayer.mines.crystal = { level: 1, working: false, startTime: 0 };
    if (typeof activePlayer.crystals !== "number") activePlayer.crystals = 0;
}

function formatMineTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function openMinesScreen() {
    if (!activePlayer) return;
    ensureMinesData();
    renderMinesHub();
    openGameScreen('mines-screen');
}

function renderMinesHub() {
    ['gold', 'crystal'].forEach(type => {
        const state = activePlayer.mines[type];
        const levelEl = document.getElementById(`mine-hub-level-${type}`);
        const statusEl = document.getElementById(`mine-hub-status-${type}`);
        if (levelEl) levelEl.innerText = `${state.level} / ${MINE_MAX_LEVEL}`;
        if (statusEl) {
            if (!state.working) {
                statusEl.innerHTML = `<span style="color:#888;">Свободна</span>`;
            } else {
                const remaining = MINE_CYCLE_MS - (Date.now() - state.startTime);
                statusEl.innerHTML = remaining <= 0
                    ? `<span style="color:#7fe07f; font-weight:bold;">🎁 Готово!</span>`
                    : `<span style="color:#ffcf7a;">⏳ ${formatMineTime(remaining)}</span>`;
            }
        }
    });
}

function openMineDetail(type) {
    if (!activePlayer || !MINE_TYPES[type]) return;
    ensureMinesData();
    currentMineType = type;
    openGameScreen('mine-detail-screen');
    renderMineDetail();
    mineTimerInterval = setInterval(renderMineDetail, 1000);
}

function closeMineDetail() {
    currentMineType = null;
    openMinesScreen();
}

function renderMineDetail() {
    if (!currentMineType || !activePlayer) return;
    const type = currentMineType;
    const def = MINE_TYPES[type];
    const state = activePlayer.mines[type];

    document.getElementById('mine-detail-title').innerText = `${def.icon} ${def.label}`;
    document.getElementById('mine-detail-img').src = def.img;
    document.getElementById('mine-detail-level').innerText = `${state.level} / ${MINE_MAX_LEVEL}`;

    const energyCost = state.level * 10;
    document.getElementById('mine-detail-energy-cost').innerText = `${energyCost} ⚡`;

    const yieldNow = def.yieldForLevel(state.level, activePlayer.level);
    document.getElementById('mine-detail-yield').innerText = `${formatNum(yieldNow)} ${def.currencyIcon}`;

    const actionBox = document.getElementById('mine-detail-action');
    if (!state.working) {
        actionBox.innerHTML = `<div class="game-buttons"><button class="btn btn-attack" onclick="startMineWork()">👷 Отправиться на работу</button></div>`;
    } else {
        const remaining = MINE_CYCLE_MS - (Date.now() - state.startTime);
        if (remaining <= 0) {
            actionBox.innerHTML = `<div class="game-buttons"><button class="btn btn-attack" onclick="collectMineReward()">🎁 Забрать награду (+${formatNum(yieldNow)} ${def.currencyIcon})</button></div>`;
        } else {
            actionBox.innerHTML = `<div class="profile-stage-box" style="background:#141414; color:#ffcf7a; font-weight:bold;">⏳ До конца смены: ${formatMineTime(remaining)}</div>`;
        }
    }

    const upgradeBox = document.getElementById('mine-detail-upgrade');
    if (state.level >= MINE_MAX_LEVEL) {
        upgradeBox.innerHTML = `<div class="profile-stage-box" style="color:#ffd700; font-weight:bold;">⭐ Максимальный уровень шахты!</div>`;
    } else {
        const nextLevel = state.level + 1;
        const cost = def.upgradeCostForLevel(nextLevel);
        upgradeBox.innerHTML = `
            <div class="game-buttons">
                <button class="btn" ${state.working ? 'disabled style="opacity:0.5;"' : ''} style="background:#2a1f0a; border-color:#5c4419; color:#ffcf7a;" onclick="upgradeMine()">⬆️ Улучшить до ${nextLevel} ур. — ${formatNum(cost)} ${def.currencyIcon}</button>
            </div>
            ${state.working ? '<div style="font-size:11px; color:#888; text-align:center; margin-top:4px;">Нельзя улучшать во время смены</div>' : ''}
        `;
    }

    const balanceEl = document.getElementById('mine-detail-currency-balance');
    if (balanceEl) balanceEl.innerText = `${formatNum(activePlayer[def.currencyField] || 0)} ${def.currencyIcon}`;
}

function startMineWork() {
    if (!currentMineType || !activePlayer) return;
    const type = currentMineType;
    const state = activePlayer.mines[type];
    if (state.working) return;

    const energyCost = state.level * 10;
    if (activePlayer.energy < energyCost) {
        showGameAlert(`❌ Недостаточно энергии! Нужно ${energyCost} ⚡`);
        return;
    }

    activePlayer.energy -= energyCost;
    state.working = true;
    state.startTime = Date.now();
    addQuestProgress("energy_spend", energyCost);

    saveData(); updateGameUI(); renderMineDetail();
}

function collectMineReward() {
    if (!currentMineType || !activePlayer) return;
    const type = currentMineType;
    const def = MINE_TYPES[type];
    const state = activePlayer.mines[type];
    if (!state.working) return;
    if (MINE_CYCLE_MS - (Date.now() - state.startTime) > 0) return; // смена ещё не закончена

    const reward = def.yieldForLevel(state.level, activePlayer.level);
    activePlayer[def.currencyField] = (activePlayer[def.currencyField] || 0) + reward;
    state.working = false;
    state.startTime = 0;

    saveData(); updateGameUI(); renderMineDetail();
    showGameAlert(`${def.icon} Смена окончена! Вы принесли <b>+${formatNum(reward)} ${def.currencyLabel}</b>.`);
}

function upgradeMine() {
    if (!currentMineType || !activePlayer) return;
    const type = currentMineType;
    const def = MINE_TYPES[type];
    const state = activePlayer.mines[type];
    if (state.working || state.level >= MINE_MAX_LEVEL) return;

    const nextLevel = state.level + 1;
    const cost = def.upgradeCostForLevel(nextLevel);
    if ((activePlayer[def.currencyField] || 0) < cost) {
        showGameAlert(`❌ Недостаточно ${def.currencyLabel.toLowerCase()} для улучшения шахты!`);
        return;
    }

    activePlayer[def.currencyField] -= cost;
    state.level = nextLevel;

    saveData(); updateGameUI(); renderMineDetail();
}

// ЗОЛОТАЯ ШАХТА С ЛИМИТОМ И БОНУСОМ АЛТАРЯ БОГАТСТВА
function openGoldMine() { 
    document.getElementById('mine-log').className = "hidden"; 
    updateGoldMineUI();
    openGameScreen('gold-mine-screen'); 
}

function updateGoldMineUI() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    const today = getKyivDateString();
    
    // Если наступил новый день, сбрасываем суточную добычу
    if (clan.lastMineDate !== today) {
        clan.lastMineDate = today;
        clan.minedToday = 0;
        saveActiveClan();
    }

    // Суточный Лимит = Уровень Клана * 1000
    const dailyLimit = clan.level * 1000;
    const currentMined = clan.minedToday || 0;

    document.getElementById('mine-daily-extracted').innerText = formatNum(currentMined);
    document.getElementById('mine-daily-limit').innerText = formatNum(dailyLimit);
}

function mineGold() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return; const logBox = document.getElementById('mine-log');
    const clan = activeClan;

    if (activePlayer.energy < 5) { 
        logBox.innerHTML = "❌ Недостаточно энергии! Нужно 5 ⚡"; 
        logBox.className = "log-error"; 
        logBox.classList.remove('hidden'); 
        return; 
    }

    const today = getKyivDateString();
    if (clan.lastMineDate !== today) {
        clan.lastMineDate = today;
        clan.minedToday = 0;
    }

    const dailyLimit = clan.level * 1000;
    const currentMined = clan.minedToday || 0;

    if (currentMined >= dailyLimit) {
        logBox.innerHTML = `⚠️ Клан исчерпал суточный лимит шахты для ${clan.level} уровня (${formatNum(dailyLimit)} 🟡)! Приходите после 00:00.`;
        logBox.className = "log-error";
        logBox.classList.remove('hidden');
        return;
    }

    // Тратим 5 энергии, засчитываем в квест расхода энергии и квест кликов по шахте
    activePlayer.energy -= 5; 
    addQuestProgress("energy_spend", 5);
    addQuestProgress("mine", 1); // Квест: Ударить киркой 20 раз в Шахте клана

    // Бонус от Алтаря Богатства — только если алтарь АКТИВИРОВАН и срок не истёк
    let wealthBonus = (clan.altarWealth && isAltarActive(clan, 'altarWealth')) ? clan.altarWealth : 0;
    let minedGold = (Math.floor(Math.random() * 5) + 1) + wealthBonus; 

    // Срезаем излишки, чтобы не выйти за рамки суточного лимита
    if (currentMined + minedGold > dailyLimit) {
        minedGold = dailyLimit - currentMined;
    }

    clan.gold += minedGold;
    clan.minedToday = (clan.minedToday || 0) + minedGold;

    saveActiveClan(); saveData(); updateGameUI(); updateGoldMineUI();
    logBox.innerHTML = `⛏️ Бам! Из жилы вывалено <span style="color:#ffd700; font-weight:bold;">+${formatNum(minedGold)}</span> Золота в казну!`; logBox.className = "log-success"; logBox.classList.remove('hidden');
}

// ВЗНОС СЕРЕБРА (КОНВЕРТИРУЕТСЯ В ЗОЛОТО И ПИШЕТСЯ В СТАТИСТИКУ)
function openDepositSilverModal() { document.getElementById('deposit-silver-amount').value = ""; document.getElementById('deposit-silver-modal').classList.remove('hidden'); }
function closeDepositSilverModal() { document.getElementById('deposit-silver-modal').classList.add('hidden'); }
function submitSilverDeposit() {
    const amount = parseInt(document.getElementById('deposit-silver-amount').value);
    if (isNaN(amount) || amount <= 0) return showGameAlert("Введите верное число!");
    if (activePlayer.silver < amount) return showGameAlert("Не хватает серебра!");
    const today = getKyivDateString();
    if (activePlayer.lastSilverDepositDate !== today) { activePlayer.lastSilverDepositDate = today; activePlayer.silverDepositedToday = 0; }
    if (activePlayer.silverDepositedToday + amount > 10000) { return showGameAlert(`Лимит! Вы можете внесить еще максимум ${formatNum(10000 - activePlayer.silverDepositedToday)} серебра сегодня.`); }
    if (!activeClan) return;
    const clan = activeClan;

    activePlayer.silver -= amount; activePlayer.silverDepositedToday += amount;
    clan.gold += amount; 

    // КВЕСТ: Положить в клан золото 10к (взнос серебра на прямую равен золоту казны)
    addQuestProgress("clan_deposit", amount);

    // СОХРАНЕНИЕ ВНЕСЕННОГО ЗОЛОТА В СТАТИСТИКУ ВКЛАДА УЧАСТНИКА
    if (!clan.stats) clan.stats = {};
    if (!clan.stats[activePlayer.username]) {
        clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
    }
    clan.stats[activePlayer.username].gold += amount;

    saveActiveClan(); saveData(); updateGameUI(); updateClanUI(); closeDepositSilverModal();
    
    // Перерисовываем таблицу вкладов
    const statsBlock = document.getElementById('clan-stats-block');
    if (statsBlock && !statsBlock.classList.contains('hidden')) {
        renderClanStats();
    }

    showGameAlert(`Вы внесли ${formatNum(amount)} серебра. Казна пополнена на +${formatNum(amount)} Золота!`);
}

// ЧИТ: ЗАКИНУТЬ ЛЮБОЕ КОЛИЧЕСТВО ЗОЛОТА В КАЗНУ КЛАНА (БЕЗ СЕРЕБРА И ЛИМИТОВ)
function cheatAddClanGold() {
    if (!isAdmin()) return showGameAlert("Доступ только для администратора!");
    if (!activePlayer.clanName || !activeClan) return showGameAlert("Вы не состоите в клане!");
    const input = prompt("Сколько золота закинуть в казну клана?", "1000000");
    if (input === null) return;

    // JS числа точны только до Number.MAX_SAFE_INTEGER (~9 квадриллионов).
    // Для любых чисел свыше этого казна всё равно будет работать (складываться),
    // но отображаться значение может неточно из-за ограничений float — это нормально для чит-функции.
    const raw = input.replace(/\s/g, '').replace(',', '.');
    let amount = Number(raw);

    if (!raw || isNaN(amount)) return showGameAlert("Введите корректное число!");
    if (amount <= 0) return showGameAlert("Число должно быть больше нуля!");

    const clan = activeClan;
    clan.gold = (clan.gold || 0) + amount;

    if (!clan.stats) clan.stats = {};
    if (!clan.stats[activePlayer.username]) {
        clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
    }
    clan.stats[activePlayer.username].gold += amount;

    saveActiveClan(); saveData(); updateGameUI(); updateClanUI();

    const statsBlock = document.getElementById('clan-stats-block');
    if (statsBlock && !statsBlock.classList.contains('hidden')) {
        renderClanStats();
    }

    showGameAlert(`🛠️ [ЧИТ] В казну клана добавлено +${formatNum(amount)} Золота!`);
}

function updateClanUI() {
    if (!activePlayer.clanName || !activeClan) return;
    const clan = activeClan;
    
    let reqExp = getRequiredClanExp(clan.level); // Квадратичная формула
    
    document.getElementById('clan-display-name').innerText = clan.name;
    document.getElementById('clan-display-img').src = clan.logo || "clan.png";
    document.getElementById('clan-display-level').innerText = clan.level;
    document.getElementById('clan-display-exp').innerText = formatNum(clan.exp);
    document.getElementById('clan-display-next-exp').innerText = formatNum(reqExp);
    const clanExpFill = document.getElementById('clan-exp-bar-fill');
    if (clanExpFill) clanExpFill.style.width = `${Math.min(100, (clan.exp / reqExp) * 100)}%`;
    document.getElementById('clan-display-about').innerText = clan.about;
    document.getElementById('clan-display-gold').innerText = formatNum(clan.gold);
    const ownerEl = document.getElementById('clan-display-owner');
    if (ownerEl) ownerEl.innerText = clan.owner || "—";

    // Кнопка "Чит: Золото" — только для аккаунта Admin, у обычных игроков скрыта.
    const cheatBtn = document.getElementById('clan-cheat-gold-btn');
    if (cheatBtn) cheatBtn.classList.toggle('hidden', !isAdmin());
}

function openClanSettings() {
    if (!activePlayer.clanName || !activeClan) return;
    const clan = activeClan;
    document.getElementById('clan-edit-name').value = clan.name; document.getElementById('clan-edit-about').value = clan.about;
    openGameScreen('clan-settings-screen');
}

async function saveClanSettings() {
    if (!activePlayer.clanName || !activeClan) return;
    const oldName = activePlayer.clanName; const newName = document.getElementById('clan-edit-name').value.trim();
    const newAbout = document.getElementById('clan-edit-about').value.trim() || "Без описания";
    if (!newName) return showGameAlert("Название не может быть пустым!");
    const clan = activeClan;
    clan.about = newAbout;

    if (newName !== oldName) {
        const clansForRename = ldbRead(LOCAL_DB_KEYS.clans);
        if (clansForRename[newName.toLowerCase()]) { return showGameAlert("Это название уже занято!"); }

        clan.name = newName;
        const oldClanKey = oldName.toLowerCase();
        delete clansForRename[oldClanKey];
        clansForRename[newName.toLowerCase()] = { name: newName, owner: clan.owner, data: clan, updated_at: Date.now() };
        ldbWrite(LOCAL_DB_KEYS.clans, clansForRename);

        activePlayer.clanName = newName; saveData();
    } else {
        saveActiveClan();
    }

    updateClanUI(); openGameScreen('clan-main-screen');
    showGameAlert("Настройки сохранены!");
}

function triggerClanLogoUpload() { document.getElementById('clan-logo-input').click(); }
function handleClanLogoUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!activePlayer.clanName || !activeClan) return;
        activeClan.logo = e.target.result;
        saveActiveClan();
        document.getElementById('clan-display-img').src = e.target.result; showGameAlert("Логотип обновлен!");
    };
    reader.readAsDataURL(file);
}

async function openClanMembers() {
    if (!activePlayer.clanName || !activeClan) return;
    await pullPlayersPublicFromServer(); // актуальные уровни/время входа сокланов
    const clan = activeClan;
    if (!clan.stats) clan.stats = {};
    // Убеждаемся, что текущий игрок и владелец клана точно есть в списке участников
    if (!clan.stats[activePlayer.username]) clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
    if (clan.owner && !clan.stats[clan.owner]) clan.stats[clan.owner] = { gold: 0, exp: 0 };

    const leaderName = clan.owner || activePlayer.username;
    const memberNames = Object.keys(clan.stats);
    // Лидер всегда показывается первым в списке
    memberNames.sort((a, b) => (a === leaderName ? -1 : b === leaderName ? 1 : a.localeCompare(b)));

    const players = ldbRead(LOCAL_DB_KEYS.players);

    let html = memberNames.map(name => {
        const rec = players[name.toLowerCase()];
        const pdata = rec && rec.data ? rec.data : null;
        const lvl = pdata ? pdata.level : "?";
        const mStats = clan.stats[name] || { gold: 0, exp: 0 };
        const clanGold = formatNum(mStats.gold || 0);
        const clanExp = formatNum(mStats.exp || 0);
        const lastSeenTs = (name === activePlayer.username) ? Date.now() : (pdata ? pdata.lastOnlineTime : null);
        const lastSeen = lastSeenTs ? formatChatTime(lastSeenTs) : "давно";
        const isLeader = name === leaderName;

        return `<div class="clan-member-row${isLeader ? ' is-leader' : ''}">
            <div class="clan-member-icon">${isLeader ? '👑' : '⚔️'}</div>
            <div class="clan-member-body">
                <div class="clan-member-name-row">
                    <span class="clan-member-name">${escapeHTML(name)}</span>
                    <span class="clan-member-lastseen">🕓 ${lastSeen}</span>
                </div>
                <div class="clan-member-role">${isLeader ? 'Основатель клана' : 'Участник'}</div>
                <div class="clan-member-stats">
                    <span>⭐ ${lvl} ур.</span>
                    <span>🪙 ${clanGold} в клан</span>
                    <span>✨ ${clanExp} опыта в клан</span>
                </div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('clan-members-list').innerHTML = html;
    document.getElementById('clan-display-count').innerText = String(memberNames.length);
    openGameScreen('clan-members-screen');
}

function leaveClan() {
    showGameConfirm("Вы действительно хотите покинуть клан?", function() {
        activePlayer.clanName = ""; activeClan = null; saveData(); openGameScreen('game-menu-screen'); showGameAlert("Вы покинули клан.");
    });
}

/**
 * =======================================================================
 * ЛОКАЦИЯ: БЕЗДНА ХАОСА И СИСТЕМА СПАВНА МИРОВОГО БОССА "ЧЁРНЫЙ ДРАКОН"
 * =======================================================================
 */

let chaosBossState = {
    isSpawned: false,
    hp: 2500000,
    maxHp: 2500000,
    attack: 35000,
    image: "drakon.jpg",
    expReward: 17500,
    silverReward: 10000,
    hasChest: false
};

function openChaosAbyssScreen() {
    if (!activePlayer) return;
    
    const storedState = localStorage.getItem('rpg_chaos_boss');
    if (storedState) {
        chaosBossState = JSON.parse(storedState);
    } else {
        let playerAttack = activePlayer.attack || 15000;
        let balancedHp = playerAttack * 15; 

        chaosBossState.isSpawned = true;
        chaosBossState.maxHp = balancedHp;
        chaosBossState.hp = balancedHp;
        chaosBossState.hasChest = false;
        saveBossState();
    }

    updateChaosAbyssUI();
    openGameScreen('chaos-abyss-screen');
}

function saveBossState() {
    localStorage.setItem('rpg_chaos_boss', JSON.stringify(chaosBossState));
}

setInterval(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    if (minutes === 0 && seconds === 0) {
        let playerAttack = (activePlayer && activePlayer.attack) ? activePlayer.attack : 15000;
        let balancedHp = playerAttack * 15;

        chaosBossState.isSpawned = true;
        chaosBossState.maxHp = balancedHp;
        chaosBossState.hp = balancedHp;
        chaosBossState.hasChest = false;
        saveBossState();
        
        const abyssScr = document.getElementById('chaos-abyss-screen');
        if (abyssScr && !abyssScr.classList.contains('hidden')) {
            updateChaosAbyssUI();
        }
    }

    const abyssScreen = document.getElementById('chaos-abyss-screen');
    if (abyssScreen && !abyssScreen.classList.contains('hidden')) {
        const nextHourSeconds = 3600 - (minutes * 60 + seconds);
        const displayMin = Math.floor(nextHourSeconds / 60);
        const displaySec = nextHourSeconds % 60;
        const formattedTime = `${displayMin}:${displaySec < 10 ? '0' + displaySec : displaySec}`;

        const timerText = document.getElementById('abyss-timer-text');
        if (timerText) {
            if (chaosBossState.isSpawned) {
                timerText.innerHTML = `⚠️ <span style="color: #ff3c3c; font-weight: bold;">ЧЁРНЫЙ ДРАКОН В БЕЗДНЕ!</span> До ухода дракона: <b>${formattedTime}</b>`;
            } else {
                timerText.innerHTML = `Дракон повержен. Возрождение через: <b>${formattedTime}</b>`;
            }
        }
    }

    // Обновляем обратный отсчёт активации алтарей, если открыта Башня Клана
    const towerScreen = document.getElementById('clan-tower-screen');
    if (towerScreen && !towerScreen.classList.contains('hidden') && activePlayer && activePlayer.clanName && activeClan) {
        updateClanTowerUI();
    }
}, 1000);

function updateChaosAbyssUI() {
    const contentZone = document.getElementById('abyss-content');
    if (!contentZone) return;

    if (chaosBossState.hasChest) {
        contentZone.innerHTML = `
            <div class="reward-chest-zone" style="text-align: center; padding: 15px; background: #1a150d; border: 1px solid #ffd700; border-radius: 4px;">
                <h3 style="color: #ffd700; margin: 0 0 5px 0; font-size: 16px;">⚔️ Дракон Повержен!</h3>
                <p style="font-size: 12px; color: #ccc; margin: 0 0 15px 0;">Из пепла поверженного ящера появился древний сундук.</p>
                <img src="syndyk.jpg" alt="Сундук" style="max-width: 140px; border-radius: 4px; box-shadow: 0 0 15px #ffd700; margin-bottom: 15px;">
                <div>
                    <button class="btn btn-primary" style="background: #cc7a00; border-color: #ff9900; animation: bounce 2s infinite;" onclick="openAbyssChest()">🎁 Открыть Сундук</button>
                </div>
            </div>
        `;
        return;
    }

    if (chaosBossState.isSpawned && chaosBossState.hp > 0) {
        contentZone.innerHTML = `
            <div class="boss-zone">
                <div class="monster-bar" style="background: #2a0a0a; border: 1px solid #ff3c3c; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <div class="monster-title" style="color: #ff3c3c; font-weight: bold; font-size: 15px;">🐉 ЧЁРНЫЙ ДРАКОН (Рейд-Босс)</div>
                    <div style="font-size: 13px; font-weight: bold; color: #fff;">❤️ <span id="abyss-boss-hp">${formatNum(chaosBossState.hp)}</span> / ${formatNum(chaosBossState.maxHp)}</div>
                </div>
                <div class="image-container" style="position: relative;">
                    <img src="${chaosBossState.image}" alt="Дракон" class="main-image" style="border: 2px solid #ff3c3c; border-radius: 4px; max-width: 100%;">
                </div>
                <div class="game-buttons" style="margin-top: 15px;">
                    <button class="btn btn-attack" style="background: #a30000; border-color: #ff3c3c; padding: 12px; font-size: 16px;" onclick="attackAbyssBoss()">⚔️ Нанести удар!</button>
                </div>
                <p style="font-size: 11px; color: #aaa; margin-top: 10px;">Каждый удар требует 2 энергии. Награда: Опыт, Серебро и Сундук золота!</p>
            </div>
        `;
        return;
    }

    contentZone.innerHTML = `
        <div style="padding: 30px 10px; background: #0f0f0f; border: 1px solid #333; border-radius: 4px; text-align: center;">
            <p style="font-size: 14px; color: #888; margin: 0 0 5px 0;">🌌 В Бездне сейчас пусто...</p>
            <p style="font-size: 11px; color: #555; margin: 0;">Чёрный Дракон повержен в этом часу. Дождитесь начала следующего часа!</p>
        </div>
    `;
}

function attackAbyssBoss() {
    if (!activePlayer || !chaosBossState.isSpawned || chaosBossState.hp <= 0) return;

    if (activePlayer.energy < 2) {
        showGameAlert("У вас недостаточно энергии для удара! Требуется 2 ⚡");
        return;
    }

    // Тратим 2 энергии и засчитываем в квест расхода энергии
    activePlayer.energy -= 2;
    addQuestProgress("energy_spend", 2);

    let playerDmg = Math.floor(Math.random() * 6) + Math.floor(activePlayer.attack * 0.8);
    chaosBossState.hp = Math.max(0, chaosBossState.hp - playerDmg);

    if (chaosBossState.hp <= 0) {
        chaosBossState.isSpawned = false;
        chaosBossState.hp = 0;
        chaosBossState.hasChest = true;
        saveBossState();

        // КВЕСТ: Убить Дракона в Бездне Хаоса 1 раз
        addQuestProgress("abyss_kill", 1);

        activePlayer.exp += chaosBossState.expReward;
        activePlayer.silver += chaosBossState.silverReward;
        
        checkMultiLevelUp();
        saveData();
        updateGameUI();
        updateChaosAbyssUI();

        showGameAlert(`💥 <b>Победа!</b> Вы уничтожили Чёрного Дракона!<br><br>Получено: +${formatNum(chaosBossState.expReward)} Опыта и +${formatNum(chaosBossState.silverReward)} Серебра! Из его пасти выпал загадочный сундук.`);
    } else {
        saveBossState();
        updateGameUI();
        
        const hpSpan = document.getElementById('abyss-boss-hp');
        if (hpSpan) hpSpan.innerText = formatNum(chaosBossState.hp);
        
        showDamageAnimation(playerDmg);
    }
}

function openAbyssChest() {
    if (!activePlayer || !chaosBossState.hasChest) return;

    const minGold = 1000000;
    const maxGold = 15000000;
    const randomGold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;

    activePlayer.silver += randomGold;
    chaosBossState.hasChest = false;

    saveBossState();
    saveData();
    updateGameUI();
    updateChaosAbyssUI();

    showGameAlert(`🎁 <b>Сундук Бездны открыт!</b><br><br>Вы обнаружили в сундуке невероятное сокровище:<br><span style="color:#ffd700; font-size:16px; font-weight:bold;">🪙 ${formatNum(randomGold)} серебра</span>!`);
}

/**
 * =======================================================================
 * ЛОКАЦИЯ: АРЕНА ХАОСА (СИСТЕМА БОТОВ-ГЛАДИАТОРОВ В СТИЛЕ XAOS.MOBI)
 * =======================================================================
 */

let currentArenaBot = null;

const botPrefixes = ["[UA]", "[RU]", "[BOSS]", "[VIP]", "[HERO]", "Грозный", "Дикий", "Падший", "Стальной", "Тёмный", "Кровавый", "Мрачный", "Бессмертный", "Яростный", "Древний"];
const botNames = ["Pantyusha", "Slayer", "Shadow", "Warlock", "Paladin", "Grom", "Volk", "Titan", "Viking", "Berserk", "Dragon", "Phoenix", "Centurion", "Archon", "Ranger"];

function openArenaScreen() {
    if (!activePlayer) return;
    if (activePlayer.level < ARENA_REQ_LEVEL) {
        showGameAlert(`🏟️ Арена Хаоса откроется на ${ARENA_REQ_LEVEL} уровне персонажа. Продолжайте проходить локации и качайте уровень!`);
        return;
    }

    const pAvatar = document.getElementById('arena-player-avatar');
    if (pAvatar) pAvatar.src = activePlayer.avatarData || "profile.jpg";
    
    const pName = document.getElementById('arena-player-name');
    if (pName) pName.innerText = activePlayer.username;

    if (!currentArenaBot) {
        generateArenaBot();
    }

    updateArenaUI();
    openGameScreen('arena-screen');
}

function generateArenaBot() {
    const randomPrefix = botPrefixes[Math.floor(Math.random() * botPrefixes.length)];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    const fullName = `${randomPrefix} ${randomName}`;

    const botLvl = Math.max(1, activePlayer.level + Math.floor(Math.random() * 5) - 2); 
    
    const botHp = 1000 + (botLvl * 120);
    const botAttack = 15 + (botLvl * 1100);
    const botDefense = 10 + (botLvl * 550);

    const expReward = 20 + (botLvl * 5);
    const silverReward = 10 + (botLvl * 8);

    currentArenaBot = {
        name: fullName,
        level: botLvl,
        hp: botHp,
        maxHp: botHp,
        attack: botAttack,
        defense: botDefense,
        exp: expReward,
        silver: silverReward,
        avatar: "profile.jpg"
    };
}

function updateArenaUI() {
    if (!currentArenaBot) return;

    document.getElementById('arena-bot-name').innerText = `${currentArenaBot.name} [${currentArenaBot.level}]`;
    document.getElementById('arena-bot-fullname').innerText = `🏆 ${currentArenaBot.name} (${currentArenaBot.level} ур.)`;
    document.getElementById('arena-bot-attack').innerText = formatNum(currentArenaBot.attack);
    document.getElementById('arena-bot-hp').innerText = `${formatNum(currentArenaBot.hp)} / ${formatNum(currentArenaBot.maxHp)}`;
    document.getElementById('arena-bot-defense').innerText = formatNum(currentArenaBot.defense);

    const energyPrice = getEnergyPrice(activePlayer.level);
    document.getElementById('arena-energy-price').innerText = formatNum(energyPrice);

    updateArenaAutoBattleButton();
}

function attackArenaBot() {
    if (!activePlayer || !currentArenaBot) return;
    const logBox = document.getElementById('arena-log');

    if (activePlayer.energy < 5) {
        let currentPrice = getEnergyPrice(activePlayer.level);
        logBox.innerHTML = `<span style="color: #ff4d4d; font-weight: bold;">Недостаточно энергии!</span><br>
        <button class="btn btn-primary" style="margin-top: 8px; padding: 6px 12px; font-size: 12px; width: auto;" onclick="buyArenaEnergy()">🔋 Восстановить энергию за ${formatNum(currentPrice)} 🪙</button>`;
        logBox.className = "log-error";
        logBox.classList.remove('hidden');
        return;
    }

    // Тратим 5 энергии, засчитываем в квест расхода энергии
    activePlayer.energy -= 5;
    addQuestProgress("energy_spend", 5);

    logBox.className = "";
    logBox.classList.remove('hidden');

    let playerDamage = Math.floor(Math.random() * 6) + Math.floor(activePlayer.attack * 0.8);
    let finalPlayerDamage = Math.max(1, playerDamage - Math.floor(currentArenaBot.defense * 0.2));
    
    currentArenaBot.hp = Math.max(0, currentArenaBot.hp - finalPlayerDamage);

    let fightLog = "";

    if (currentArenaBot.hp <= 0) {
        // КВЕСТ: Победить 100 игроков на арене
        addQuestProgress("arena", 1);

        // УЧИТЫВАЕМ БОНУС К ОПЫТУ ОТ АЛТАРЯ МУДРОСТИ КЛАНА (+2% ЗА УРОВЕНЬ) — только если активирован и срок не истёк
        let expBonusPercent = 0;
        let clan = null;
        
        if (activePlayer.clanName && activeClan) {
            clan = activeClan;
            if (clan.altarWisdom && isAltarActive(clan, 'altarWisdom')) {
                expBonusPercent = clan.altarWisdom * 2;
            }
        }
        let finalBotExp = Math.floor(currentArenaBot.exp * (1 + expBonusPercent / 100));

        activePlayer.exp += finalBotExp;
        activePlayer.silver += currentArenaBot.silver;
        
        let levelUpOccurred = checkMultiLevelUp();

        // НАЧИСЛЕНИЕ ОПЫТА КЛАНУ ЗА АРЕНУ И ПЕРЕСЧЕТ УРОВНЯ
        if (activePlayer.clanName && clan) {
            if (clan.exp === undefined) clan.exp = 0;
            if (clan.level === undefined) clan.level = 1;

            // Добавляем опыт в копилку клана
            clan.exp += finalBotExp;

            // Считаем уровень клана по новой формуле
            let reqClanExp = getRequiredClanExp(clan.level);
            let clanLevelUp = false;

            while (clan.exp >= reqClanExp) {
                clan.exp -= reqClanExp; 
                clan.level += 1; 
                reqClanExp = getRequiredClanExp(clan.level);
                clanLevelUp = true;
            }

            // Записываем опыт в личную статистику вклада
            if (!clan.stats) clan.stats = {};
            if (!clan.stats[activePlayer.username]) {
                clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
            }
            if (clan.stats[activePlayer.username].exp === undefined) {
                clan.stats[activePlayer.username].exp = 0;
            }
            clan.stats[activePlayer.username].exp += finalBotExp;

            // Сохраняем клан локально
            saveActiveClan();

            // Выводим сообщение об апе клана на Арене
            if (clanLevelUp) {
                fightLog += `<div style="color: #df7fe0; font-weight: bold; margin-top: 5px;">🏰 Уровень Клана повышен до ${clan.level}! 🏰</div>`;
            }
        }

        saveData();
        updateGameUI();

        fightLog = `<div style="color: #4de64d; font-weight: bold;">⚔️ Нанесено урона: ${formatNum(finalPlayerDamage)}. Соперник повержен!</div>
                    <div style="color: #ffae19; font-size: 11px; margin-top: 3px;">+${formatNum(finalBotExp)} Опыт | +${formatNum(currentArenaBot.silver)} Серебро</div>` + fightLog;
        
        if (levelUpOccurred) {
            fightLog += `<div class="lvl-up-text" style="margin-top: 4px;">⭐ Новый уровень! ⭐</div>`;
        }

        // Обновляем статистику вкладов
        const statsBlock = document.getElementById('clan-stats-block');
        if (statsBlock && !statsBlock.classList.contains('hidden')) {
            renderClanStats();
        }

        generateArenaBot();
    } else {
        let botDamage = Math.floor(Math.random() * 5) + Math.floor(currentArenaBot.attack * 0.8);
        let finalBotDamage = Math.max(1, botDamage - activePlayer.defense);
        
        activePlayer.hp = Math.max(0, activePlayer.hp - finalBotDamage);
        saveData();
        updateGameUI();

        if (activePlayer.hp <= 0) {
            fightLog = `<div style="color: #ff4d4d; font-weight: bold;">💀 Вы проиграли бой против ${currentArenaBot.name}!</div>
                        <div style="color: #888; font-size: 11px; margin-top: 3px;">Ваши раны затягиваются...</div>`;
            generateArenaBot();
        } else {
            fightLog = `<div style="color: #4de64d;">Вы ударили соперника на <span style="font-weight:bold;">${formatNum(finalPlayerDamage)}</span> ХП.</div>
                        <div style="color: #ff4d4d;">Соперник нанёс вам <span style="font-weight:bold;">${formatNum(finalBotDamage)}</span> урона.</div>`;
        }
    }

    logBox.innerHTML = fightLog;
    updateArenaUI();
}

function buyArenaEnergy() {
    if (!activePlayer) return;
    const price = getEnergyPrice(activePlayer.level);
    const logBox = document.getElementById('arena-log');

    if (activePlayer.silver < price) {
        showGameAlert("У вас недостаточно серебра для покупки энергии!");
        return;
    }

    activePlayer.silver -= price;
    activePlayer.energy = activePlayer.maxEnergy;
    saveData();
    updateGameUI();

    if (logBox) {
        logBox.innerHTML = `<span style="color: #7fe099; font-weight: bold;">⚡ Энергия успешно восстановлена до максимума!</span>`;
        logBox.className = "log-success";
        logBox.classList.remove('hidden');
    }
    
    updateArenaUI();
}

/**
 * =======================================================================
 * АВТОБОЙ НА АРЕНЕ (за золото, на 15 минут)
 * Платная услуга: игрок нанимает "авто-бойца", который сам атакует ботов
 * на арене на протяжении 15 минут. Цена зависит от уровня игрока. Если во
 * время автобоя заканчивается энергия — она автоматически докупается за
 * серебро (баланс: автобой не бесконечный, останавливается, если серебра
 * не хватает на восстановление энергии). Игрок может остановить автобой
 * вручную в любой момент, повторно нажав на кнопку.
 * =======================================================================
 */
let arenaAutoBattleInterval = null;
let arenaAutoBattleCountdownInterval = null;
const ARENA_AUTOBATTLE_DURATION_MS = 15 * 60 * 1000;
const ARENA_AUTOBATTLE_TICK_MS = 1000; // удар раз в секунду

function getAutoBattlePrice(level) {
    // Цена найма растёт с уровнем — на высоких уровнях бот на арене даёт больше
    // серебра/опыта за удар, поэтому и наём должен стоить дороже (баланс экономики).
    return 800 + (level * level * 20);
}

function startArenaAutoBattle() {
    if (!activePlayer) return;
    if (arenaAutoBattleInterval) { showGameAlert("Автобой уже активен!"); return; }

    const price = getAutoBattlePrice(activePlayer.level);
    if (activePlayer.silver < price) {
        showGameAlert(`Недостаточно серебра для найма авто-бойца! Нужно ${formatNum(price)} 🪙`);
        return;
    }
    if (activePlayer.energy < 5) {
        showGameAlert("Недостаточно энергии, чтобы начать автобой! Сначала восстановите энергию.");
        return;
    }

    activePlayer.silver -= price;
    activePlayer.arenaAutoBattleEnd = Date.now() + ARENA_AUTOBATTLE_DURATION_MS;
    saveData(); updateGameUI();

    const logBox = document.getElementById('arena-log');
    if (logBox) {
        logBox.innerHTML = `<span style="color:#7fe099; font-weight:bold;">🤖 Автобой запущен на 15 минут! Если энергия закончится — она будет докупаться автоматически, пока хватает серебра.</span>`;
        logBox.className = "log-success"; logBox.classList.remove('hidden');
    }

    arenaAutoBattleInterval = setInterval(arenaAutoBattleTick, ARENA_AUTOBATTLE_TICK_MS);
    arenaAutoBattleCountdownInterval = setInterval(updateArenaAutoBattleButton, 1000);
    updateArenaAutoBattleButton();
}

// Игрок сам нажимает на активную кнопку автобоя, чтобы остановить его досрочно
function cancelArenaAutoBattle() {
    if (!activePlayer || !activePlayer.arenaAutoBattleEnd) return;
    showGameConfirm("Остановить автобой досрочно? Потраченное на найм серебро не возвращается.", function() {
        stopArenaAutoBattle("🛑 Автобой остановлен вручную.");
    });
}

function arenaAutoBattleTick() {
    if (!activePlayer || !activePlayer.arenaAutoBattleEnd) { stopArenaAutoBattle(); return; }

    if (Date.now() >= activePlayer.arenaAutoBattleEnd) {
        stopArenaAutoBattle("⏱️ Время автобоя истекло.");
        return;
    }

    // Если энергия закончилась — автобой сам докупает её за серебро, чтобы не
    // останавливаться раньше времени. Останавливается только если серебра не хватает.
    if (activePlayer.energy < 5) {
        const price = getEnergyPrice(activePlayer.level);
        if (activePlayer.silver < price) {
            stopArenaAutoBattle("💰 Автобой остановлен: не хватает серебра на восстановление энергии.");
            return;
        }
        activePlayer.silver -= price;
        activePlayer.energy = activePlayer.maxEnergy;
        saveData(); updateGameUI();

        const logBox = document.getElementById('arena-log');
        if (logBox) {
            logBox.innerHTML = `<span style="color:#4da6ff; font-weight:bold;">🔋 Автобой автоматически восстановил энергию за ${formatNum(price)} 🪙</span>`;
            logBox.className = "log-success"; logBox.classList.remove('hidden');
        }
    }

    if (!currentArenaBot) generateArenaBot();
    attackArenaBot();
}

function stopArenaAutoBattle(message) {
    if (arenaAutoBattleInterval) { clearInterval(arenaAutoBattleInterval); arenaAutoBattleInterval = null; }
    if (arenaAutoBattleCountdownInterval) { clearInterval(arenaAutoBattleCountdownInterval); arenaAutoBattleCountdownInterval = null; }
    if (activePlayer) { activePlayer.arenaAutoBattleEnd = null; saveData(); }
    updateArenaAutoBattleButton();
    if (message) {
        const logBox = document.getElementById('arena-log');
        if (logBox) { logBox.innerHTML = message; logBox.className = ""; logBox.classList.remove('hidden'); }
    }
}

function updateArenaAutoBattleButton() {
    const btn = document.getElementById('arena-autobattle-btn');
    if (!btn || !activePlayer) return;

    if (activePlayer.arenaAutoBattleEnd) {
        const msLeft = activePlayer.arenaAutoBattleEnd - Date.now();
        if (msLeft <= 0) { stopArenaAutoBattle("⏱️ Время автобоя истекло."); return; }
        const mm = Math.floor(msLeft / 60000);
        const ss = Math.floor((msLeft % 60000) / 1000);
        btn.disabled = false;
        btn.classList.add('btn-attack');
        btn.onclick = cancelArenaAutoBattle;
        btn.innerText = `⏹️ Остановить автобой (${mm}:${ss < 10 ? '0' : ''}${ss})`;
    } else {
        btn.disabled = false;
        btn.classList.remove('btn-attack');
        btn.onclick = startArenaAutoBattle;
        btn.innerText = `🤖 Нанять авто-бойца (15 мин) — ${formatNum(getAutoBattlePrice(activePlayer.level))} 🪙`;
    }
}

// Если игрок перезагрузил страницу, пока автобой был активен — доигрываем оставшееся время
function resumeArenaAutoBattleIfNeeded() {
    if (!activePlayer || !activePlayer.arenaAutoBattleEnd) return;
    if (Date.now() >= activePlayer.arenaAutoBattleEnd) { activePlayer.arenaAutoBattleEnd = null; saveData(); return; }
    if (arenaAutoBattleInterval) return;
    arenaAutoBattleInterval = setInterval(arenaAutoBattleTick, ARENA_AUTOBATTLE_TICK_MS);
    arenaAutoBattleCountdownInterval = setInterval(updateArenaAutoBattleButton, 1000);
}

/**
 * =======================================================================
 * СИСТЕМА: БАШНЯ КЛАНА И КЛАНОВЫЕ АЛТАРИ (УЛУЧШЕНИЯ)
 * =======================================================================
 */

function getAltarUpgradePrice(currentLvl) {
    return 100 + (currentLvl * currentLvl * 150);
}

// Цена АКТИВАЦИИ алтаря — примерно половина цены следующего улучшения того же уровня,
// чтобы прокачка и активация были сопоставимы по вложениям и обе требовали расчёта бюджета казны.
function getAltarActivationPrice(currentLvl) {
    if (currentLvl <= 0) return 0;
    return 60 + (currentLvl * currentLvl * 75);
}

// Активированный алтарь держится включённым ограниченное время, а не навсегда —
// это превращает активацию в повторяющийся расход казны, а не разовую покупку.
const ALTAR_ACTIVE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 часов

// Проверяет, действует ли сейчас бонус алтаря: активирован ли он вообще и не истёк ли 12-часовой срок.
// Если срок истёк — тихо выключает алтарь (одноразовая запись) и возвращает false.
function isAltarActive(clan, altarKey) {
    if (!clan || !clan[altarKey + 'Active']) return false;

    const activatedAt = clan[altarKey + 'ActivatedAt'] || 0;
    const elapsed = Date.now() - activatedAt;

    if (elapsed >= ALTAR_ACTIVE_DURATION_MS) {
        clan[altarKey + 'Active'] = false;
        clan[altarKey + 'ActivatedAt'] = null;
        saveActiveClan();
        return false;
    }
    return true;
}

// Сколько миллисекунд осталось до истечения активации алтаря (0, если уже неактивен/истёк).
function getAltarRemainingMs(clan, altarKey) {
    if (!clan || !clan[altarKey + 'Active']) return 0;
    const activatedAt = clan[altarKey + 'ActivatedAt'] || 0;
    const remaining = ALTAR_ACTIVE_DURATION_MS - (Date.now() - activatedAt);
    return remaining > 0 ? remaining : 0;
}

// Форматирует миллисекунды в "Хч Ym" для отображения игроку.
function formatAltarDuration(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
}

function openClanTower() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    // Безопасно находим элемент в HTML-документе перед проверкой
    const msgBox = document.getElementById('tower-msg');
    if (msgBox) {
        msgBox.classList.add('hidden');
        msgBox.innerHTML = "";
    }

    if (clan.altarWar === undefined) clan.altarWar = 0;
    if (clan.altarWisdom === undefined) clan.altarWisdom = 0;
    if (clan.altarWealth === undefined) clan.altarWealth = 0;
    if (clan.altarSupremacy === undefined) clan.altarSupremacy = 0;
    if (clan.altarWarActive === undefined) clan.altarWarActive = false;
    if (clan.altarWisdomActive === undefined) clan.altarWisdomActive = false;
    if (clan.altarWealthActive === undefined) clan.altarWealthActive = false;
    if (clan.altarSupremacyActive === undefined) clan.altarSupremacyActive = false;
    // Если алтарь уже был активирован до появления таймера — даём ему полные 12 часов от текущего момента,
    // а не гасим мгновенно из-за отсутствия отметки времени.
    ['altarWar', 'altarWisdom', 'altarWealth', 'altarSupremacy'].forEach(key => {
        if (clan[key + 'Active'] && !clan[key + 'ActivatedAt']) {
            clan[key + 'ActivatedAt'] = Date.now();
        }
    });
    saveActiveClan();

    updateClanTowerUI();
    openGameScreen('clan-tower-screen');
}

function updateClanTowerUI() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    document.getElementById('tower-clan-gold').innerText = formatNum(clan.gold);

    // 1. Алтарь Войны (+1% статы)
    const warLvl = clan.altarWar || 0;
    const warPrice = getAltarUpgradePrice(warLvl);
    document.getElementById('altar-lvl-war').innerText = warLvl;
    document.getElementById('altar-bonus-war').innerText = warLvl * 1;
    document.getElementById('altar-price-war').innerText = formatNum(warPrice);
    updateAltarActivationUI('altarWar', 'war');

    // 2. Алтарь Мудрости (+2% опыт)
    const wisLvl = clan.altarWisdom || 0;
    const wisPrice = getAltarUpgradePrice(wisLvl);
    document.getElementById('altar-lvl-wisdom').innerText = wisLvl;
    document.getElementById('altar-bonus-wisdom').innerText = wisLvl * 2;
    document.getElementById('altar-price-wisdom').innerText = formatNum(wisPrice);
    updateAltarActivationUI('altarWisdom', 'wisdom');

    // 3. Алтарь Богатства (+1 к клику)
    const weaLvl = clan.altarWealth || 0;
    const weaPrice = getAltarUpgradePrice(weaLvl);
    document.getElementById('altar-lvl-wealth').innerText = weaLvl;
    document.getElementById('altar-bonus-wealth').innerText = weaLvl;
    document.getElementById('altar-price-wealth').innerText = formatNum(weaPrice);
    updateAltarActivationUI('altarWealth', 'wealth');

    // 4. Алтарь Превосходства (+1 к добыче серебра за убийство на Превосходстве)
    const supLvl = clan.altarSupremacy || 0;
    const supPrice = getAltarUpgradePrice(supLvl);
    document.getElementById('altar-lvl-supremacy').innerText = supLvl;
    document.getElementById('altar-bonus-supremacy').innerText = supLvl;
    document.getElementById('altar-price-supremacy').innerText = formatNum(supPrice);
    updateAltarActivationUI('altarSupremacy', 'supremacy');
}

// Обновляет блок статуса/кнопки активации одного алтаря.
// altarKey — ключ в объекте клана (altarWar/altarWisdom/altarWealth), domSuffix — суффикс id в HTML (war/wisdom/wealth)
function updateAltarActivationUI(altarKey, domSuffix) {
    const clan = activeClan;
    const level = clan[altarKey] || 0;
    const isActive = isAltarActive(clan, altarKey); // сам проверяет и гасит истёкшую активацию

    const statusEl = document.getElementById('altar-status-' + domSuffix);
    const btn = document.getElementById('btn-toggle-' + domSuffix);
    if (!statusEl || !btn) return;

    if (level <= 0) {
        statusEl.innerHTML = '⚪ Нет уровня — сначала улучшите алтарь';
        btn.innerText = 'Нечего активировать';
        btn.disabled = true;
        btn.onclick = null;
        return;
    }

    if (isActive) {
        const remainingMs = getAltarRemainingMs(clan, altarKey);
        statusEl.innerHTML = `🟢 Активен — осталось ${formatAltarDuration(remainingMs)}`;
        btn.innerText = 'Отключить';
        btn.disabled = false;
        btn.onclick = function () { deactivateAltar(altarKey); };
    } else {
        const activationPrice = getAltarActivationPrice(level);
        statusEl.innerHTML = '🔴 Отключен — бонус НЕ действует';
        btn.innerText = 'Активировать за ' + formatNum(activationPrice) + ' 🟡';
        btn.disabled = false;
        btn.onclick = function () { activateAltar(altarKey); };
    }
}

function upgradeAltar(altarKey) {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    const msgBox = document.getElementById('tower-msg');

    if (clan.owner !== activePlayer.username) {
        if (msgBox) {
            msgBox.innerHTML = "❌ Только Владыка Клана может пробуждать силу Алтарей!";
            msgBox.className = "log-error"; 
            msgBox.classList.remove('hidden');
        }
        return;
    }

    const currentLvl = clan[altarKey] || 0;
    const price = getAltarUpgradePrice(currentLvl);

    if (clan.gold < price) {
        if (msgBox) {
            msgBox.innerHTML = `❌ Недостаточно Золота! Требуется ${formatNum(price)} 🟡`;
            msgBox.className = "log-error"; 
            msgBox.classList.remove('hidden');
        }
        return;
    }

    clan.gold -= price;
    clan[altarKey] = currentLvl + 1;

    saveActiveClan();

    calculateStats();
    updateClanTowerUI();
    updateClanUI();

    if (msgBox) {
        let altarName = "Алтарь";
        if (altarKey === 'altarWar') altarName = "🔥 Алтарь Войны";
        if (altarKey === 'altarWisdom') altarName = "🔮 Алтарь Мудрости";
        if (altarKey === 'altarWealth') altarName = "⛏️ Алтарь Богатства";
        if (altarKey === 'altarSupremacy') altarName = "👑 Алтарь Превосходства";

        msgBox.innerHTML = `✔️ ${altarName} успешно пробужден до уровня ${currentLvl + 1}!`;
        msgBox.className = "log-success"; 
        msgBox.classList.remove('hidden');
    }
}

function getAltarDisplayName(altarKey) {
    if (altarKey === 'altarWar') return "🔥 Алтарь Войны";
    if (altarKey === 'altarWisdom') return "🔮 Алтарь Мудрости";
    if (altarKey === 'altarWealth') return "⛏️ Алтарь Богатства";
    if (altarKey === 'altarSupremacy') return "👑 Алтарь Превосходства";
    return "Алтарь";
}

// Активирует алтарь за золото клана — без активации улучшенный алтарь бонуса НЕ даёт.
function activateAltar(altarKey) {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;
    const msgBox = document.getElementById('tower-msg');

    if (clan.owner !== activePlayer.username) {
        if (msgBox) {
            msgBox.innerHTML = "❌ Только Владыка Клана может активировать Алтари!";
            msgBox.className = "log-error";
            msgBox.classList.remove('hidden');
        }
        return;
    }

    const level = clan[altarKey] || 0;
    if (level <= 0) {
        if (msgBox) {
            msgBox.innerHTML = "❌ Сначала улучшите алтарь хотя бы до 1 уровня!";
            msgBox.className = "log-error";
            msgBox.classList.remove('hidden');
        }
        return;
    }

    if (clan[altarKey + 'Active']) return; // уже активен

    const price = getAltarActivationPrice(level);
    if (clan.gold < price) {
        if (msgBox) {
            msgBox.innerHTML = `❌ Недостаточно Золота для активации! Требуется ${formatNum(price)} 🟡`;
            msgBox.className = "log-error";
            msgBox.classList.remove('hidden');
        }
        return;
    }

    clan.gold -= price;
    clan[altarKey + 'Active'] = true;
    clan[altarKey + 'ActivatedAt'] = Date.now();

    saveActiveClan();
    calculateStats();
    updateClanTowerUI();
    updateClanUI();

    if (msgBox) {
        msgBox.innerHTML = `✔️ ${getAltarDisplayName(altarKey)} пробуждён и активирован! Бонус теперь действует на весь клан.`;
        msgBox.className = "log-success";
        msgBox.classList.remove('hidden');
    }
}

// Отключает алтарь (бесплатно) — бонус перестаёт действовать до повторной активации за золото.
function deactivateAltar(altarKey) {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;
    const msgBox = document.getElementById('tower-msg');

    if (clan.owner !== activePlayer.username) {
        if (msgBox) {
            msgBox.innerHTML = "❌ Только Владыка Клана может управлять Алтарями!";
            msgBox.className = "log-error";
            msgBox.classList.remove('hidden');
        }
        return;
    }

    if (!clan[altarKey + 'Active']) return; // уже отключен

    clan[altarKey + 'Active'] = false;
    clan[altarKey + 'ActivatedAt'] = null;

    saveActiveClan();
    calculateStats();
    updateClanTowerUI();
    updateClanUI();

    if (msgBox) {
        msgBox.innerHTML = `⚠️ ${getAltarDisplayName(altarKey)} отключен. Бонус клана больше не действует.`;
        msgBox.className = "log-error";
        msgBox.classList.remove('hidden');
    }
}

/**
 * =======================================================================
 * СИСТЕМА: СТАТИСТИКА ВКЛАДА УЧАСТНИКОВ КЛАНА (ОБНУЛЯЕМАЯ)
 * =======================================================================
 */

function toggleClanStats() {
    const block = document.getElementById('clan-stats-block');
    if (!block) return;

    if (block.classList.contains('hidden')) {
        block.classList.remove('hidden');
        renderClanStats();
    } else {
        block.classList.add('hidden');
    }
}

function renderClanStats() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    const statsList = document.getElementById('clan-stats-list');
    const resetContainer = document.getElementById('clan-reset-stats-container');
    if (!statsList) return;

    statsList.innerHTML = "";

    if (!clan.stats) clan.stats = {};

    // Список участников — те, у кого есть записи вклада в казну клана
    const members = Object.keys(clan.stats).length > 0 ? Object.keys(clan.stats) : [activePlayer.username];

    members.forEach(memberUsername => {
        if (!clan.stats[memberUsername]) {
            clan.stats[memberUsername] = { gold: 0, exp: 0 };
        }

        const mStats = clan.stats[memberUsername];
        const isOwner = clan.owner === memberUsername;

        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #1c1c1c";
        row.innerHTML = `
            <td style="padding: 6px 4px; color: ${isOwner ? '#ffae19' : '#fff'}; font-weight: ${isOwner ? 'bold' : 'normal'};">
                ${escapeHTML(memberUsername)} ${isOwner ? '👑' : ''}
            </td>
            <td style="padding: 6px 4px; text-align: right; color: #ffd700; font-weight: bold;">
                ${formatNum(mStats.gold)}
            </td>
            <td style="padding: 6px 4px; text-align: right; color: #e0b0ff; font-weight: bold;">
                ${formatNum(mStats.exp)}
            </td>
        `;
        statsList.appendChild(row);
    });

    if (resetContainer) {
        if (clan.owner === activePlayer.username) {
            resetContainer.classList.remove('hidden');
        } else {
            resetContainer.classList.add('hidden');
        }
    }
}

function resetClanStats() {
    if (!activePlayer || !activePlayer.clanName || !activeClan) return;
    const clan = activeClan;

    if (clan.owner !== activePlayer.username) {
        showGameAlert("Только Владыка Клана имеет право стирать летопись вкладов!");
        return;
    }

    showGameConfirm("Вы действительно хотите обнулить показатели вклада (золота и опыта) всех участников? Это действие необратимо.", function() {
        clan.stats = {};
        clan.stats[activePlayer.username] = { gold: 0, exp: 0 };

        saveActiveClan();
        renderClanStats();
        showGameAlert("📈 Статистика вкладов успешно обнулена! Начат новый цикл активности.");
    });
}

/**
 * =======================================================================
 * СИСТЕМА: ЕЖЕДНЕВНЫЕ ЗАДАНИЯ (КВЕСТЫ) И НАГРАДНЫЕ СУНДУКИ
 * =======================================================================
 */

const questTemplates = [
    { id: "arena_fights", text: "Победить 100 игроков на арене", target: 100, type: "arena" },
    { id: "equipment_upgrades", text: "Улучшить экипировку 10 раз", target: 10, type: "training" },
    { id: "abyss_kills", text: "Убить Дракона в Бездне Хаоса 1 раз", target: 1, type: "abyss_kill" },
    { id: "dungeon_bosses", text: "Сходить в подземелье и убить там 5 монстров", target: 5, type: "dungeons" },
    { id: "mine_clicks", text: "Ударить киркой 20 раз в Шахте клана", target: 20, type: "mine" },
    { id: "monster_kills", text: "Пройти 12 монстров в Приключении", target: 12, type: "monsters" },
    { id: "clan_deposit", text: "Положить в клан золото 10к", target: 10000, type: "clan_deposit" },
    { id: "energy_spend", text: "Потратить энергию 1к", target: 1000, type: "energy_spend" }
];

function openQuestsScreen() {
    if (!activePlayer) return;
    
    // Инициализируем объект квестов, если его еще нет или наступил новый день
    const today = getKyivDateString();
    if (!activePlayer.quests || activePlayer.quests.date !== today) {
        generateDailyQuests(today);
    }

    renderQuests();
    openGameScreen('quests-screen');
}

function generateDailyQuests(dateString) {
    activePlayer.quests = {
        date: dateString,
        superClaimed: false,
        list: questTemplates.map(q => ({
            id: q.id,
            text: q.text,
            target: q.target,
            progress: 0,
            claimed: false,
            type: q.type
        }))
    };
    saveData();
}

function renderQuests() {
    const listContainer = document.getElementById('quests-list');
    if (!listContainer) return;

    listContainer.innerHTML = "";
    let allCompleted = true;

    activePlayer.quests.list.forEach((q, idx) => {
        const percent = Math.min(100, (q.progress / q.target) * 100);
        const isCompleted = q.progress >= q.target;
        
        if (!isCompleted) allCompleted = false;

        let actionBtn = "";
        if (isCompleted && !q.claimed) {
            actionBtn = `<button class="btn" style="background: #28a745; color: white; width: auto; font-size: 12px; padding: 5px 10px;" onclick="claimQuestReward(${idx})">🎁 Забрать 100к</button>`;
        } else if (q.claimed) {
            actionBtn = `<span style="color: #6c757d; font-size: 12px; font-weight: bold;">✔️ Получено</span>`;
        } else {
            actionBtn = `<span style="color: #aaa; font-size: 12px;">Прогресс: ${formatNum(q.progress)}/${formatNum(q.target)}</span>`;
        }

        listContainer.innerHTML += `
            <div style="background: #161616; border: 1px solid #2d2d2d; border-radius: 4px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex-grow: 1; margin-right: 10px;">
                    <div style="font-size: 13px; font-weight: bold; color: #fff; margin-bottom: 5px;">${q.text}</div>
                    <div style="background: #222; border-radius: 10px; height: 6px; width: 80%; overflow: hidden;">
                        <div style="background: #ffd700; width: ${percent}%; height: 100%;"></div>
                    </div>
                </div>
                <div>
                    ${actionBtn}
                </div>
            </div>
        `;
    });

    const superBtn = document.getElementById('super-chest-btn');
    const superText = document.getElementById('super-chest-status-text');

    if (activePlayer.quests.superClaimed) {
        superBtn.disabled = true;
        superBtn.innerText = "✔️ Получено!";
        superBtn.style.background = "#6c757d";
        superText.innerHTML = `<span style="color: #28a745; font-weight: bold;">🎉 Вы выполнили все поручения на сегодня!</span>`;
    } else if (allCompleted) {
        superBtn.disabled = false;
        superBtn.innerText = "🎁 Открыть Супер-Сундук!";
        superBtn.style.background = "#cc7a00";
        superText.innerHTML = `<span style="color: #ffd700; font-weight: bold;">🔥 Все задания выполнены! Заберите награду!</span>`;
    } else {
        superBtn.disabled = true;
        superBtn.innerText = "🔒 Супер-Сундук (1м)";
        superBtn.style.background = "#333";
        superText.innerText = "Выполните все 8 заданий, чтобы разблокировать сундук!";
    }
}

function addQuestProgress(type, amount) {
    if (!activePlayer) return;
    
    // Безопасная инициализация квестов, если наступил новый день
    const today = getKyivDateString();
    if (!activePlayer.quests || activePlayer.quests.date !== today) {
        generateDailyQuests(today);
    }

    let progressChanged = false;

    // Проходимся по каждому квесту независимо!
    for (let i = 0; i < activePlayer.quests.list.length; i++) {
        let q = activePlayer.quests.list[i];
        
        // Засчитываем прогресс только если совпал тип И задание еще не выполнено до конца
        if (q.type === type && q.progress < q.target) {
            q.progress = Math.min(q.target, q.progress + amount);
            progressChanged = true;
        }
    }

    // Если хоть один квест изменился, мгновенно сохраняем и обновляем UI
    if (progressChanged) {
        saveData();
        
        // Если игрок сейчас смотрит на экран квестов — обновляем прогресс-бары на лету
        const scr = document.getElementById('quests-screen');
        if (scr && !scr.classList.contains('hidden')) {
            renderQuests();
        }
    }
}

function claimQuestReward(index) {
    if (!activePlayer || !activePlayer.quests) return;
    const q = activePlayer.quests.list[index];
    
    if (q.progress >= q.target && !q.claimed) {
        q.claimed = true;
        activePlayer.silver += 100000; // Награда 100 000 серебра
        saveData();
        updateGameUI();
        renderQuests();
        showGameAlert(`🎉 Вы открыли малый сундук и получили <span style="color: #ffd700; font-weight: bold;">+100 000🪙</span> серебра!`);
    }
}

function claimSuperQuestChest() {
    if (!activePlayer || !activePlayer.quests || activePlayer.quests.superClaimed) return;

    let allCompleted = activePlayer.quests.list.every(q => q.progress >= q.target);
    if (allCompleted) {
        activePlayer.quests.superClaimed = true;
        activePlayer.silver += 1000000; // Награда 1 000 000 серебра
        saveData();
        updateGameUI();
        renderQuests();
        showGameAlert(`👑 <b>НЕВЕРОЯТНО!</b><br><br>Вы открыли королевский сундук за выполнение всех заданий и получили:<br><span style="color: #ffd700; font-size: 16px; font-weight: bold;">+1 000 000🪙</span> серебра!`);
    }
}

/**
 * =======================================================================
 * СИСТЕМА: ТАБЛИЦА ЛИДЕРОВ (ИГРОКИ И КЛАНЫ)
 * =======================================================================
 * Примечание: рейтинг строится по данным, сохранённым в localStorage
 * ЭТОГО браузера — то есть по всем персонажам/кланам, когда-либо
 * созданным на этом устройстве в этом браузере.
 */

let currentLeaderboardTab = "players";

// =====================================================================
// ЛАЙКИ ПРОФИЛЯ (популярность)
// Любой другой профиль реального игрока можно лайкнуть один раз в сутки
// (по киевскому времени, как и Ежедневный Сундук). Общий счётчик лайков
// хранится в отдельном локальном реестре по нику; кто кому уже поставил
// лайк сегодня — в данных самого лайкающего игрока (likesGivenLog),
// чтобы это переживало смену сохранений и переносилось бэкапом.
// =====================================================================
function getLikesCount(username) {
    const likes = ldbRead(LOCAL_DB_KEYS.likes);
    return likes[username.toLowerCase()] || 0;
}

function hasLikedToday(targetUsername) {
    if (!activePlayer || !activePlayer.likesGivenLog) return false;
    return activePlayer.likesGivenLog[targetUsername.toLowerCase()] === getKyivDateString();
}

function likeProfile(username) {
    if (!activePlayer) return;
    const targetLower = username.toLowerCase();
    if (targetLower === activePlayer.username.toLowerCase()) {
        showGameAlert("Нельзя лайкать самого себя 😅");
        return;
    }
    if (!activePlayer.likesGivenLog) activePlayer.likesGivenLog = {};
    if (hasLikedToday(username)) return; // кнопка и так должна быть заблокирована — доп. проверка на всякий случай

    const likes = ldbRead(LOCAL_DB_KEYS.likes);
    likes[targetLower] = (likes[targetLower] || 0) + 1;
    ldbWrite(LOCAL_DB_KEYS.likes, likes);

    activePlayer.likesGivenLog[targetLower] = getKyivDateString();
    saveData();

    // Если открыта модалка просмотра профиля этого же игрока — перерисовываем её
    viewLeaderboardPlayer(username);
}

// HTML-блок кнопки лайка / статуса для карточки просмотра профиля
function renderLikeBlock(username) {
    const isSelf = activePlayer && username.toLowerCase() === activePlayer.username.toLowerCase();
    const count = getLikesCount(username);
    const safeNameAttr = escapeHTML(username).replace(/'/g, "\\'");
    if (isSelf) {
        return `<div class="like-block"><span class="like-count">❤️ ${formatNum(count)}</span></div>`;
    }
    if (hasLikedToday(username)) {
        return `<div class="like-block"><span class="like-count">❤️ ${formatNum(count)}</span><button class="btn" disabled style="width:auto; padding:6px 14px; font-size:12px; opacity:0.6; margin:0;">💗 Лайк поставлен</button></div>`;
    }
    return `<div class="like-block"><span class="like-count">❤️ ${formatNum(count)}</span><button class="btn btn-primary" style="width:auto; padding:6px 14px; font-size:12px; margin:0;" onclick="likeProfile('${safeNameAttr}')">🤍 Поставить лайк</button></div>`;
}


// Открывает карточку профиля игрока (реального или бота) из таблицы лидеров.
function viewLeaderboardPlayer(username) {
    const title = document.getElementById('pv-title');
    const body = document.getElementById('pv-body');
    if (!title || !body) return;

    const players = ldbRead(LOCAL_DB_KEYS.players);
    const row = players[username.toLowerCase()];
    if (!row || !row.data) return;

    const d = row.data;
    const regDate = d.regTimestamp ? new Date(d.regTimestamp).toLocaleDateString('ru-RU') : "—";
    const lvl = d.level || 1;
    title.innerHTML = `👤 ${escapeHTML(row.username)}`;
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:12px;"><img src="${d.avatarData || 'profile.jpg'}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #ffae19;"></div>
        ${renderLikeBlock(row.username)}
        <div>⭐ <b>Уровень:</b> ${formatNum(lvl)}</div>
        <div>✨ <b>Опыт:</b> ${formatNum(d.exp || 0)} / ${formatNum(getRequiredExp(lvl))}</div>
        <div>🪙 <b>Серебро:</b> ${formatNum(d.silver || 0)}</div>
        <div>🛡️ <b>Клан:</b> ${d.clanName ? escapeHTML(d.clanName) : "Не состоит в клане"}</div>
        <div>👤 <b>Пол:</b> ${escapeHTML(d.gender || "Не указан")}</div>
        <div>📅 <b>В игре с:</b> ${regDate}</div>
        ${d.aboutText ? `<div style="margin-top:10px;">📖 <b>О себе:</b> ${escapeHTML(d.aboutText)}</div>` : ""}
    `;

    document.getElementById('profile-view-modal').classList.remove('hidden');
}

function closeProfileViewModal() {
    document.getElementById('profile-view-modal').classList.add('hidden');
}

// Открывает карточку клана из таблицы лидеров.
function viewLeaderboardClan(clanName) {
    const title = document.getElementById('cv-title');
    const body = document.getElementById('cv-body');
    if (!title || !body) return;

    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    const row = clans[clanName.toLowerCase()];
    if (!row || !row.data) return;

    const c = row.data;
    const reqExp = getRequiredClanExp(c.level);
    const memberEntries = c.stats ? Object.keys(c.stats) : [];
    const membersHtml = memberEntries.length
        ? memberEntries.map(m => `<div style="padding:4px 0; border-bottom:1px solid #222;">${m === c.owner ? '👑' : '⚔️'} ${escapeHTML(m)}</div>`).join('')
        : `<div style="color:#888;">Пока нет данных об участниках.</div>`;
    title.innerHTML = `🛡️ ${escapeHTML(c.name)}`;
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:12px;"><img src="${c.logo || 'clan.png'}" style="width:64px;height:64px;border-radius:6px;object-fit:cover;border:2px solid #ffae19;"></div>
        <div>👑 <b>Лидер:</b> ${escapeHTML(c.owner || "—")}</div>
        <div>⭐ <b>Уровень:</b> ${formatNum(c.level)}</div>
        <div>✨ <b>Опыт:</b> ${formatNum(c.exp)} / ${formatNum(reqExp)}</div>
        <div>💰 <b>Казна:</b> ${formatNum(c.gold || 0)}</div>
        <div style="margin-top:10px;">📖 <b>О клане:</b> ${escapeHTML(c.about || "—")}</div>
        <div style="margin-top:12px; font-weight:bold; color:#ffd700;">👥 Участники (${memberEntries.length}):</div>
        <div style="max-height:150px; overflow-y:auto; margin-top:4px;">${membersHtml}</div>
    `;

    document.getElementById('clan-view-modal').classList.remove('hidden');
}

function closeClanViewModal() {
    document.getElementById('clan-view-modal').classList.add('hidden');
}



async function getAllPlayersData() {
    const players = ldbRead(LOCAL_DB_KEYS.players);
    return Object.values(players)
        .filter(row => row && row.username)
        .map(row => ({
            username: row.username,
            level: (row.data && row.data.level) || 1,
            exp: (row.data && row.data.exp) || 0,
            silver: (row.data && row.data.silver) || 0
        }));
}

async function getAllClansData() {
    const clans = ldbRead(LOCAL_DB_KEYS.clans);
    return Object.values(clans)
        .map(row => row.data)
        .filter(c => c && c.name);
}

function openLeaderboardScreen() {
    if (!activePlayer) return;
    switchLeaderboardTab(currentLeaderboardTab);
    openGameScreen('leaderboard-screen');
}

function switchLeaderboardTab(tab) {
    currentLeaderboardTab = tab;

    const btnPlayers = document.getElementById('lb-tab-players');
    const btnClans = document.getElementById('lb-tab-clans');
    const btnPopularity = document.getElementById('lb-tab-popularity');
    if (btnPlayers) btnPlayers.className = (tab === 'players') ? "btn btn-primary" : "btn btn-secondary";
    if (btnClans) btnClans.className = (tab === 'clans') ? "btn btn-primary" : "btn btn-secondary";
    if (btnPopularity) btnPopularity.className = (tab === 'popularity') ? "btn btn-primary" : "btn btn-secondary";
    if (btnPlayers) btnPlayers.style.cssText = "margin: 0; padding: 9px 4px; font-size: 12px;";
    if (btnClans) btnClans.style.cssText = "margin: 0; padding: 9px 4px; font-size: 12px;";
    if (btnPopularity) btnPopularity.style.cssText = "margin: 0; padding: 9px 4px; font-size: 12px;";

    if (tab === 'players') {
        renderPlayerLeaderboard();
    } else if (tab === 'popularity') {
        renderPopularityLeaderboard();
    } else {
        renderClanLeaderboard();
    }
}

// Таблица лидеров по популярности (лайкам профиля) среди реальных игроков этого браузера.
async function renderPopularityLeaderboard() {
    const container = document.getElementById('leaderboard-list-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Загрузка...</div>`;

    const players = await getAllPlayersData();
    if (players === null) {
        container.innerHTML = `<div style="text-align: center; color: #ff6666; font-size: 13px; padding: 20px;">Не удалось загрузить таблицу лидеров. Попробуйте позже.</div>`;
        return;
    }

    players.forEach(p => { p.likes = getLikesCount(p.username); });
    players.sort((a, b) => b.likes - a.likes);

    if (players.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Пока нет ни одного воина в этом мире.</div>`;
        return;
    }

    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    players.forEach((p, idx) => {
        const rank = idx + 1;
        const isMe = activePlayer && p.username === activePlayer.username;
        let medal = "";
        if (rank === 1) medal = "🥇";
        else if (rank === 2) medal = "🥈";
        else if (rank === 3) medal = "🥉";
        else medal = `#${rank}`;

        const safeNameAttr = escapeHTML(p.username).replace(/'/g, "\\'");
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c; cursor: pointer; ${isMe ? 'background: #1a1505;' : ''}" onclick="viewLeaderboardPlayer('${safeNameAttr}')">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <span style="font-weight: bold; width: 28px; flex-shrink: 0; text-align: center;">${medal}</span>
                    <span style="color: ${isMe ? '#ffd700' : '#4da6ff'}; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.username)}${isMe ? ' (Вы)' : ''}</span>
                </div>
                <div style="font-size: 11px; color: #aaa; text-align: right; flex-shrink: 0; margin-left: 8px;">
                    ❤️ ${formatNum(p.likes)}
                </div>
            </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

async function renderPlayerLeaderboard() {
    const container = document.getElementById('leaderboard-list-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Загрузка...</div>`;

    const players = await getAllPlayersData();
    if (players === null) {
        container.innerHTML = `<div style="text-align: center; color: #ff6666; font-size: 13px; padding: 20px;">Не удалось загрузить таблицу лидеров. Попробуйте позже.</div>`;
        return;
    }

    players.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.exp || 0) - (a.exp || 0);
    });

    if (players.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Пока нет ни одного воина в этом мире.</div>`;
        return;
    }

    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    players.forEach((p, idx) => {
        const rank = idx + 1;
        const isMe = activePlayer && p.username === activePlayer.username;
        let medal = "";
        if (rank === 1) medal = "🥇";
        else if (rank === 2) medal = "🥈";
        else if (rank === 3) medal = "🥉";
        else medal = `#${rank}`;

        const safeNameAttr = escapeHTML(p.username).replace(/'/g, "\\'");
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c; cursor: pointer; ${isMe ? 'background: #1a1505;' : ''}" onclick="viewLeaderboardPlayer('${safeNameAttr}')">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <span style="font-weight: bold; width: 28px; flex-shrink: 0; text-align: center;">${medal}</span>
                    <span style="color: ${isMe ? '#ffd700' : '#4da6ff'}; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.username)}${isMe ? ' (Вы)' : ''}</span>
                </div>
                <div style="font-size: 11px; color: #aaa; text-align: right; flex-shrink: 0; margin-left: 8px;">
                    ⭐ ${formatNum(p.level)} ур. | 🪙 ${formatNum(p.silver || 0)}
                </div>
            </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

async function renderClanLeaderboard() {
    const container = document.getElementById('leaderboard-list-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Загрузка...</div>`;

    const clans = await getAllClansData();
    if (clans === null) {
        container.innerHTML = `<div style="text-align: center; color: #ff6666; font-size: 13px; padding: 20px;">Не удалось загрузить таблицу лидеров. Попробуйте позже.</div>`;
        return;
    }

    clans.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.exp || 0) - (a.exp || 0);
    });

    if (clans.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Пока не основано ни одного клана.</div>`;
        return;
    }

    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    clans.forEach((c, idx) => {
        const rank = idx + 1;
        const isMyClan = activePlayer && activePlayer.clanName && c.name === activePlayer.clanName;
        let medal = "";
        if (rank === 1) medal = "🥇";
        else if (rank === 2) medal = "🥈";
        else if (rank === 3) medal = "🥉";
        else medal = `#${rank}`;

        const memberCount = c.stats ? Object.keys(c.stats).length : 1;
        const safeClanAttr = escapeHTML(c.name).replace(/'/g, "\\'");

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c; cursor: pointer; ${isMyClan ? 'background: #1a1505;' : ''}" onclick="viewLeaderboardClan('${safeClanAttr}')">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <span style="font-weight: bold; width: 28px; flex-shrink: 0; text-align: center;">${medal}</span>
                    <span style="color: ${isMyClan ? '#ffd700' : '#df7fe0'}; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(c.name)}${isMyClan ? ' (Ваш)' : ''}</span>
                </div>
                <div style="font-size: 11px; color: #aaa; text-align: right; flex-shrink: 0; margin-left: 8px;">
                    ⭐ ${formatNum(c.level)} ур. | 💰 ${formatNum(c.gold || 0)} | 👥 ${memberCount}
                </div>
            </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

/**
 * =======================================================================
 * СИСТЕМА: ФОРУМ ПРОЕКТА (НАВИГАЦИЯ И КАТЕГОРИИ)
 * =======================================================================
 */

function openForumScreen() {
    // 1. Показываем сам экран форума
    openGameScreen('forum-screen');
    
    // 2. Безопасно сбрасываем отображение на главные категории
    const mainCat = document.getElementById('forum-main-categories');
    const newsSec = document.getElementById('forum-news-section');
    const rulesSec = document.getElementById('forum-rules-section');
    const ideasSec = document.getElementById('forum-ideas-section');
    const breadcrumbs = document.getElementById('forum-breadcrumbs');

    if (mainCat) mainCat.classList.remove('hidden');
    if (newsSec) newsSec.classList.add('hidden');
    if (rulesSec) rulesSec.classList.add('hidden');
    if (ideasSec) ideasSec.classList.add('hidden');
    if (breadcrumbs) breadcrumbs.innerText = "";
}

function openForumCategory(category) {
    const mainCat = document.getElementById('forum-main-categories');
    const newsSec = document.getElementById('forum-news-section');
    const rulesSec = document.getElementById('forum-rules-section');
    const ideasSec = document.getElementById('forum-ideas-section');
    const breadcrumbs = document.getElementById('forum-breadcrumbs');

    if (mainCat) mainCat.classList.add('hidden');
    if (newsSec) newsSec.classList.add('hidden');
    if (rulesSec) rulesSec.classList.add('hidden');
    if (ideasSec) ideasSec.classList.add('hidden');

    if (category === 'main') {
        if (mainCat) mainCat.classList.remove('hidden');
        if (breadcrumbs) breadcrumbs.innerText = "";
    } 
    else if (category === 'news') {
        if (newsSec) newsSec.classList.remove('hidden');
        if (breadcrumbs) breadcrumbs.innerHTML = " &gt; <span style='color:#ffd700;'>Новости</span>";
    } 
    else if (category === 'rules') {
        if (rulesSec) rulesSec.classList.remove('hidden');
        if (breadcrumbs) breadcrumbs.innerHTML = " &gt; <span style='color:#ffd700;'>Правила</span>";
    } 
    else if (category === 'ideas') {
        if (ideasSec) ideasSec.classList.remove('hidden');
        if (breadcrumbs) breadcrumbs.innerHTML = " &gt; <span style='color:#ffd700;'>Идеи</span>";
        
        // Запуск отрисовки топиков, если функция объявлена
        if (typeof renderIdeas === 'function') {
            renderIdeas();
        }
    }
}

/**
 * =======================================================================
 * СИСТЕМА: РЕЖИМ "ПРЕВОСХОДСТВО КЛАНА" (ЧЕТВЕРГ 19:00 - 20:00 КИЕВ)
 * =======================================================================
 */

let currentSupEnemy = null;
let supremacyStats = {
    kills: 0,
    goldEarned: 0
};

// Проверяем, идёт ли Превосходство прямо сейчас
function isSupremacyActive() {
    const now = new Date();
    
    // Переводим время в часовой пояс Киева безопасным способом
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Kyiv',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const timeData = {};
    parts.forEach(p => { timeData[p.type] = p.value; });

    // Безопасно получаем номер дня недели для Киева (0 - воскресенье, 1 - понедельник, ..., 4 - четверг)
    const kievDateStr = now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
    const kievDate = new Date(kievDateStr);
    const day = kievDate.getDay(); 

    const hour = parseInt(timeData.hour);

    // Возвращаем true, если сегодня четверг (4) и время ровно 19:00 - 19:59
    return (day === 4 && hour === 19);
}

// Постоянное обновление таймеров и кнопки в главном меню
setInterval(() => {
    const active = isSupremacyActive();
    const btn = document.getElementById('menu-supremacy-btn');
    
    if (btn) {
        if (active) {
            btn.style.background = "linear-gradient(135deg, #cc9900, #664d00)";
            btn.style.borderColor = "#ffd700";
            btn.style.color = "#ffffff";
            btn.style.fontWeight = "bold";
            btn.innerHTML = "👑 Превосходство Октрыто! 🔥";
        } else {
            btn.style.background = "#2b2203";
            btn.style.borderColor = "#5e4c10";
            btn.style.color = "#8c7320";
            btn.style.fontWeight = "normal";
            btn.innerHTML = "👑 Превосходство (Чт. 19:00)";
        }
    }

    // Если игрок находится на самом экране Превосходства
    const supScr = document.getElementById('supremacy-screen');
    if (supScr && !supScr.classList.contains('hidden')) {
        const timerText = document.getElementById('supremacy-timer-text');
        if (timerText) {
            if (active) {
                const now = new Date();
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();
                const remMin = 59 - minutes;
                const remSec = 59 - seconds;
                timerText.innerHTML = `🔥 <span style="color: #ff3c3c; font-weight: bold;">БИТВА ИДЕТ!</span> До окончания: <b>${remMin}:${remSec < 10 ? '0' + remSec : remSec}</b>`;
            } else {
                timerText.innerHTML = `<span style="color: #ff4d4d;">Событие завершено! Спешите зачислить заработанное золото!</span>`;
                // Блокируем кнопку атаки, если время вышло
                const attBtn = document.querySelector('#supremacy-controls button');
                if (attBtn) attBtn.disabled = true;
            }
        }
    }
}, 1000);

function openSupremacyScreen() {
    if (!activePlayer) return;
    if (!activePlayer.clanName) {
        showGameAlert("⚠️ Чтобы участвовать в Превосходстве, вы должны состоять в Клане!");
        return;
    }
    if (!isSupremacyActive() && supremacyStats.goldEarned === 0) {
        showGameAlert("⏳ Режим закрыт! Превосходство проходит каждый <b>четверг с 19:00 до 20:00</b> по Киевскому времени.");
        return;
    }

    // Сбрасываем или загружаем аватарки
    document.getElementById('sup-player-avatar').src = activePlayer.avatarData || "profile.jpg";
    document.getElementById('sup-player-name').innerText = activePlayer.username;

    if (!currentSupEnemy) {
        generateSupremacyEnemy();
    }

    updateSupremacyUI();
    openGameScreen('supremacy-screen');
}

function generateSupremacyEnemy() {
    const randomPrefix = botPrefixes[Math.floor(Math.random() * botPrefixes.length)];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    const fullName = `⚔️ ${randomPrefix} ${randomName}`;

    // Враги на Превосходстве на 10-20% сильнее обычных аренных ботов
    const botLvl = Math.max(1, activePlayer.level + Math.floor(Math.random() * 4) - 1); 
    const botHp = Math.floor((1000 + (botLvl * 120)) * 1.2);
    const botAttack = Math.floor((15 + (botLvl * 1100)) * 1.15);
    const botDefense = Math.floor((10 + (botLvl * 550)) * 1.15);

    currentSupEnemy = {
        name: fullName,
        level: botLvl,
        hp: botHp,
        maxHp: botHp,
        attack: botAttack,
        defense: botDefense,
        avatar: "profile.jpg"
    };
}

function updateSupremacyUI() {
    if (!currentSupEnemy) return;

    document.getElementById('sup-display-kills').innerText = supremacyStats.kills;
    document.getElementById('sup-display-gold').innerText = supremacyStats.goldEarned + " 🟡";

    document.getElementById('sup-enemy-name').innerText = `${currentSupEnemy.name} [${currentSupEnemy.level}]`;
    document.getElementById('sup-enemy-fullname').innerText = `🛡️ Защитник: ${currentSupEnemy.name} (${currentSupEnemy.level} ур.)`;
    document.getElementById('sup-enemy-attack').innerText = formatNum(currentSupEnemy.attack);
    document.getElementById('sup-enemy-hp').innerText = formatNum(currentSupEnemy.hp);
    document.getElementById('sup-enemy-maxhp').innerText = formatNum(currentSupEnemy.maxHp);
    document.getElementById('sup-enemy-defense').innerText = formatNum(currentSupEnemy.defense);
}

function attackSupremacyEnemy() {
    if (!activePlayer || !currentSupEnemy) return;
    const logBox = document.getElementById('sup-log');

    if (activePlayer.energy < 5) {
        showGameAlert("❌ Недостаточно энергии для атаки! Нужно 5 ⚡");
        return;
    }

    // Тратим 5 энергии и пускаем её в квест
    activePlayer.energy -= 5;
    addQuestProgress("energy_spend", 5);

    logBox.className = "";
    logBox.classList.remove('hidden');

    let playerDamage = Math.floor(Math.random() * 6) + Math.floor(activePlayer.attack * 0.8);
    let finalPlayerDamage = Math.max(1, playerDamage - Math.floor(currentSupEnemy.defense * 0.2));
    
    currentSupEnemy.hp = Math.max(0, currentSupEnemy.hp - finalPlayerDamage);

    let fightLog = "";

    if (currentSupEnemy.hp <= 0) {
        // Успешное убийство — начисляем 50 временного Золота + бонус Алтаря Превосходства (если активирован)
        const supremacyAltarBonus = (activePlayer.clanName && activeClan && activeClan.altarSupremacy && isAltarActive(activeClan, 'altarSupremacy')) ? activeClan.altarSupremacy : 0;
        const goldFromKill = 50 + supremacyAltarBonus;

        supremacyStats.kills += 1;
        supremacyStats.goldEarned += goldFromKill;

        fightLog = `<div style="color: #ffd700; font-weight: bold;">🏆 Победа над защитником!</div>
                    <div style="color: #4de64d; font-size: 11px;">Вы заработали +${goldFromKill} Золота в копилку Превосходства!${supremacyAltarBonus > 0 ? ` (вкл. +${supremacyAltarBonus} от 👑 Алтаря Превосходства)` : ''}</div>`;
        
        generateSupremacyEnemy();
    } else {
        let enemyDamage = Math.floor(Math.random() * 5) + Math.floor(currentSupEnemy.attack * 0.8);
        let finalEnemyDamage = Math.max(1, enemyDamage - activePlayer.defense);
        
        activePlayer.hp = Math.max(0, activePlayer.hp - finalEnemyDamage);

        if (activePlayer.hp <= 0) {
            fightLog = `<div style="color: #ff4d4d; font-weight: bold;">💀 Защитник одолел вас!</div>
                        <div style="color: #888; font-size: 11px;">Вы восстанавливаете силы для новой попытки...</div>`;
            generateSupremacyEnemy();
        } else {
            fightLog = `<div style="color: #4de64d;">Вы ранили защитника на <span style="font-weight:bold;">${formatNum(finalPlayerDamage)}</span> ХП.</div>
                        <div style="color: #ff4d4d;">Вам в ответ прилетело <span style="font-weight:bold;">${formatNum(finalEnemyDamage)}</span> урона.</div>`;
        }
    }

    logBox.innerHTML = fightLog;
    saveData();
    updateGameUI();
    updateSupremacyUI();
}

// Завершаем и принудительно переносим золото в клан
function leaveSupremacy() {
    if (supremacyStats.goldEarned > 0 && activePlayer.clanName && activeClan) {
        const clan = activeClan;

        // Начисляем в казну клана
        clan.gold += supremacyStats.goldEarned;

        // Записываем вклад в общую таблицу статистики клана
        if (!clan.stats) clan.stats = {};
        if (!clan.stats[activePlayer.username]) {
            clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
        }
        clan.stats[activePlayer.username].gold += supremacyStats.goldEarned;

        saveActiveClan();

        showGameAlert(`👑 <b>Превосходство завершено!</b><br><br>Вы успешно защитили честь клана, совершили <b>${supremacyStats.kills}</b> убийств и передали в казну:<br><span style="color:#ffd700; font-size:16px; font-weight:bold;">+${supremacyStats.goldEarned} Золота!</span>`);
        
        // Сбрасываем временную сессию
        supremacyStats.kills = 0;
        supremacyStats.goldEarned = 0;
    }

    document.getElementById('sup-log').classList.add('hidden');
    document.getElementById('sup-log').innerHTML = "";
    
    openGameScreen('game-menu-screen');
}

/**
 * =======================================================================
 * СИСТЕМА: ЧАТ "БЕСЕДКА" — РЕАЛЬНЫЙ REALTIME-ЧАТ МЕЖДУ ИГРОКАМИ
 * Сообщения хранятся локально (localStorage, ключ 'chaos_local_chat')
 * только в этом браузере — переписки с другими реальными игроками нет.
 * =======================================================================
 */

let chatChannel = null; // Активная realtime-подписка на новые сообщения
let currentChatMessages = []; // Последние загруженные/полученные сообщения (для перерисовки)

async function openChatScreen() {
    if (!activePlayer) return;

    openGameScreen('chat-screen');
    await loadChatMessages();
    subscribeToChat();

    // Автопрокрутка чата вниз
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;
}

// Загружает последние сообщения из локального хранилища (только этот браузер)
async function loadChatMessages() {
    const box = document.getElementById('chat-messages-box');
    if (box) box.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:15px;">Загрузка сообщений...</div>`;

    await pullChatMessagesFromServer(); // подтягиваем сообщения от других игроков перед показом
    const all = ldbReadArray(LOCAL_DB_KEYS.chat);
    const last50 = all.slice(-50);

    currentChatMessages = last50.map(m => ({
        username: m.username, text: m.text, gender: m.gender, timestamp: m.created_at
    }));
    renderChatMessages(currentChatMessages);
}

// Раньше здесь была realtime-подписка Supabase на новые сообщения от других
// игроков. Теперь чат полностью локальный (одно устройство), поэтому просто
// периодически перечитываем localStorage, пока открыт экран чата.
function subscribeToChat() {
    if (chatChannel) return; // уже подписаны
    chatChannel = setInterval(async () => {
        const scr = document.getElementById('chat-screen');
        if (!scr || scr.classList.contains('hidden')) return;
        await pullChatMessagesFromServer(); // подтягиваем сообщения от других игроков
        const all = ldbReadArray(LOCAL_DB_KEYS.chat).slice(-50);
        if (all.length !== currentChatMessages.length) {
            currentChatMessages = all.map(m => ({ username: m.username, text: m.text, gender: m.gender, timestamp: m.created_at }));
            renderChatMessages(currentChatMessages);
            const box = document.getElementById('chat-messages-box');
            if (box) box.scrollTop = box.scrollHeight;
        }
    }, 2000);
}

function unsubscribeFromChat() {
    if (chatChannel) {
        clearInterval(chatChannel);
        chatChannel = null;
    }
}

// Форматирование времени в WAP-стиле ("1 м", "5 м", "1 ч", "Только что")
function formatChatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hours = Math.floor(min / 60);

    if (sec < 30) return "Только что";
    if (min < 60) return `${min} м`;
    if (hours < 24) return `${hours} ч`;
    return new Date(timestamp).toLocaleDateString('ru-RU');
}

// Отрисовка чата (текст и ники экранируются от XSS через escapeHTML)
function renderChatMessages(msgs) {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;

    box.innerHTML = "";

    if (!msgs || msgs.length === 0) {
        box.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:15px;">Пока никто не написал в Беседке. Будьте первыми!</div>`;
        return;
    }

    msgs.forEach(m => {
        // Определяем иконку пола
        let genderIcon = "🧑‍💻";
        if (m.gender === "Женский") genderIcon = "👩‍💻";
        else if (m.gender === "Не указан" || !m.gender) genderIcon = "👤";

        // Класс для выделения ника Админа
        const isMsgAdmin = m.username.toLowerCase() === 'admin';
        const nameColor = isMsgAdmin ? '#ffae19' : '#4da6ff';
        const safeUsername = escapeHTML(m.username);

        // Создаем блок сообщения
        const msgRow = document.createElement('div');
        msgRow.style.marginBottom = "10px";
        msgRow.style.fontSize = "13px";
        msgRow.style.lineHeight = "1.4";

        msgRow.innerHTML = `
            <span style="font-size: 12px; margin-right: 3px;">${genderIcon}</span>
            <span onclick="insertNicknameReply('${safeUsername.replace(/'/g, "\\'")}')" style="color: ${nameColor}; font-weight: bold; cursor: pointer; text-decoration: underline;">
                ${safeUsername}
            </span>: 
            <span class="chat-text" style="color: #dfdfdf;">${escapeHTML(m.text)}</span>
            <span style="color: #666; font-size: 10px; margin-left: 5px;">, ${formatChatTime(m.timestamp)}</span>
        `;
        box.appendChild(msgRow);
    });
}

// Клик на ник — вставляет обращение в инпут
function insertNicknameReply(username) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    // Очищаем или добавляем к текущему тексту
    input.value = `${username}, ` + input.value.replace(new RegExp(`^${username},\\s*`), "");
    input.focus();
}

// Отправка сообщения в общий чат
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !activePlayer) return;

    const text = input.value.trim();
    if (!text) return;
    if (text.length > 300) { showGameAlert("⚠️ Сообщение слишком длинное (макс. 300 символов)!"); return; }

    input.value = "";

    const createdAt = Date.now();
    const all = ldbReadArray(LOCAL_DB_KEYS.chat);
    const newMsg = { username: activePlayer.username, text: text, gender: activePlayer.gender || "Не указан", created_at: createdAt };
    all.push(newMsg);
    // Храним не более последних 200 сообщений, чтобы localStorage не переполнялся
    while (all.length > 200) all.shift();
    ldbWriteArray(LOCAL_DB_KEYS.chat, all);
    pushChatMessageToServer(newMsg); // онлайн-синхронизация (см. блок в начале файла)

    currentChatMessages = all.slice(-50).map(m => ({ username: m.username, text: m.text, gender: m.gender, timestamp: m.created_at }));
    renderChatMessages(currentChatMessages);
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;
}

function refreshChat() {
    loadChatMessages();
}

/**
 * =======================================================================
 * СИСТЕМА: ЛОКАЦИЯ "ТАВЕРНА ГОБЛИНОВ" (МИНИ-ИГРА В КОСТИ)
 * =======================================================================
 */

// Графические кубики в WAP-стиле
const diceIcons = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const goblinWinPhrases = [
    "\"Хе-хе, твоё серебро теперь моё! Готов поставить ещё?\"",
    "\"Удача любит гоблинов, приятель! Неси свои монеты сюда!\"",
    "\"Ой, как не повезло! Но ничего, отыграешься в следующий раз... возможно!\"",
    "\"Ха! Кубики говорят, что сегодня мой день!\""
];

const goblinLosePhrases = [
    "\"Р-р-р! Тебе просто повезло! Забирай свои монеты...\"",
    "\"Не может быть! Ты точно не жульничал своими костями?!\"",
    "\"Эх, ладно... Держи выигрыш. Но в следующий раз я отыграюсь!\"",
    "\"Кажется, Шмыг сегодня останется без ужина... Поздравляю!\""
];

function openTavernScreen() {
    if (!activePlayer) return;
    
    // Сбрасываем визуальные кости при входе
    document.getElementById('player-dice-visual').innerText = "🎲 🎲";
    document.getElementById('player-dice-score').innerText = "Сумма: 0";
    document.getElementById('goblin-dice-visual').innerText = "🎲 🎲";
    document.getElementById('goblin-dice-score').innerText = "Сумма: 0";
    
    document.getElementById('dice-bet-input').value = "";
    document.getElementById('dice-result-log').classList.add('hidden');
    document.getElementById('dice-result-log').innerHTML = "";
    
    document.getElementById('goblin-speech').innerText = `"Хей, путник! Заходи, присаживайся. Готов испытать удачу в кости? Ставь серебро — если выиграешь, удвою ставку!"`;

    openGameScreen('tavern-screen');
}

// Быстрая установка ставки кнопками
function setDiceBet(amount) {
    const input = document.getElementById('dice-bet-input');
    if (input) {
        input.value = Math.floor(amount);
    }
}

function playDiceGame() {
    if (!activePlayer) return;

    const betInput = document.getElementById('dice-bet-input');
    const logBox = document.getElementById('dice-result-log');
    const speechText = document.getElementById('goblin-speech');

    const bet = parseInt(betInput.value);

    // Проверки ставки
    if (isNaN(bet) || bet <= 0) {
        showGameAlert("⚠️ Введите корректную ставку серебра!");
        return;
    }
    if (activePlayer.silver < bet) {
        showGameAlert("❌ У вас нет такого количества серебра!");
        return;
    }

    logBox.className = "";
    logBox.classList.remove('hidden');
    logBox.innerHTML = "<span style='color: #aaa;'>Гоблин трясет стакан... Кости брошены! 🎲</span>";

    // Списываем ставку перед броском
    activePlayer.silver -= bet;
    saveData();
    updateGameUI();

    // Симуляция броска (бросаем по 2 кубика)
    const pDice1 = Math.floor(Math.random() * 6) + 1;
    const pDice2 = Math.floor(Math.random() * 6) + 1;
    const playerTotal = pDice1 + pDice2;

    const gDice1 = Math.floor(Math.random() * 6) + 1;
    const gDice2 = Math.floor(Math.random() * 6) + 1;
    const goblinTotal = gDice1 + gDice2;

    // Выводим результат
    setTimeout(() => {
        // Визуализируем кубики игрока и гоблина
        document.getElementById('player-dice-visual').innerHTML = `${diceIcons[pDice1]} ${diceIcons[pDice2]}`;
        document.getElementById('player-dice-score').innerText = `Сумма: ${playerTotal}`;

        document.getElementById('goblin-dice-visual').innerHTML = `${diceIcons[gDice1]} ${diceIcons[gDice2]}`;
        document.getElementById('goblin-dice-score').innerText = `Сумма: ${goblinTotal}`;

        let outcomeHTML = "";

        if (playerTotal > goblinTotal) {
            // Выигрыш игрока (ставка х2)
            const winAmount = bet * 2;
            activePlayer.silver += winAmount;
            
            outcomeHTML = `<div style="color: #4de64d; font-weight: bold; font-size: 15px;">🏆 Вы выиграли!</div>
                           <div style="color: #ffd700; margin-top: 5px;">Получено серебра: +${formatNum(winAmount)} 🪙</div>`;
            
            speechText.innerText = goblinLosePhrases[Math.floor(Math.random() * goblinLosePhrases.length)];
            logBox.className = "log-success";
        } 
        else if (playerTotal < goblinTotal) {
            // Проигрыш игрока
            outcomeHTML = `<div style="color: #ff4d4d; font-weight: bold; font-size: 15px;">💀 Гоблин выиграл!</div>
                           <div style="color: #aaa; margin-top: 5px;">Вы потеряли ставку: -${formatNum(bet)} серебра.</div>`;
            
            speechText.innerText = goblinWinPhrases[Math.floor(Math.random() * goblinWinPhrases.length)];
            logBox.className = "log-error";
        } 
        else {
            // Ничья (возвращаем ставку)
            activePlayer.silver += bet;
            
            outcomeHTML = `<div style="color: #ffcc00; font-weight: bold; font-size: 15px;">🤝 Ничья!</div>
                           <div style="color: #dfdfdf; margin-top: 5px;">Ваша ставка в размере ${formatNum(bet)} серебра возвращена.</div>`;
            
            speechText.innerText = `"Ух, равный счет! Давай еще раз бросим, определим сильнейшего!"`;
            logBox.style.borderColor = "#ffcc00";
        }

        logBox.innerHTML = outcomeHTML;
        saveData();
        updateGameUI();
    }, 1000); // Имитация броска
}

        /**
 * =======================================================================
 * СИСТЕМА ФОРУМА: ИДЕИ, ПРЕДЛОЖЕНИЯ И ПЕРЕХОД В ТОПИК
 * =======================================================================
 */

// Храним ID текущего открытого топика (null — если мы в общем списке)
let currentOpenedIdeaId = null;

// 1. Инициализация хранилища предложений
if (!localStorage.getItem('forum_ideas')) {
    const defaultIdeas = [
        {
            id: 1,
            author: "Admin",
            date: "16.07.2026, 18:53",
            title: "Голосование за новые классы!",
            text: "Приветствую, воины! Как вы смотрите на то, чтобы добавить в игру классы персонажей (Маг, Лучник, Рыцарь)? Пишите свои за и против!",
            pinned: true,
            comments: [
                {
                    id: 101,
                    author: "Игрок_1",
                    date: "16.07.2026, 19:05",
                    text: "Отличная идея, я бы поиграл за мага!"
                }
            ]
        }
    ];
    localStorage.setItem('forum_ideas', JSON.stringify(defaultIdeas));
}

// 2. Функция скрытия/показа формы создания топика
function toggleIdeaForm() {
    const formBlock = document.getElementById('new-idea-form-block');
    if (formBlock) {
        formBlock.classList.toggle('hidden');
    }
}

// 3. Функция публикации новой идеи
function createIdeaTopic() {
    if (!activePlayer) {
        showGameAlert("❌ Вы должны войти в игру!");
        return;
    }

    const titleInput = document.getElementById('idea-title-input');
    const textInput = document.getElementById('idea-text-input');

    if (!titleInput || !textInput) return;

    const title = titleInput.value.trim();
    const text = textInput.value.trim();

    if (!title || !text) {
        showGameAlert("⚠️ Заполните все поля предложения!");
        return;
    }

    if (title.length < 5 || text.length < 15) {
        showGameAlert("⚠️ Название должно быть не короче 5 символов, а текст — не короче 15 символов!");
        return;
    }

    const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
    
    const now = new Date();
    const dateStr = now.toLocaleString('ru-RU', { 
        timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
    });

    const newIdea = {
        id: Date.now(),
        author: activePlayer.username,
        date: dateStr,
        title: title,
        text: text,
        pinned: false,
        comments: []
    };

    ideas.push(newIdea);
    localStorage.setItem('forum_ideas', JSON.stringify(ideas));

    titleInput.value = "";
    textInput.value = "";
    toggleIdeaForm();

    showGameAlert("✅ Ваша идея успешно опубликована на форуме!");
    renderIdeas();
}

// 4. Главная функция отрисовки (решает, показать список или конкретный топик)
function renderIdeas() {
    const container = document.getElementById('ideas-list-container');
    const createBtnBlock = document.querySelector('#forum-ideas-section > div:first-child'); // Блок с кнопкой "Создать топик"
    if (!container) return;

    const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
    const isAdmin = (activePlayer && activePlayer.username === "Admin");

    // ВАРИАНТ А: Открыт конкретный топик
    if (currentOpenedIdeaId !== null) {
        const idea = ideas.find(i => i.id === currentOpenedIdeaId);
        if (!idea) {
            currentOpenedIdeaId = null;
            renderIdeas();
            return;
        }

        // Прячем кнопку создания новых топиков, пока мы внутри темы
        if (createBtnBlock) createBtnBlock.style.display = 'none';

        const pinLabel = idea.pinned ? `<span style="background: #997a00; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 8px;">📌 ЗАКРЕПЛЕНО</span>` : "";

        // Рендерим комментарии
        let commentsHtml = "";
        const commentsList = idea.comments || [];
        commentsList.forEach(comment => {
            commentsHtml += `
                <div style="background: #14110d; padding: 8px; border-radius: 4px; margin-bottom: 6px; border-left: 2px solid #ffae19; font-size: 11px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; color: #888; font-size: 10px; margin-bottom: 3px;">
                        <span>👤 <span style="color: #ffae19; font-weight: bold;">${comment.author}</span>, ${comment.date}</span>
                        ${isAdmin ? `<span onclick="deleteComment(${idea.id}, ${comment.id})" style="color: #ff3c3c; cursor: pointer; text-decoration: underline;">[Удалить]</span>` : ""}
                    </div>
                    <div style="color: #ccc; word-break: break-word;">${escapeHTML(comment.text)}</div>
                </div>
            `;
        });

        if (commentsHtml === "") {
            commentsHtml = `<div style="color: #666; font-size: 11px; font-style: italic; margin-bottom: 10px; text-align: left;">Комментариев пока нет. Будьте первым!</div>`;
        }

        container.innerHTML = `
                        <div style="text-align: left; margin-top: 10px; margin-bottom: 20px; width: 100%;">
                <button class="btn btn-secondary" onclick="closeIdeaTopic()" style="width: auto; padding: 8px 18px; font-size: 12px; margin: 0; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    ↩️ Назад к списку
                </button>
            </div>

            <div class="forum-topic" style="background: #0d0d0d; border-radius: 6px; padding: 15px; text-align: left; border: 1px solid #ffaa00; box-shadow: 0 0 10px rgba(255,170,0,0.05);">
                <div class="forum-topic-meta" style="font-size: 11px; color: #888; display: flex; align-items: center; justify-content: space-between;">
                    <div>👤 <span style="color: #ffae19; font-weight: bold;">${idea.author}</span>, ${idea.date} ${pinLabel}</div>
                    ${isAdmin ? `
                        <div style="display: flex; gap: 8px;">
                            <span onclick="togglePinIdea(${idea.id})" style="color: #ffd700; cursor: pointer; text-decoration: underline;">[${idea.pinned ? 'Открепить' : 'Закрепить'}]</span>
                            <span onclick="deleteIdea(${idea.id})" style="color: #ff3c3c; cursor: pointer; text-decoration: underline;">[Удалить]</span>
                        </div>
                    ` : ""}
                </div>
                <div style="color: #ffd700; font-size: 15px; font-weight: bold; margin-top: 8px; margin-bottom: 10px; border-bottom: 1px solid #222; padding-bottom: 6px;">${escapeHTML(idea.title)}</div>
                <div style="color: #ddd; font-size: 13px; line-height: 1.5; white-space: pre-line; margin-bottom: 20px;">${escapeHTML(idea.text)}</div>
                
                <div style="background: #080808; border: 1px solid #1a1a1a; border-radius: 4px; padding: 12px; margin-top: 15px;">
                    <div style="font-weight: bold; font-size: 12px; color: #ffae19; margin-bottom: 10px; text-align: left;">💬 Обсуждение идеи:</div>
                    <div id="comments-box-${idea.id}">${commentsHtml}</div>
                    
                    <div style="display: flex; gap: 6px; margin-top: 12px;">
                        <input type="text" id="comment-input-${idea.id}" placeholder="Написать комментарий..." style="flex-grow: 1; background: #161616; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 12px; border-radius: 4px;">
                        <button class="btn" onclick="addComment(${idea.id})" style="width: auto; padding: 8px 15px; background: #5c3b16; border-color: #ffae19; color: #fff; font-size: 12px; font-weight: bold; margin: 0;">Ответить</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // ВАРИАНТ Б: Показываем общий краткий список топиков
    if (createBtnBlock) createBtnBlock.style.display = 'block'; // Возвращаем кнопку создания

    if (ideas.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Пока никто не предложил идею. Будьте первыми!</div>`;
        return;
    }

    ideas.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.id - a.id;
    });

    let html = "";
    ideas.forEach(idea => {
        const borderStyle = idea.pinned ? "border-left: 3px solid #ffcc00; background: #14120c;" : "border-left: 3px solid #333;";
        const pinIcon = idea.pinned ? "📌 " : "💡 ";
        const commentsCount = idea.comments ? idea.comments.length : 0;

        html += `
            <div onclick="openIdeaTopic(${idea.id})" style="background: #0d0d0d; border-radius: 4px; padding: 12px; margin-bottom: 10px; text-align: left; cursor: pointer; border: 1px solid #1c1c1c; ${borderStyle} transition: background 0.2s;">
                <div style="color: #ffd700; font-size: 13px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${pinIcon}${escapeHTML(idea.title)}
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 5px; display: flex; justify-content: space-between;">
                    <span>👤 ${idea.author} • 📅 ${idea.date.split(',')[0]}</span>
                    <span style="color: #ffae19;">💬 ${commentsCount}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 5. Функции навигации (Переход внутрь и назад)
function openIdeaTopic(id) {
    currentOpenedIdeaId = id;
    renderIdeas();
}

function closeIdeaTopic() {
    currentOpenedIdeaId = null;
    renderIdeas();
}

// 6. Сброс при выходе в главное меню форума
const originalOpenForumCategory = openForumCategory;
openForumCategory = function(category) {
    if (category === 'main' || category === 'ideas') {
        currentOpenedIdeaId = null; // Сбрасываем открытый топик
    }
    originalOpenForumCategory(category);
};

// 7. Функция добавления комментария
function addComment(ideaId) {
    if (!activePlayer) {
        showGameAlert("❌ Войдите в игру, чтобы комментировать!");
        return;
    }

    const input = document.getElementById(`comment-input-${ideaId}`);
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
    const index = ideas.findIndex(i => i.id === ideaId);

    if (index !== -1) {
        const now = new Date();
        const dateStr = now.toLocaleString('ru-RU', { 
            timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
        });

        const newComment = {
            id: Date.now(),
            author: activePlayer.username,
            date: dateStr,
            text: text
        };

        if (!ideas[index].comments) ideas[index].comments = [];
        ideas[index].comments.push(newComment);
        localStorage.setItem('forum_ideas', JSON.stringify(ideas));
        
        input.value = "";
        renderIdeas();
    }
}

// 8. Функция удаления комментария (Admin)
function deleteComment(ideaId, commentId) {
    if (!activePlayer || activePlayer.username !== "Admin") return;
    showGameConfirm("Удалить этот комментарий?", () => {
        const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
        const ideaIndex = ideas.findIndex(i => i.id === ideaId);
        if (ideaIndex !== -1) {
            ideas[ideaIndex].comments = ideas[ideaIndex].comments.filter(c => c.id !== commentId);
            localStorage.setItem('forum_ideas', JSON.stringify(ideas));
            renderIdeas();
        }
    });
}

// 9. Закрепление топика (Admin)
function togglePinIdea(id) {
    if (!activePlayer || activePlayer.username !== "Admin") return;
    const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
    const index = ideas.findIndex(i => i.id === id);
    if (index !== -1) {
        ideas[index].pinned = !ideas[index].pinned;
        localStorage.setItem('forum_ideas', JSON.stringify(ideas));
        renderIdeas();
    }
}

// 10. Удаление топика (Admin)
function deleteIdea(id) {
    if (!activePlayer || activePlayer.username !== "Admin") return;
    showGameConfirm("Вы уверены, что хотите удалить эту идею?", () => {
        const ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
        const filtered = ideas.filter(i => i.id !== id);
        localStorage.setItem('forum_ideas', JSON.stringify(filtered));
        currentOpenedIdeaId = null; // Возвращаемся к списку
        renderIdeas();
    });
}

// Помощник XSS
/**
 * =======================================================================
 * СИСТЕМА: ДРУЗЬЯ (localStorage, ключ 'chaos_local_friendships')
 * Поиск игроков, заявки в друзья, список друзей с уровнем и временем
 * последнего входа. Работает только среди персонажей, когда-либо
 * созданных в этом браузере (общего сервера больше нет).
 * =======================================================================
 */

async function openFriendsScreen() {
    if (!activePlayer) return;
    document.getElementById('friend-search-input').value = "";
    document.getElementById('friend-search-results').innerHTML = "";
    openGameScreen('friends-screen');
    await refreshFriendsScreen();
}

async function refreshFriendsScreen() {
    await Promise.all([renderFriendRequests(), renderFriendsList()]);
    updateFriendRequestBadge();
}

async function updateFriendRequestBadge() {
    const badge = document.getElementById('friends-request-badge');
    if (!badge || !activePlayer) return;
    const all = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const count = all.filter(r => r.addressee === activePlayer.username && r.status === 'pending').length;
    if (count > 0) {
        badge.innerText = count > 99 ? "99+" : String(count);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function searchFriendCandidates() {
    const input = document.getElementById('friend-search-input');
    const container = document.getElementById('friend-search-results');
    if (!input || !container || !activePlayer) return;

    const query = input.value.trim();
    if (query.length < 2) { showGameAlert("Введите минимум 2 символа для поиска!"); return; }

    container.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:10px;">Поиск...</div>`;

    const allPlayers = ldbRead(LOCAL_DB_KEYS.players);
    const queryLower = query.toLowerCase();
    const data = Object.values(allPlayers)
        .filter(p => p.username && p.username.toLowerCase().includes(queryLower))
        .slice(0, 15)
        .map(p => ({ username: p.username }));

    const results = (data || []).filter(p => p.username && p.username.toLowerCase() !== activePlayer.username.toLowerCase());

    if (results.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:10px;">Никто не найден.</div>`;
        return;
    }

    // Узнаём текущий статус отношений с найденными игроками (двумя простыми
    // eq/in-запросами, без сборки строкового or-фильтра из ников игроков)
    const usernames = results.map(p => p.username);
    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const relations = allFriendships.filter(r =>
        (r.requester === activePlayer.username && usernames.includes(r.addressee)) ||
        (r.addressee === activePlayer.username && usernames.includes(r.requester))
    );

    function relationWith(username) {
        return relations.find(r => r.requester === username || r.addressee === username) || null;
    }

    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    results.forEach(p => {
        const rel = relationWith(p.username);
        const safeNameAttr = escapeHTML(p.username).replace(/'/g, "\\'");
        let actionHtml = `<button class="btn btn-primary" style="width:auto; padding:5px 10px; margin:0; font-size:12px;" onclick="sendFriendRequest('${safeNameAttr}')">➕ Добавить</button>`;
        if (rel && rel.status === 'accepted') {
            actionHtml = `<span style="color:#7fe07f; font-size:12px;">✔️ Уже друзья</span>`;
        } else if (rel && rel.status === 'pending') {
            actionHtml = rel.requester === activePlayer.username
                ? `<span style="color:#aaa; font-size:12px;">⏳ Заявка отправлена</span>`
                : `<span style="color:#ffd700; font-size:12px;">📨 Ждёт вашего ответа</span>`;
        }

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c;">
                <span style="color: #4da6ff; font-weight: bold; cursor:pointer;" onclick="viewLeaderboardPlayer('${safeNameAttr}')">${escapeHTML(p.username)}</span>
                ${actionHtml}
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

async function sendFriendRequest(username) {
    if (!activePlayer || username === activePlayer.username) return;

    // Проверяем, нет ли уже заявки/дружбы в любом направлении
    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const existing = allFriendships.find(r =>
        (r.requester === activePlayer.username && r.addressee === username) ||
        (r.requester === username && r.addressee === activePlayer.username)
    ) || null;

    if (existing) {
        if (existing.status === 'accepted') { showGameAlert("Вы уже друзья!"); return; }
        if (existing.requester === activePlayer.username) { showGameAlert("Заявка уже отправлена!"); return; }
        // Встречная заявка от этого игрока — принимаем сразу, становимся друзьями
        existing.status = 'accepted';
        ldbWriteArray(LOCAL_DB_KEYS.friendships, allFriendships);
        showGameAlert(`🤝 Вы с игроком ${username} теперь друзья!`);
        searchFriendCandidates();
        refreshFriendsScreen();
        return;
    }

    allFriendships.push({ id: 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), requester: activePlayer.username, addressee: username, status: 'pending', created_at: Date.now() });
    ldbWriteArray(LOCAL_DB_KEYS.friendships, allFriendships);

    showGameAlert(`📨 Заявка в друзья отправлена игроку ${username}!`);
    searchFriendCandidates();
}

async function renderFriendRequests() {
    const block = document.getElementById('friend-requests-block');
    const list = document.getElementById('friend-requests-list');
    if (!block || !list || !activePlayer) return;

    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const data = allFriendships
        .filter(r => r.addressee === activePlayer.username && r.status === 'pending')
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
        .map(r => ({ requester: r.requester, created_at: r.created_at }));

    if (!data || data.length === 0) {
        block.classList.add('hidden');
        list.innerHTML = "";
        return;
    }

    block.classList.remove('hidden');
    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    data.forEach(r => {
        const safeNameAttr = escapeHTML(r.requester).replace(/'/g, "\\'");
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c;">
                <span style="color: #ffd700; font-weight: bold; cursor:pointer;" onclick="viewLeaderboardPlayer('${safeNameAttr}')">${escapeHTML(r.requester)}</span>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary" style="width:auto; padding:5px 10px; margin:0; font-size:12px;" onclick="acceptFriendRequest('${safeNameAttr}')">✔️</button>
                    <button class="btn btn-secondary" style="width:auto; padding:5px 10px; margin:0; font-size:12px;" onclick="declineFriendRequest('${safeNameAttr}')">✖️</button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    list.innerHTML = html;
}

async function acceptFriendRequest(fromUsername) {
    if (!activePlayer) return;
    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const req = allFriendships.find(r => r.requester === fromUsername && r.addressee === activePlayer.username && r.status === 'pending');
    if (!req) { showGameAlert("Ошибка. Попробуйте позже."); return; }
    req.status = 'accepted';
    ldbWriteArray(LOCAL_DB_KEYS.friendships, allFriendships);
    showGameAlert(`🤝 Вы с игроком ${fromUsername} теперь друзья!`);
    refreshFriendsScreen();
}

async function declineFriendRequest(fromUsername) {
    if (!activePlayer) return;
    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const filtered = allFriendships.filter(r => !(r.requester === fromUsername && r.addressee === activePlayer.username && r.status === 'pending'));
    ldbWriteArray(LOCAL_DB_KEYS.friendships, filtered);
    refreshFriendsScreen();
}

async function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container || !activePlayer) return;
    container.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:10px;">Загрузка...</div>`;

    const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
    const rows = allFriendships.filter(r => r.status === 'accepted' && (r.requester === activePlayer.username || r.addressee === activePlayer.username));
    const friendUsernames = rows.map(r => r.requester === activePlayer.username ? r.addressee : r.requester);

    if (friendUsernames.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#888; font-size:12px; padding:15px;">У вас пока нет друзей. Найдите их через поиск выше!</div>`;
        return;
    }

    // Подтягиваем уровень и время последнего входа для каждого друга
    const allLocalPlayers = ldbRead(LOCAL_DB_KEYS.players);
    const friendPlayers = friendUsernames
        .map(u => allLocalPlayers[u.toLowerCase()])
        .filter(Boolean)
        .map(p => ({ username: p.username, data: p.data }));

    const infoByUsername = {};
    (friendPlayers || []).forEach(p => { infoByUsername[p.username] = p.data || {}; });

    let html = `<div class="wap-info-box" style="padding: 0; overflow: hidden;">`;
    friendUsernames.forEach(username => {
        const info = infoByUsername[username] || {};
        const level = info.level || 1;
        const lastSeen = info.lastOnlineTime ? formatChatTime(info.lastOnlineTime) : "давно";
        const safeNameAttr = escapeHTML(username).replace(/'/g, "\\'");
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #1c1c1c;">
                <div style="overflow:hidden; cursor:pointer;" onclick="viewLeaderboardPlayer('${safeNameAttr}')">
                    <div style="color: #4da6ff; font-weight: bold;">${escapeHTML(username)}</div>
                    <div style="font-size: 10px; color: #888;">⭐ ${level} ур. | 🕓 ${lastSeen}</div>
                </div>
                <button class="btn btn-secondary" style="width:auto; padding:5px 10px; margin:0; font-size:11px;" onclick="removeFriend('${safeNameAttr}')">Удалить</button>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function removeFriend(username) {
    showGameConfirm(`Удалить ${escapeHTML(username)} из друзей?`, function() {
        const allFriendships = ldbReadArray(LOCAL_DB_KEYS.friendships);
        const filtered = allFriendships.filter(r => !(
            r.status === 'accepted' &&
            ((r.requester === activePlayer.username && r.addressee === username) ||
             (r.requester === username && r.addressee === activePlayer.username))
        ));
        ldbWriteArray(LOCAL_DB_KEYS.friendships, filtered);
        showGameAlert("Игрок удалён из друзей.");
        refreshFriendsScreen();
    });
}

// Помощник XSS
/**
 * =======================================================================
 * АДМИН-ПАНЕЛЬ (доступна только персонажу с ником "Admin")
 * Позволяет найти любого локального игрока (по нику) и напрямую
 * отредактировать его серебро, уровень, опыт, HP и энергию.
 * Работает только с данными этого браузера (localStorage).
 * =======================================================================
 */

function isAdmin() {
    return !!(activePlayer && activePlayer.username && activePlayer.username.toLowerCase() === 'admin');
}

function openAdminPanel() {
    if (!isAdmin()) { showGameAlert("Доступ только для администратора!"); return; }
    document.getElementById('admin-search-input').value = activePlayer.username;
    openGameScreen('admin-panel-screen');
    adminSearchPlayer();
}

function adminSearchPlayer() {
    if (!isAdmin()) return;
    const resultBox = document.getElementById('admin-search-result');
    const query = document.getElementById('admin-search-input').value.trim();
    const key = query.toLowerCase();

    if (!key) { resultBox.innerHTML = `<div style="color:#888; font-size:12px; padding:10px;">Введите никнейм игрока.</div>`; return; }

    const players = ldbRead(LOCAL_DB_KEYS.players);
    const record = players[key];

    if (!record) {
        resultBox.innerHTML = `<div style="color:#ff6666; font-size:12px; padding:10px;">Игрок "${escapeHTML(query)}" не найден в этом браузере.</div>`;
        return;
    }

    const p = record.data || {};
    const safeUserAttr = escapeHTML(record.username).replace(/'/g, "\\'");

    function field(id, label, value) {
        return `
            <label style="font-size:11px; color:#aaa; display:block;">${label}
                <input type="number" id="${id}" value="${Number.isFinite(value) ? value : 0}" style="width:100%; background:#0d0d0d; border:1px solid #333; color:#fff; padding:6px; border-radius:4px; box-sizing:border-box; margin-top:2px;">
            </label>
        `;
    }

    resultBox.innerHTML = `
        <div class="wap-info-box" style="padding:14px;">
            <div style="font-weight:bold; color:#ffd700; margin-bottom:12px; font-size:15px;">${escapeHTML(record.username)}${record.username.toLowerCase() === activePlayer.username.toLowerCase() ? ' (Вы)' : ''}</div>
            <div style="font-size:11px; color:#888; margin-bottom:10px;">Текущий боевой расчёт: ⚔️ ${formatNum(p.attack || 0)} атаки | 🛡️ ${formatNum(p.defense || 0)} защиты (с учётом уровня, экипировки и бонусов ниже)</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px;">
                ${field('admin-edit-silver', '🪙 Серебро', p.silver)}
                ${field('admin-edit-crystals', '💎 Кристаллы', p.crystals)}
                ${field('admin-edit-level', '⭐ Уровень', p.level)}
                ${field('admin-edit-exp', '✨ Опыт', p.exp)}
                ${field('admin-edit-hp', '❤️ HP', p.hp)}
                ${field('admin-edit-maxhp', '❤️ Макс. HP', p.maxHp)}
                ${field('admin-edit-energy', '⚡ Энергия', p.energy)}
                ${field('admin-edit-maxenergy', '⚡ Макс. Энергия', p.maxEnergy)}
                ${field('admin-edit-attackbonus', '⚔️ Бонус к атаке', p.adminAttackBonus || 0)}
                ${field('admin-edit-defensebonus', '🛡️ Бонус к защите', p.adminDefenseBonus || 0)}
            </div>
            <div style="font-size:10px; color:#666; margin:-6px 0 12px;">Бонусы к атаке/защите прибавляются к обычному расчёту статов и не сбрасываются при левел-апе или перезаходе. Можно указать отрицательное число.</div>
            <button class="btn btn-primary" style="margin:0;" onclick="adminSaveEditedPlayer('${safeUserAttr}')">💾 Сохранить</button>
        </div>
    `;
}

function adminSaveEditedPlayer(username) {
    if (!isAdmin()) return;
    const key = username.toLowerCase();
    const players = ldbRead(LOCAL_DB_KEYS.players);
    const record = players[key];
    if (!record) { showGameAlert("Игрок не найден."); return; }
    if (!record.data) record.data = {};

    const fields = {
        silver: parseInt(document.getElementById('admin-edit-silver').value),
        crystals: parseInt(document.getElementById('admin-edit-crystals').value),
        level: parseInt(document.getElementById('admin-edit-level').value),
        exp: parseInt(document.getElementById('admin-edit-exp').value),
        hp: parseInt(document.getElementById('admin-edit-hp').value),
        maxHp: parseInt(document.getElementById('admin-edit-maxhp').value),
        energy: parseInt(document.getElementById('admin-edit-energy').value),
        maxEnergy: parseInt(document.getElementById('admin-edit-maxenergy').value),
        adminAttackBonus: parseInt(document.getElementById('admin-edit-attackbonus').value),
        adminDefenseBonus: parseInt(document.getElementById('admin-edit-defensebonus').value)
    };

    const minValues = { silver: 0, crystals: 0, level: 1, exp: 0, hp: 0, maxHp: 1, energy: 0, maxEnergy: 1, adminAttackBonus: -Infinity, adminDefenseBonus: -Infinity };

    Object.keys(fields).forEach(k => {
        if (!isNaN(fields[k])) record.data[k] = Math.max(minValues[k], fields[k]);
    });

    ldbWrite(LOCAL_DB_KEYS.players, players);

    // Если админ редактирует собственного активного персонажа — обновляем сессию сразу
    if (activePlayer && activePlayer.username.toLowerCase() === key) {
        Object.keys(fields).forEach(k => {
            if (!isNaN(fields[k])) activePlayer[k] = Math.max(minValues[k], fields[k]);
        });
        calculateStats();
        updateGameUI();
    }

    showGameAlert(`✔️ Данные игрока "${record.username}" обновлены!`);
    adminSearchPlayer();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
