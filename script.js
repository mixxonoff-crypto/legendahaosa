let activePlayer = null;
let currentBattleType = "adventure"; 

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
    { name: "Тролль", hp: 11000, maxHp: 11000, attack: 450, image: "troll.jpg", exp: 1150, silver: 700, icon: "👹" }
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
      { 
        name: "Повелитель Пустоты", 
        hp: 150000000, 
        maxHp: 150000000, 
        attack: 900000, 
        image: "void_lord.jpg", 
        exp: 30000, 
        silver: 200000, 
        icon: "🌌", 
        reqLvl: 120, 
        qText: "Астральный разлом", 
        qClass: "q-dark" 
    },
    { 
        name: "Титан Стихий", 
        hp: 300000000, 
        maxHp: 300000000, 
        attack: 1500000, 
        image: "elemental_titan.jpg", 
        exp: 35000, 
        silver: 250000, 
        icon: "🌀", 
        reqLvl: 140, 
        qText: "Пик Стихий", 
        qClass: "q-epic" 
    },
    { 
        name: "Хранитель Бездны", 
        hp: 700000000, 
        maxHp: 700000000, 
        attack: 3000000, 
        image: "abyss_guardian.jpg", 
        exp: 40000, 
        silver: 300000, 
        icon: "💀", 
        reqLvl: 160, 
        qText: "Сердце Бездны", 
        qClass: "q-black" 
    },

];

let currentMonster = null;
let currentMonsterIndex = 0;

function toRoman(num) {
    if (num < 1) return "";
    const lookup = { M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1 };
    let roman = "";
    for (let i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
    return roman;
}

function getRequiredExp(level) { return 100 + (level - 1) * 50; }
function getEnergyPrice(level) { return 100 + (level * 2); }

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
    document.getElementById('profile-attack').innerText = activePlayer.attack;
    document.getElementById('profile-hp').innerText = activePlayer.hp;
    document.getElementById('profile-max-hp').innerText = activePlayer.maxHp;
    document.getElementById('profile-defense').innerText = activePlayer.defense;
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
    document.getElementById('settings-about-input').value = activePlayer.aboutText;
    document.getElementById('settings-gender-select').value = activePlayer.gender;
    openGameScreen('profile-settings-screen');
}
function saveProfileSettings() {
    activePlayer.aboutText = document.getElementById('settings-about-input').value.trim() || "Не заполнено";
    activePlayer.gender = document.getElementById('settings-gender-select').value;
    saveData(); openProfileScreen(); 
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
    document.getElementById('chest-result').innerHTML = `🎉 Вы получили <span style="color:#ffae19; font-weight:bold;">${rewardSilver}</span> серебра!`;
    document.getElementById('chest-modal-controls').innerHTML = `<button class="btn btn-secondary" onclick="closeChestModal()">Закрыть</button>`;
}

function calculateStats() {
    if (!activePlayer) return;
    
 activePlayer.attack = 15 + (activePlayer.level * 1000) + forgeAttack;
    activePlayer.defense = 10 + (activePlayer.level * 500) + forgeDefense;
   
    saveData();
    updateGameUI();
}

function checkMultiLevelUp() {
    let levelUpOccurred = false; 
    let required = getRequiredExp(activePlayer.level);
    
    while (activePlayer.exp >= required) { 
        activePlayer.exp -= required; 
        activePlayer.level += 1; 
        activePlayer.maxHp += 100;
        activePlayer.maxEnergy += 100; 
        required = getRequiredExp(activePlayer.level); 
        levelUpOccurred = true; 
    }
    
    if (levelUpOccurred) { 
        activePlayer.hp = activePlayer.maxHp; 
        activePlayer.energy = activePlayer.maxEnergy; 
        calculateStats(); 
    }
    return levelUpOccurred;
}
 
function updateGameUI() {
    if (!activePlayer) return; let nextExpLimit = getRequiredExp(activePlayer.level);
    document.getElementById('display-hp').innerText = activePlayer.hp; document.getElementById('display-max-hp').innerText = activePlayer.maxHp;
    document.getElementById('display-energy').innerText = activePlayer.energy; document.getElementById('display-max-energy').innerText = activePlayer.maxEnergy;
    document.getElementById('display-attack').innerText = activePlayer.attack; document.getElementById('display-defense').innerText = activePlayer.defense;
    document.getElementById('display-username').innerText = activePlayer.username; document.getElementById('display-level').innerText = activePlayer.level;
    document.getElementById('display-exp').innerText = activePlayer.exp; document.getElementById('display-next-exp').innerText = nextExpLimit;
    document.getElementById('display-silver').innerText = activePlayer.silver;
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

function openForge() { document.getElementById('forge-log').className = "hidden"; updateForgeUI(); openGameScreen('forge-screen'); }
function updateForgeUI() {
    ['shlem', 'arms', 'mech', 'sapogi', 'shit'].forEach(item => {
        let lvl = activePlayer.equipment[item]; let cost = 15 + (lvl * 15); let quality = getItemQuality(lvl);
        document.getElementById(`${item}-lvl`).innerText = lvl; document.getElementById(`${item}-cost`).innerText = cost;
        document.getElementById(`${item}-quality`).innerText = quality.text; document.getElementById(`${item}-quality`).className = `item-quality ${quality.class}`;
    });
}
function upgradeItem(itemName) {
    const logBox = document.getElementById('forge-log'); let currentLvl = activePlayer.equipment[itemName]; let cost = 15 + (currentLvl * 15);
    if (activePlayer.silver < cost) { logBox.innerHTML = `Не хватает серебра!`; logBox.className = "forge-log log-error"; logBox.classList.remove('hidden'); return; }
    activePlayer.silver -= cost; activePlayer.equipment[itemName] += 1;
    logBox.innerHTML = `Улучшено до ${activePlayer.equipment[itemName]} уровня!`; logBox.className = "forge-log log-success"; logBox.classList.remove('hidden');
    calculateStats(); saveData(); updateForgeUI(); updateGameUI();
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
    document.getElementById('monster-hp').innerText = currentMonster.hp; document.getElementById('monster-max-hp').innerText = currentMonster.maxHp;
    document.getElementById('monster-img').src = currentMonster.image; document.getElementById('battle-log').className = "hidden";
    resetBattleButtons(); openGameScreen('adventure-battle-screen');
}

function startAdventure() {
    currentBattleType = "adventure"; currentMonsterIndex = activePlayer.currentMonsterIndex; loadMonster(currentMonsterIndex);
    document.getElementById('battle-log').className = "hidden"; resetBattleButtons(); openGameScreen('adventure-battle-screen');
}
function loadMonster(index) {
    if (index >= monsterDatabase.length) { activePlayer.battleCircle += 1; activePlayer.currentMonsterIndex = 0; index = 0; currentMonsterIndex = 0; saveData(); }
    const dbMonster = monsterDatabase[index]; const circle = activePlayer.battleCircle;
    currentMonster = { shortName: dbMonster.name, name: dbMonster.name, hp: dbMonster.hp * circle, maxHp: dbMonster.maxHp * circle, attack: dbMonster.attack * circle, image: dbMonster.image, exp: dbMonster.exp * circle, silver: dbMonster.silver * circle, icon: dbMonster.icon };
    document.getElementById('monster-name').innerText = `${currentMonster.icon} ${currentMonster.name}${circle > 1 ? " " + toRoman(circle) : ""}`;
    document.getElementById('monster-hp').innerText = currentMonster.hp; document.getElementById('monster-max-hp').innerText = currentMonster.maxHp;
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
        logBox.innerHTML = `У вас не хватает энергии!<br><button class="btn-buy-energy" onclick="buyEnergy(${currentPrice})">🔋 Восстановить энергию за ${currentPrice} 🪙</button>`;
        logBox.className = "log-error"; logBox.classList.remove('hidden'); return;
    }
    activePlayer.energy -= 2; logBox.className = ""; logBox.classList.remove('hidden');
    let roundLog = ""; let playerDamage = Math.floor(Math.random() * 6) + Math.floor(activePlayer.attack * 0.8);
    currentMonster.hp = Math.max(0, currentMonster.hp - playerDamage);
    document.getElementById('monster-hp').innerText = currentMonster.hp; showDamageAnimation(playerDamage);
    roundLog += `<div class="log-line-player">Вы ударили ${currentMonster.shortName} на ${playerDamage} хп.</div>`;
    if (currentMonster.hp === 0) { handleMonsterDeath(roundLog); return; }

    let finalMonsterDamage = Math.max(1, (Math.floor(Math.random() * 5) + Math.floor(currentMonster.attack * 0.8)) - activePlayer.defense);
    activePlayer.hp = Math.max(0, activePlayer.hp - finalMonsterDamage);
    roundLog += `<div class="log-line-monster">${currentMonster.shortName} ударил Вас на ${finalMonsterDamage} хп.</div>`;
    if (activePlayer.hp === 0) {
        roundLog += `<div class="log-line-system">💀 Вы погибли! Раны затягиваются...</div>`;
        document.getElementById('battle-controls').innerHTML = ``;
        document.getElementById('battle-leave-control').innerHTML = `<button class="btn btn-secondary" onclick="leaveBattle()">🏃 Назад</button>`;
    }
    logBox.innerHTML = roundLog; saveData();
}

function buyEnergy(price) {
    const logBox = document.getElementById('battle-log'); if (activePlayer.silver < price) { logBox.innerHTML = `Недостаточно монет!`; logBox.className = "log-error"; return; }
    activePlayer.silver -= price; activePlayer.energy = activePlayer.maxEnergy; logBox.innerHTML = `Вы восстановили энергию за ${price} серебра`; logBox.className = "log-success"; saveData();
}
function showDamageAnimation(amount) {
    const zone = document.getElementById('damage-effect-zone'); const num = document.createElement('div'); num.classList.add('floating-damage');
    num.innerText = `-${amount}`; num.style.left = `${Math.floor(Math.random() * 80) + 100}px`; zone.appendChild(num); setTimeout(() => { num.remove(); }, 600);
}

function handleMonsterDeath(existingLog) {
    activePlayer.exp += currentMonster.exp; activePlayer.silver += currentMonster.silver;
    let currentLvlBefore = activePlayer.level; let levelUpOccurred = checkMultiLevelUp();

    if (activePlayer.clanName) {
        let clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName));
        if (clan) {
            clan.exp += currentMonster.exp;
            let reqClanExp = 500 + (clan.level - 1) * 250;
            while (clan.exp >= reqClanExp) {
                clan.exp -= reqClanExp; clan.level += 1; reqClanExp = 500 + (clan.level - 1) * 250;
            }
            localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan));
        }
    }

    if (currentBattleType === "adventure") { activePlayer.currentMonsterIndex += 1; currentMonsterIndex = activePlayer.currentMonsterIndex; }
    saveData(); const logBox = document.getElementById('battle-log');
    let systemLog = `<div class="log-line-system">⚔️ Победа! Получено: Опыт +${currentMonster.exp} | Серебро +${currentMonster.silver}</div>`;
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

    activePlayer.silver -= 10000; activePlayer.clanName = clanNameInput;
    const clanData = { name: clanNameInput, level: 1, exp: 0, gold: 0, about: "Приветствуем воинов Хаоса!", logo: "clan.png", owner: activePlayer.username };
    localStorage.setItem('rpg_clan_' + clanNameInput, JSON.stringify(clanData));
    saveData(); updateGameUI(); updateClanUI(); openGameScreen('clan-main-screen');
    showGameAlert(`Клан "<b>${clanNameInput}</b>" успешно основан!`);
}

function updateClanUI() {
    if (!activePlayer.clanName) return;
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;
    let reqExp = 500 + (clan.level - 1) * 250;
    document.getElementById('clan-display-name').innerText = clan.name;
    document.getElementById('clan-display-img').src = clan.logo || "clan.png";
    document.getElementById('clan-display-level').innerText = clan.level;
    document.getElementById('clan-display-exp').innerText = clan.exp;
    document.getElementById('clan-display-next-exp').innerText = reqExp;
    document.getElementById('clan-display-about').innerText = clan.about;
    document.getElementById('clan-display-gold').innerText = clan.gold;
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

// ЗОЛОТАЯ ШАХТА
function openGoldMine() { document.getElementById('mine-log').className = "hidden"; openGameScreen('gold-mine-screen'); }
function mineGold() {
    if (!activePlayer || !activePlayer.clanName) return; const logBox = document.getElementById('mine-log');
    if (activePlayer.energy < 5) { logBox.innerHTML = "❌ Недостаточно энергии! Нужно 5 ⚡"; logBox.className = "log-error"; logBox.classList.remove('hidden'); return; }
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;

    activePlayer.energy -= 5; let minedGold = Math.floor(Math.random() * 5) + 1; clan.gold += minedGold;
    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); saveData(); updateGameUI();
    logBox.innerHTML = `⛏️ Бам! Из жилы вывалено <span style="color:#ffd700; font-weight:bold;">+${minedGold}</span> Золота в клановую казну!`; logBox.className = "log-success"; logBox.classList.remove('hidden');
}

// ВЗНОС СЕРЕБРА
function openDepositSilverModal() { document.getElementById('deposit-silver-amount').value = ""; document.getElementById('deposit-silver-modal').classList.remove('hidden'); }
function closeDepositSilverModal() { document.getElementById('deposit-silver-modal').classList.add('hidden'); }
function submitSilverDeposit() {
    const amount = parseInt(document.getElementById('deposit-silver-amount').value);
    if (isNaN(amount) || amount <= 0) return showGameAlert("Введите верное число!");
    if (activePlayer.silver < amount) return showGameAlert("Не хватает серебра!");
    const today = getKyivDateString();
    if (activePlayer.lastSilverDepositDate !== today) { activePlayer.lastSilverDepositDate = today; activePlayer.silverDepositedToday = 0; }
    if (activePlayer.silverDepositedToday + amount > 10000) { return showGameAlert(`Лимит! Вы можете внести еще максимум ${10000 - activePlayer.silverDepositedToday} серебра сегодня.`); }
    const clan = JSON.parse(localStorage.getItem('rpg_clan_' + activePlayer.clanName)); if (!clan) return;

    activePlayer.silver -= amount; activePlayer.silverDepositedToday += amount;

    // ПРЯМОЙ КУРС: 1 серебро = 1 золото клана
    clan.gold += amount; 

    localStorage.setItem('rpg_clan_' + activePlayer.clanName, JSON.stringify(clan)); saveData(); updateGameUI(); updateClanUI(); closeDepositSilverModal();
    showGameAlert(`Вы внесли ${amount} серебра. Казна пополнена на +${amount} Золота!`);
}
