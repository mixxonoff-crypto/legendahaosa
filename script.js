let activePlayer = null;
let currentBattleType = "adventure"; 

// Переменные для кузницы (чтобы calculateStats не вызывал ошибку)
let forgeAttack = 0;
let forgeDefense = 0;

const monsterDatabase = [
    { name: "Волк", hp: 200, maxHp: 200, attack: 12, image: "wolf.jpg", exp: 15, silver: 5, icon: "🐺" },
    { name: "Скелет", hp: 260, maxHp: 260, attack: 16, image: "skelet.jpg", exp: 20, silver: 8, icon: "💀" },
    { name: "Виверна", hp: 310, maxHp: 310, attack: 19, image: "viverna.jpg", exp: 25, silver: 10, icon: "🐉" },
    { name: "Химера", hp: 380, maxHp: 380, attack: 24, image: "himera.jpg", exp: 35, silver: 15, icon: "🦁" },
    { name: "Некромант", hp: 350, maxHp: 350, attack: 22, image: "nekromant.jpg", exp: 30, silver: 12, icon: "🔮" },
    { name: "Рыцарь", hp: 550, maxHp: 550, attack: 35, image: "knight.jpg", exp: 60, silver: 25, icon: "⚔️" },
    { name: "Голем", hp: 800, maxHp: 800, attack: 48, image: "golem.jpg", exp: 90, silver: 40, icon: "🪨" },
    { name: "Оборотень", hp: 1100, maxHp: 1100, attack: 65, image: "werewolf.jpg", exp: 130, silver: 65, icon: "🐺" },
    { name: "Берсерк", hp: 1500, maxHp: 1500, attack: 85, image: "berserk.jpg", exp: 180, silver: 90, icon: "🪓" },
    { name: "Черный Воин", hp: 2000, maxHp: 2000, attack: 110, image: "bigdark.jpg", exp: 240, silver: 130, icon: "🛡️" },
    { name: "Дракон", hp: 2800, maxHp: 2800, attack: 140, image: "drakon.jpg", exp: 320, silver: 180, icon: "🐉" },
    { name: "Друид", hp: 3800, maxHp: 3800, attack: 180, image: "dryid.jpg", exp: 420, silver: 240, icon: "🌿" },
    { name: "Кентавр", hp: 5000, maxHp: 5000, attack: 230, image: "centaur.jpg", exp: 550, silver: 320, icon: "🏹" },
    { name: "Ведьма", hp: 6500, maxHp: 6500, attack: 290, image: "witch.jpg", exp: 700, silver: 420, icon: "🧹" },
    { name: "Ниндзя", hp: 8500, maxHp: 8500, attack: 360, image: "ninja.jpg", exp: 900, silver: 550, icon: "🥷" },
    { name: "Тролль", hp: 11000, maxHp: 11000, attack: 450, image: "troll.jpg", exp: 1150, silver: 700, icon: "👹" },
];

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
function getRequiredExp(level) { 
    return 100 + (level * level * 5); 
}

function getEnergyPrice(level) { 
    return 100 + (level * level * 2); 
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
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

function openGameScreen(subScreenId) {
    document.getElementById('game-menu-screen').classList.add('hidden');
    document.getElementById('adventure-battle-screen').classList.add('hidden');
    document.getElementById('forge-screen').classList.add('hidden');
    document.getElementById('dungeon-screen').classList.add('hidden');
    document.getElementById('clan-none-screen').classList.add('hidden');
    document.getElementById('clan-main-screen').classList.add('hidden');
    document.getElementById('clan-settings-screen').classList.add('hidden');
    document.getElementById('clan-members-screen').classList.add('hidden');
    document.getElementById('gold-mine-screen').classList.add('hidden');
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

    document.getElementById(subScreenId).classList.remove('hidden');
    window.scrollTo(0, 0); 
    if (subScreenId === 'game-menu-screen') checkDailyChestStatus();
}

function handleRegister() {
    const user = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-password').value.trim();
    if (user === "" || pass === "") { showGameAlert("Заполните все поля!"); return; }
    if (localStorage.getItem('rpg_user_' + user)) { showGameAlert("Никнейм занят!"); return; }
    
    let users = Object.keys(localStorage).filter(key => key.startsWith('rpg_user_'));
    let nextId = (user.toLowerCase() === 'admin') ? 1 : users.length + 2;
    
    const playerData = {
        username: user, password: pass, hp: 1000, maxHp: 1000, energy: 1000, maxEnergy: 1000,
        level: 1, exp: 0, silver: (user.toLowerCase() === 'admin') ? 1000000 : 10,
        battleCircle: 1, currentMonsterIndex: 0, equipment: { shlem: 0, arms: 0, mech: 0, sapogi: 0, shit: 0 },
        training: { sword: 0, armor: 0, shield: 0 },
        lastChestClaimDate: "", userId: nextId, regTimestamp: Date.now(), lastOnlineTime: Date.now(),
        avatarData: "profile.jpg", aboutText: "В этом мире главное — человеком быть!", gender: "Не указан",
        clanName: "", lastSilverDepositDate: "", silverDepositedToday: 0
    };
    localStorage.setItem('rpg_user_' + user, JSON.stringify(playerData));
    showGameAlert("Персонаж успешно создан!", function() { openScreen('login-screen'); });
}

function handleLogin() {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const savedData = localStorage.getItem('rpg_user_' + user);
    if (!savedData) { showGameAlert("Персонаж не найден!"); return; }
    const player = JSON.parse(savedData);
    if (player.password !== pass) { showGameAlert("Неверный пароль!"); return; }
    
    if (user.toLowerCase() === 'admin') { player.userId = 1; player.silver = 1000000; }
    activePlayer = player;
    activePlayer.lastSeenTimeFormatted = formatFullKyivDateTime(activePlayer.lastOnlineTime);
    
    if (!activePlayer.training) {
        activePlayer.training = { sword: 0, armor: 0, shield: 0 };
    }

    if (activePlayer.lastOnlineTime) {
        let passed = Math.floor((Date.now() - activePlayer.lastOnlineTime) / 1000);
        if (passed > 0) {
            activePlayer.hp = Math.min(activePlayer.maxHp, activePlayer.hp + passed * 1);
            activePlayer.energy = Math.min(activePlayer.maxEnergy, activePlayer.energy + passed * 2);
        }
    }

    checkMultiLevelUp(); calculateStats(); saveData(); updateGameUI(); checkDailyChestStatus();
    openScreen('game-container'); openGameScreen('game-menu-screen');
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
    document.getElementById('profile-about-text').innerText = activePlayer.aboutText;
    document.getElementById('profile-gender-text').innerText = activePlayer.gender;
    document.getElementById('profile-reg-date').innerText = formatFullKyivDateTime(activePlayer.regTimestamp);
    document.getElementById('profile-last-seen').innerText = activePlayer.lastSeenTimeFormatted || "Только что";
    document.getElementById('profile-id').innerText = activePlayer.userId;
    openGameScreen('profile-screen');
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
    openGameScreen('profile-settings-screen');
}

function saveProfileSettings() {
    const newUsername = document.getElementById('settings-username-input').value.trim();
    
    // Проверка на пустое поле
    if (newUsername === "") {
        showGameAlert("Никнейм не может быть пустым!");
        return;
    }

    // Если игрок решил изменить ник
    if (newUsername !== activePlayer.username) {
        // Проверяем, не занят ли новый ник другим игроком
        if (localStorage.getItem('rpg_user_' + newUsername)) {
            showGameAlert("Этот никнейм уже занят другим воином Хаоса!");
            return;
        }
        
        // Удаляем сохранение со старым ником
        localStorage.removeItem('rpg_user_' + activePlayer.username);
        
        // Присваиваем новый ник
        activePlayer.username = newUsername;
    }

    // Сохраняем остальные данные
    activePlayer.aboutText = document.getElementById('settings-about-input').value.trim() || "Не заполнено";
    activePlayer.gender = document.getElementById('settings-gender-select').value;
    
    saveData(); // Функция saveData должна сохранять по новому activePlayer.username
    openProfileScreen(); 
    
    // Обновляем интерфейс (нижний инфо-бар и прочее), чтобы сразу показать новый ник
    if (typeof updateGameUI === 'function') {
        updateGameUI();
    }
}

function checkDailyChestStatus() {
    const todayStr = getKyivDateString();
    const statusText = document.getElementById('daily-chest-status');
    const chestBtn = document.getElementById('daily-chest-btn');
    if (activePlayer.lastChestClaimDate === todayStr) {
        statusText.innerText = "⏳ Награда собрана! Ждите 00:00"; chestBtn.disabled = true; chestBtn.innerText = "Закрыто";
    } else {
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
    
    const swordPrice = (t.sword + 1) * 15;
    const armorPrice = (t.armor + 1) * 15;
    const shieldPrice = (t.shield + 1) * 15;

    const swordBonus = Math.floor(t.sword * 0.05 * activePlayer.level * 1000);
    const armorBonus = Math.floor(t.armor * 0.05 * activePlayer.level * 100);
    const shieldBonus = Math.floor(t.shield * 0.05 * activePlayer.level * 500);

    document.getElementById('train-level-sword').innerText = t.sword;
    document.getElementById('train-bonus-sword').innerText = formatNum(swordBonus);
    document.getElementById('price-train-sword').innerText = formatNum(swordPrice);

    document.getElementById('train-level-armor').innerText = t.armor;
    document.getElementById('train-bonus-armor').innerText = formatNum(armorBonus);
    document.getElementById('price-train-armor').innerText = formatNum(armorPrice);

    document.getElementById('train-level-shield').innerText = t.shield;
    document.getElementById('train-bonus-shield').innerText = formatNum(shieldBonus);
    document.getElementById('price-train-shield').innerText = formatNum(shieldPrice);
}

function upgradeEquipment(type) {
    if (!activePlayer) return;
    const t = activePlayer.training;
    const currentLvl = t[type];
    const price = (currentLvl + 1) * 15;
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
        
        msgBox.innerHTML = `✔️ ${equipmentName} успешно улучшен до уровня ${t[type]}!`;
        msgBox.className = "log-success"; 
        msgBox.classList.remove('hidden');
    }
}

// РАСЧЁТ СТАТИСТИКИ С УЧЁТОМ АЛТАРЯ ВОЙНЫ (+1% ЗА УРОВЕНЬ)
function calculateStats() {
    if (!activePlayer) return;
    
    if (!activePlayer.training) activePlayer.training = { sword: 0, armor: 0, shield: 0 };
    const t = activePlayer.training;

    const swordBonus = Math.floor(t.sword * 0.05 * activePlayer.level * 1000);
    const armorBonus = Math.floor(t.armor * 0.05 * activePlayer.level * 100);
    const shieldBonus = Math.floor(t.shield * 0.05 * activePlayer.level * 500);

    // Базовые статы игрока
    let baseAttack = 15 + (activePlayer.level * 1000) + forgeAttack + swordBonus;
    let baseDefense = 10 + (activePlayer.level * 500) + forgeDefense + shieldBonus;
    let baseMaxHp = 1000 + (activePlayer.level * 100) + armorBonus;

    // Считаем бонус от Алтаря Войны (+1% за уровень)
    let warBonusPercent = 0;
    if (activePlayer.clanName) {
        let clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan && clan.altarWar) {
            warBonusPercent = clan.altarWar * 1; 
        }
    }

    activePlayer.attack = Math.floor(baseAttack * (1 + warBonusPercent / 100));
    activePlayer.defense = Math.floor(baseDefense * (1 + warBonusPercent / 100));
    activePlayer.maxHp = Math.floor(baseMaxHp * (1 + warBonusPercent / 100));
   
    saveData();
    updateGameUI();
}

function checkMultiLevelUp() {
    let levelUpOccurred = false; 
    let required = getRequiredExp(activePlayer.level);
    
    while (activePlayer.exp >= required) { 
        activePlayer.exp -= required; 
        activePlayer.level += 1; 
        
        // Добавляем +100 к максимальной энергии при получении уровня
        if (!activePlayer.maxEnergy) activePlayer.maxEnergy = 1000;
        activePlayer.maxEnergy += 100;

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
    document.getElementById('exp-bar-fill').style.width = `${Math.min(100, (activePlayer.exp / nextExpLimit) * 100)}%`;
}

function logout() { saveData(); activePlayer = null; openScreen('main-screen'); }
function saveData() { if (activePlayer) { activePlayer.lastOnlineTime = Date.now(); localStorage.setItem('rpg_user_' + activePlayer.username, JSON.stringify(activePlayer)); } }

setInterval(() => {
    if (activePlayer) {
        let changed = false;
        if (activePlayer.hp < activePlayer.maxHp) {
            activePlayer.hp = Math.min(activePlayer.maxHp, activePlayer.hp + 20);
            changed = true;
        }
        if (activePlayer.energy < activePlayer.maxEnergy) {
            activePlayer.energy = Math.min(activePlayer.maxEnergy, activePlayer.energy + 2);
            changed = true;
        }
        if (changed) {
            saveData(); 
            updateGameUI();
        }
    }
}, 1000);

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
    resetBattleButtons(); openGameScreen('adventure-battle-screen');
}

function startAdventure() {
    currentBattleType = "adventure"; currentMonsterIndex = activePlayer.currentMonsterIndex; loadMonster(currentMonsterIndex);
    document.getElementById('battle-log').className = "hidden"; resetBattleButtons(); openGameScreen('adventure-battle-screen');
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
}

function resetBattleButtons() {
    document.getElementById('battle-controls').innerHTML = `<button class="btn btn-attack" onclick="attackMonster()">⚔️ Ударить</button>`;
    document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Покинуть бой</button>`;
}

function attackMonster() {
    if (!activePlayer || !currentMonster || currentMonster.hp <= 0 || activePlayer.hp <= 0) return;
    const logBox = document.getElementById('battle-log');
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
    document.getElementById('monster-hp').innerText = formatNum(currentMonster.hp); showDamageAnimation(playerDamage);
    roundLog += `<div class="log-line-player">Вы ударили ${currentMonster.shortName} на ${formatNum(playerDamage)} хп.</div>`;
    if (currentMonster.hp === 0) { handleMonsterDeath(roundLog); return; }

    let finalMonsterDamage = Math.max(1, (Math.floor(Math.random() * 5) + Math.floor(currentMonster.attack * 0.8)) - activePlayer.defense);
    activePlayer.hp = Math.max(0, activePlayer.hp - finalMonsterDamage);
    roundLog += `<div class="log-line-monster">${currentMonster.shortName} ударил Вас на ${formatNum(finalMonsterDamage)} хп.</div>`;
    if (activePlayer.hp === 0) {
        roundLog += `<div class="log-line-system">💀 Вы погибли! Раны затягиваются...</div>`;
        document.getElementById('battle-controls').innerHTML = ``;
        document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Назад</button>`;
    }
    logBox.innerHTML = roundLog; saveData();
}

function buyEnergy(price) {
    const logBox = document.getElementById('battle-log'); if (activePlayer.silver < price) { logBox.innerHTML = `Недостаточно монет!`; logBox.className = "log-error"; return; }
    activePlayer.silver -= price; activePlayer.energy = activePlayer.maxEnergy; logBox.innerHTML = `Вы восстановили энергию за ${formatNum(price)} серебра`; logBox.className = "log-success"; saveData();
}
function showDamageAnimation(amount) {
    const zone = document.getElementById('damage-effect-zone'); const num = document.createElement('div'); num.classList.add('floating-damage');
    num.innerText = `-${formatNum(amount)}`; num.style.left = `${Math.floor(Math.random() * 80) + 100}px`; zone.appendChild(num); setTimeout(() => { num.remove(); }, 600);
}

function handleMonsterDeath(existingLog) {
    // Засчитываем прогресс квестов
    if (currentBattleType === "dungeon") {
        addQuestProgress("dungeons", 1); // Квест: Сходить в подземелье и убить там 5 монстров
    } else {
        addQuestProgress("monsters", 1); // Квест: Пройти 12 монстров в Приключении
    }

    // ВЫЧИСЛЯЕМ БОНУС К ОПЫТУ ОТ АЛТАРЯ МУДРОСТИ (+2% ЗА УРОВЕНЬ)
    let expBonusPercent = 0;
    if (activePlayer.clanName) {
        let clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan && clan.altarWisdom) {
            expBonusPercent = clan.altarWisdom * 2; 
        }
    }
    let finalMonsterExp = Math.floor(currentMonster.exp * (1 + expBonusPercent / 100));

    activePlayer.exp += finalMonsterExp; 
    activePlayer.silver += currentMonster.silver;
    
    let currentLvlBefore = activePlayer.level; let levelUpOccurred = checkMultiLevelUp();

    // НАДЁЖНОЕ НАЧИСЛЕНИЕ ОПЫТА КЛАНУ (С НОВОЙ КВАДРАТИЧНОЙ ФОРМУЛОЙ)
    if (activePlayer.clanName) {
        let clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan) {
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

            // Сохраняем обновленный объект клана в локальное хранилище СРАЗУ
            localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));

            // Если уровень клана повысился, выводим сообщение в лог боя
            if (clanLevelUp) {
                existingLog += `<div style="color: #df7fe0; font-weight: bold; margin-top: 5px;">🏰 Уровень Клана повышен до ${clan.level}! 🏰</div>`;
            }
        }
    }

    if (currentBattleType === "adventure") { activePlayer.currentMonsterIndex += 1; currentMonsterIndex = activePlayer.currentMonsterIndex; }
    saveData(); const logBox = document.getElementById('battle-log');
    let systemLog = `<div class="log-line-system">⚔️ Победа! Получено: Опыт +${formatNum(finalMonsterExp)} | Серебро +${formatNum(currentMonster.silver)}</div>`;
    if (levelUpOccurred) systemLog += `<div class="lvl-up-text">⭐ Новый уровень (+${activePlayer.level - currentLvlBefore})! ⭐</div>`;
    logBox.innerHTML = existingLog + systemLog;
    if (currentBattleType === "adventure") {
        document.getElementById('battle-controls').innerHTML = `<button class="btn btn-adventure" onclick="nextMonsterStage()">▶️ Дальше</button>`;
    } else {
        document.getElementById('battle-controls').innerHTML = ``;
    }
    document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Назад</button>`;
}
function nextMonsterStage() { document.getElementById('battle-log').classList.add('hidden'); loadMonster(currentMonsterIndex); resetBattleButtons(); }
function leaveBattle() { currentBattleType === "adventure" ? openGameScreen('game-menu-screen') : openDungeonMenu(); }

function updateKyivTime() {
    const timeElement = document.getElementById('kyiv-time'); if (!timeElement) return;
    timeElement.innerText = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
setInterval(updateKyivTime, 1000);

// КЛАНОВАЯ СИСТЕМА
function openClanMenu() {
    if (!activePlayer) return;
    if (!activePlayer.clanName) { openGameScreen('clan-none-screen'); } 
    else { updateClanUI(); openGameScreen('clan-main-screen'); }
}

function createClan() {
    const clanNameInput = document.getElementById('clan-create-name').value.trim();
    if (!clanNameInput) return showGameAlert("Введите название клана!");
    if (clanNameInput.length < 3) return showGameAlert("Название слишком короткое!");
    if (localStorage.getItem('rpg_clan_' + clanNameInput)) { return showGameAlert("Такой клан уже существует!"); }
    if (activePlayer.silver < 1000) { return showGameAlert("Недостаточно серебра! Требуется 1,000 🪙"); }

    activePlayer.silver -= 1000; activePlayer.clanName = clanNameInput;
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
        stats: {} // Хранилище статистики вкладов
    };
    clanData.stats[activePlayer.username] = { gold: 0, exp: 0 }; 

    localStorage.setItem('rpg_clan_' + clanNameInput, JSON.stringify(clanData));
    saveData(); updateGameUI(); updateClanUI(); openGameScreen('clan-main-screen');
    showGameAlert(`Клан "<b>${clanNameInput}</b>" успешно основан!`);
}

// ЗОЛОТАЯ ШАХТА С ЛИМИТОМ И БОНУСОМ АЛТАРЯ БОГАТСТВА
function openGoldMine() { 
    document.getElementById('mine-log').className = "hidden"; 
    updateGoldMineUI();
    openGameScreen('gold-mine-screen'); 
}

function updateGoldMineUI() {
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

    const today = getKyivDateString();
    
    // Если наступил новый день, сбрасываем суточную добычу
    if (clan.lastMineDate !== today) {
        clan.lastMineDate = today;
        clan.minedToday = 0;
        localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));
    }

    // Суточный Лимит = Уровень Клана * 1000
    const dailyLimit = clan.level * 1000;
    const currentMined = clan.minedToday || 0;

    document.getElementById('mine-daily-extracted').innerText = formatNum(currentMined);
    document.getElementById('mine-daily-limit').innerText = formatNum(dailyLimit);
}

function mineGold() {
    if (!activePlayer || !activePlayer.clanName) return; const logBox = document.getElementById('mine-log');
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;

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

    // Бонус от Алтаря Богатства
    let wealthBonus = clan.altarWealth || 0;
    let minedGold = (Math.floor(Math.random() * 5) + 1) + wealthBonus; 

    // Срезаем излишки, чтобы не выйти за рамки суточного лимита
    if (currentMined + minedGold > dailyLimit) {
        minedGold = dailyLimit - currentMined;
    }

    clan.gold += minedGold;
    clan.minedToday = (clan.minedToday || 0) + minedGold;

    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); saveData(); updateGameUI(); updateGoldMineUI();
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
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;

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

    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); saveData(); updateGameUI(); updateClanUI(); closeDepositSilverModal();
    
    // Перерисовываем таблицу вкладов
    const statsBlock = document.getElementById('clan-stats-block');
    if (statsBlock && !statsBlock.classList.contains('hidden')) {
        renderClanStats();
    }

    showGameAlert(`Вы внесли ${formatNum(amount)} серебра. Казна пополнена на +${formatNum(amount)} Золота!`);
}

function updateClanUI() {
    if (!activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;
    
    let reqExp = getRequiredClanExp(clan.level); // Квадратичная формула
    
    document.getElementById('clan-display-name').innerText = clan.name;
    document.getElementById('clan-display-img').src = clan.logo || "clan.png";
    document.getElementById('clan-display-level').innerText = clan.level;
    document.getElementById('clan-display-exp').innerText = formatNum(clan.exp);
    document.getElementById('clan-display-next-exp').innerText = formatNum(reqExp);
    document.getElementById('clan-display-about').innerText = clan.about;
    document.getElementById('clan-display-gold').innerText = formatNum(clan.gold);
}

function openClanSettings() {
    if (!activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;
    document.getElementById('clan-edit-name').value = clan.name; document.getElementById('clan-edit-about').value = clan.about;
    openGameScreen('clan-settings-screen');
}

function saveClanSettings() {
    if (!activePlayer.clanName) return;
    const oldName = activePlayer.clanName; const newName = document.getElementById('clan-edit-name').value.trim();
    const newAbout = document.getElementById('clan-edit-about').value.trim() || "Без описания";
    if (!newName) return showGameAlert("Название не может быть пустым!");
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + oldName)); if (!clan) return;
    clan.about = newAbout;
    if (newName !== oldName) {
        if (localStorage.getItem('rpg_clan_' + newName)) { return showGameAlert("Это название уже занято!"); }
        clan.name = newName; localStorage.removeItem('rpg_clan_' + oldName); activePlayer.clanName = newName; saveData();
    }
    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); updateClanUI(); openGameScreen('clan-main-screen');
    showGameAlert("Настройки сохранены!");
}

function triggerClanLogoUpload() { document.getElementById('clan-logo-input').click(); }
function handleClanLogoUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!activePlayer.clanName) return;
        const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan) { clan.logo = e.target.result; localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); document.getElementById('clan-display-img').src = e.target.result; showGameAlert("Логотип обновлен!"); }
    };
    reader.readAsDataURL(file);
}

function openClanMembers() {
    document.getElementById('clan-members-list').innerHTML = `<div>👑 <b>Лидер:</b> ${activePlayer.username}</div>`;
    document.getElementById('clan-display-count').innerText = "1"; openGameScreen('clan-members-screen');
}

function leaveClan() {
    showGameConfirm("Вы действительно хотите покинуть клан?", function() {
        activePlayer.clanName = ""; saveData(); openGameScreen('game-menu-screen'); showGameAlert("Вы покинули клан.");
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

        // УЧИТЫВАЕМ БОНУС К ОПЫТУ ОТ АЛТАРЯ МУДРОСТИ КЛАНА (+2% ЗА УРОВЕНЬ)
        let expBonusPercent = 0;
        let clan = null;
        
        if (activePlayer.clanName) {
            clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
            if (clan && clan.altarWisdom) {
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

            // Сохраняем клан
            localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));

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
 * СИСТЕМА: БАШНЯ КЛАНА И КЛАНОВЫЕ АЛТАРИ (УЛУЧШЕНИЯ)
 * =======================================================================
 */

function getAltarUpgradePrice(currentLvl) {
    return 100 + (currentLvl * currentLvl * 150);
}

function openClanTower() {
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

    // Безопасно находим элемент в HTML-документе перед проверкой
    const msgBox = document.getElementById('tower-msg');
    if (msgBox) {
        msgBox.classList.add('hidden');
        msgBox.innerHTML = "";
    }

    if (clan.altarWar === undefined) clan.altarWar = 0;
    if (clan.altarWisdom === undefined) clan.altarWisdom = 0;
    if (clan.altarWealth === undefined) clan.altarWealth = 0;
    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));

    updateClanTowerUI();
    openGameScreen('clan-tower-screen');
}

function updateClanTowerUI() {
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

    document.getElementById('tower-clan-gold').innerText = formatNum(clan.gold);

    // 1. Алтарь Войны (+1% статы)
    const warLvl = clan.altarWar || 0;
    const warPrice = getAltarUpgradePrice(warLvl);
    document.getElementById('altar-lvl-war').innerText = warLvl;
    document.getElementById('altar-bonus-war').innerText = warLvl * 1;
    document.getElementById('altar-price-war').innerText = formatNum(warPrice);

    // 2. Алтарь Мудрости (+2% опыт)
    const wisLvl = clan.altarWisdom || 0;
    const wisPrice = getAltarUpgradePrice(wisLvl);
    document.getElementById('altar-lvl-wisdom').innerText = wisLvl;
    document.getElementById('altar-bonus-wisdom').innerText = wisLvl * 2;
    document.getElementById('altar-price-wisdom').innerText = formatNum(wisPrice);

    // 3. Алтарь Богатства (+1 к клику)
    const weaLvl = clan.altarWealth || 0;
    const weaPrice = getAltarUpgradePrice(weaLvl);
    document.getElementById('altar-lvl-wealth').innerText = weaLvl;
    document.getElementById('altar-bonus-wealth').innerText = weaLvl;
    document.getElementById('altar-price-wealth').innerText = formatNum(weaPrice);
}

function upgradeAltar(altarKey) {
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

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

    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));

    calculateStats();
    updateClanTowerUI();
    updateClanUI();

    if (msgBox) {
        let altarName = "Алтарь";
        if (altarKey === 'altarWar') altarName = "🔥 Алтарь Войны";
        if (altarKey === 'altarWisdom') altarName = "🔮 Алтарь Мудрости";
        if (altarKey === 'altarWealth') altarName = "⛏️ Алтарь Богатства";

        msgBox.innerHTML = `✔️ ${altarName} успешно пробужден до уровня ${currentLvl + 1}!`;
        msgBox.className = "log-success"; 
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
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

    const statsList = document.getElementById('clan-stats-list');
    const resetContainer = document.getElementById('clan-reset-stats-container');
    if (!statsList) return;

    statsList.innerHTML = "";

    if (!clan.stats) clan.stats = {};

    // Оффлайн игра, поэтому список состоит только из самого игрока
    const members = [activePlayer.username]; 

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
                ${memberUsername} ${isOwner ? '👑' : ''}
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
    if (!activePlayer || !activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
    if (!clan) return;

    if (clan.owner !== activePlayer.username) {
        showGameAlert("Только Владыка Клана имеет право стирать летопись вкладов!");
        return;
    }

    showGameConfirm("Вы действительно хотите обнулить показатели вклада (золота и опыта) всех участников? Это действие необратимо.", function() {
        clan.stats = {};
        clan.stats[activePlayer.username] = { gold: 0, exp: 0 };

        localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));
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
        // Успешное убийство — начисляем 50 временного Золота
        supremacyStats.kills += 1;
        supremacyStats.goldEarned += 50;

        fightLog = `<div style="color: #ffd700; font-weight: bold;">🏆 Победа над защитником!</div>
                    <div style="color: #4de64d; font-size: 11px;">Вы заработали +50 Золота в копилку Превосходства!</div>`;
        
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
    if (supremacyStats.goldEarned > 0 && activePlayer.clanName) {
        const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan) {
            // Начисляем в казну клана
            clan.gold += supremacyStats.goldEarned;

            // Записываем вклад в общую таблицу статистики клана
            if (!clan.stats) clan.stats = {};
            if (!clan.stats[activePlayer.username]) {
                clan.stats[activePlayer.username] = { gold: 0, exp: 0 };
            }
            clan.stats[activePlayer.username].gold += supremacyStats.goldEarned;

            localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));

            showGameAlert(`👑 <b>Превосходство завершено!</b><br><br>Вы успешно защитили честь клана, совершили <b>${supremacyStats.kills}</b> убийств и передали в казну:<br><span style="color:#ffd700; font-size:16px; font-weight:bold;">+${supremacyStats.goldEarned} Золота!</span>`);
            
            // Сбрасываем временную сессию
            supremacyStats.kills = 0;
            supremacyStats.goldEarned = 0;
        }
    }

    document.getElementById('sup-log').classList.add('hidden');
    document.getElementById('sup-log').innerHTML = "";
    
    openGameScreen('game-menu-screen');
}

/**
 * =======================================================================
 * СИСТЕМА: ЧАТ "БЕСЕДКА" С ОБРАЩЕНИЯМИ И БОТАМИ (В СТИЛЕ XAOS.MOBI)
 * =======================================================================
 */

// Пул WAP-фраз для ботов, чтобы создать иллюзию живого чата
const botChatPhrases = [
    "Кто на Арену? Го дуэль, покажу кто тут батя!",
    "Капец, Дракон в Бездне опять ваншотнул, как его танковать вообще?",
    "Ребят, у кого какой уровень алтаря богатства в клане?",
    "Ахах, я только что выбил крутой крит на арене, бот улетел с двух тык!",
    "Всем ку! Как дела в шахте, золото есть?",
    "Ворона берёза, Нету у тебя, я их слопал 🐸",
    "Да ладно вам спорить, пошли лучше боссов в данже пинать.",
    "Энергия так медленно копится, пойду серебро в клан закину.",
    "Админ, когда новые промокоды будут?)"
];

function openChatScreen() {
    if (!activePlayer) return;
    
    // Инициализируем сообщения в localStorage, если чат пуст
    if (!localStorage.getItem('rpg_chat_messages')) {
        generateInitialChat();
    }
    
    openGameScreen('chat-screen');
    renderChatMessages();
    
    // Автопрокрутка чата вниз
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;
}

// Генерируем стартовые сообщения от ботов для атмосферы
function generateInitialChat() {
    const initialMsgs = [];
    let timeOffset = Date.now() - 300000; // 5 минут назад

    for (let i = 0; i < 6; i++) {
        const botName = botNames[Math.floor(Math.random() * botNames.length)];
        const phrase = botChatPhrases[Math.floor(Math.random() * botChatPhrases.length)];
        const gender = Math.random() > 0.5 ? "Мужской" : "Женский";
        
        initialMsgs.push({
            username: botName,
            text: phrase,
            gender: gender,
            timestamp: timeOffset
        });
        timeOffset += 45000; // интервал 45 сек
    }
    localStorage.setItem('rpg_chat_messages', JSON.stringify(initialMsgs));
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

// Отрисовка чата
function renderChatMessages() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;

    const msgs = JSON.parse(localStorage.getItem('rpg_chat_messages')) || [];
    box.innerHTML = "";

    msgs.forEach(m => {
        // Определяем иконку пола
        let genderIcon = "🧑‍💻";
        if (m.gender === "Женский") genderIcon = "👩‍💻";
        else if (m.gender === "Не указан") genderIcon = "👤";

        // Класс для выделения ника Админа
        const isMsgAdmin = m.username.toLowerCase() === 'admin';
        const nameColor = isMsgAdmin ? '#ffae19' : '#4da6ff';

        // Создаем блок сообщения
        const msgRow = document.createElement('div');
        msgRow.style.marginBottom = "10px";
        msgRow.style.fontSize = "13px";
        msgRow.style.lineHeight = "1.4";

        msgRow.innerHTML = `
            <span style="font-size: 12px; margin-right: 3px;">${genderIcon}</span>
            <span onclick="insertNicknameReply('${m.username}')" style="color: ${nameColor}; font-weight: bold; cursor: pointer; text-decoration: underline;">
                ${m.username}
            </span>: 
            <span class="chat-text" style="color: #dfdfdf;">${m.text}</span>
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

// Отправка сообщения
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const msgs = JSON.parse(localStorage.getItem('rpg_chat_messages')) || [];
    
    // Добавляем сообщение игрока
    msgs.push({
        username: activePlayer.username,
        text: text,
        gender: activePlayer.gender || "Не указан",
        timestamp: Date.now()
    });

    // Ограничиваем историю чата до 40 сообщений
    if (msgs.length > 40) msgs.shift();

    localStorage.setItem('rpg_chat_messages', JSON.stringify(msgs));
    input.value = "";
    renderChatMessages();

    // Скролл вниз
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;

    // Шанс 80% на то, что боты отреагируют или ответят игроку через 1.5 секунды
    setTimeout(() => {
        handleBotReaction(text);
    }, 1500);
}

// Логика авто-ответов ботов
function handleBotReaction(playerText) {
    const msgs = JSON.parse(localStorage.getItem('rpg_chat_messages')) || [];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    const gender = Math.random() > 0.5 ? "Мужской" : "Женский";
    
    let replyText = "";

    // Проверяем, обратился ли игрок к кому-то конкретному
    const replyMatch = playerText.match(/^([^,]+),/);
    if (replyMatch) {
        const addressedTo = replyMatch[1].trim();
        // Если игрок обратился лично к боту
        if (botNames.includes(addressedTo) || addressedTo.toLowerCase() === 'admin') {
            const botPhrases = [
                `Да-да? Я тут! Что скажешь?`,
                `Та подожди ты, я на арене дерусь! ⚔️`,
                `Полностью с тобой согласен!`,
                `Ха-ха, забавно) Слышь, го дуэль лучше?`,
                `Я за этим не слежу, если честно.`
            ];
            replyText = `${activePlayer.username}, ${botPhrases[Math.floor(Math.random() * botPhrases.length)]}`;
        }
    }

    // Если прямого обращения не было, бот просто кидает рандомную фразу
    if (!replyText) {
        replyText = botChatPhrases[Math.floor(Math.random() * botChatPhrases.length)];
    }

    msgs.push({
        username: botName,
        text: replyText,
        gender: gender,
        timestamp: Date.now()
    });

    if (msgs.length > 40) msgs.shift();
    localStorage.setItem('rpg_chat_messages', JSON.stringify(msgs));

    // Перерисовываем чат, если игрок всё ещё на этом экране
    const scr = document.getElementById('chat-screen');
    if (scr && !scr.classList.contains('hidden')) {
        renderChatMessages();
        const box = document.getElementById('chat-messages-box');
        if (box) box.scrollTop = box.scrollHeight;
    }
}

function refreshChat() {
    renderChatMessages();
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;
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
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
