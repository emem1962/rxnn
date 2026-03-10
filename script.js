// ===== TELEGRAM INIT =====
let tg = window.Telegram?.WebApp;
if (!tg) {
    document.body.innerHTML = `
        <div style="padding:30px;text-align:center;font-family:Arial;background:#0F172A;color:white;height:100vh;">
            <h2 style="color:#7C3AED;">⚠️ Telegram Required</h2>
            <p style="color:#94A3B8;margin-top:20px;">This game can only be played inside Telegram.</p>
            <p style="color:#94A3B8;">Please open @Rxn_coin bot in Telegram.</p>
        </div>
    `;
    throw new Error('Telegram Web App required');
}

tg.expand();
tg.ready();

// ===== USER DATA =====
const user = tg.initDataUnsafe?.user;
const userId = user?.id?.toString();
const username = user?.username || `user_${userId?.slice(-4)}`;
const firstName = user?.first_name || 'Farmer';
const lastName = user?.last_name || '';

if (!userId) {
    tg.showPopup({
        title: 'Error',
        message: 'Could not get user data. Please restart the bot.',
        buttons: [{ type: 'ok' }]
    });
    throw new Error('No user data');
}

// ===== DOM ELEMENTS =====
const contentArea = document.getElementById('contentArea');
const sections = {
    home: document.getElementById('homeSection'),
    earn: document.getElementById('earnSection'),
    top: document.getElementById('topSection'),
    friends: document.getElementById('friendsSection'),
    token: document.getElementById('tokenSection')
};

const navItems = document.querySelectorAll('.nav-item');
const rxnBalance = document.getElementById('rxnBalance');
const usernameDisplay = document.getElementById('usernameDisplay');
const userIdDisplay = document.getElementById('userIdDisplay');
const userInitials = document.getElementById('userInitials');

// ===== INITIAL DISPLAY =====
usernameDisplay.textContent = `@${username}`;
userIdDisplay.textContent = `ID: ${userId}`;
userInitials.textContent = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

// ===== GAME STATE =====
let gameState = {
    rxn: 0,
    stars: 0,
    level: 1,
    boostLevel: 'free',
    hourlyRate: 10,
    dailyMax: 240,
    lastFarm: null,
    farmCooldown: 4 * 60 * 60 * 1000, // 4 hours
    userRank: null,
    isInTop1000: false,
    boosts: {
        free: { multiplier: 1, stars: 0, hourly: 10, daily: 240, referral: 50, name: 'FREE' },
        bronze: { multiplier: 1.5, stars: 100, hourly: 15, daily: 360, referral: 75, name: 'BRONZE' },
        silver: { multiplier: 2, stars: 250, hourly: 20, daily: 480, referral: 100, name: 'SILVER' },
        gold: { multiplier: 3, stars: 500, hourly: 30, daily: 720, referral: 150, name: 'GOLD' },
        platinum: { multiplier: 5, stars: 1000, hourly: 50, daily: 1200, referral: 250, name: 'PLATINUM' }
    },
    wallets: {
        telegram: { connected: false, address: null },
        ton: { connected: false, address: null, balance: 0 },
        eth: { connected: false, address: null, balance: 0 },
        email: { connected: false, address: null }
    },
    tasks: {
        daily: [
            { id: 'login', name: 'Daily Login', reward: 10, completed: false },
            { id: 'invite', name: 'Invite 1 Friend', reward: 50, completed: false, max: 1, current: 0 },
            { id: 'top1000', name: 'Top 1000 Farmer', reward: 100, completed: false }
        ],
        events: [
            { id: 'weekend', name: 'Weekend Boost', multiplier: 2, active: true },
            { id: 'contest', name: 'Referral Contest', description: 'Top 10 win 1000 RXN', active: true }
        ]
    },
    referrals: [],
    leaderboard: {
        daily: [],
        weekly: [],
        alltime: []
    }
};

// ===== LOAD SAVED STATE =====
function loadState() {
    const saved = localStorage.getItem(`rxn_${userId}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState = { ...gameState, ...parsed };
            
            // Restore dates
            if (parsed.lastFarm) {
                gameState.lastFarm = new Date(parsed.lastFarm);
            }
            
            // Update boost display
            document.querySelectorAll('.boost-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.boost === gameState.boostLevel) {
                    item.classList.add('active');
                }
            });
            
            updateRXNBalance();
            updateFarmStats();
            updateWalletDisplay();
            loadReferrals();
            loadLeaderboard();
            loadTasks();
            
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
}

// ===== SAVE STATE =====
function saveState() {
    const toSave = {
        ...gameState,
        lastFarm: gameState.lastFarm?.toISOString()
    };
    localStorage.setItem(`rxn_${userId}`, JSON.stringify(toSave));
}

// ===== WALLET CONNECTIONS =====
const walletBalances = document.getElementById('walletBalances');

// Telegram Wallet Connection - GLOBAL OLMASI İÇIN window'a ekle
window.connectTelegramWallet = async function() {
    console.log('Connecting Telegram wallet...');
    
    tg.showPopup({
        title: 'Connect Telegram Wallet',
        message: 'Connect your Telegram wallet to start earning and claiming rewards.',
        buttons: [
            { type: 'default', text: 'Connect @wallet' },
            { type: 'default', text: 'Connect @tonkeeper' },
            { type: 'cancel' }
        ]
    }, async (buttonId) => {
        console.log('Popup button clicked:', buttonId);
        
        if (buttonId === '0') {
            // @wallet bot
            tg.showPopup({
                title: 'Opening @wallet',
                message: 'Please open @wallet bot and set up your wallet, then come back.',
                buttons: [{ type: 'ok' }]
            });
            
            tg.openTelegramLink('https://t.me/wallet');
            
            // Kullanıcıya bilgi ver
            setTimeout(() => {
                tg.showPopup({
                    title: '✅ Not Connected Yet',
                    message: 'After setting up your wallet in @wallet, click connect again.',
                    buttons: [{ type: 'ok' }]
                });
            }, 2000);
            
        } else if (buttonId === '1') {
            // Tonkeeper
            tg.showPopup({
                title: 'Opening Tonkeeper',
                message: 'Please open Tonkeeper and connect your wallet.',
                buttons: [{ type: 'ok' }]
            });
            
            tg.openLink('https://tonkeeper.com/');
            
            // Simulate connection for demo
            setTimeout(() => {
                const demoAddress = 'UQ' + Math.random().toString(36).substring(2, 10).toUpperCase();
                
                gameState.wallets.telegram = {
                    connected: true,
                    address: demoAddress,
                    walletType: 'tonkeeper'
                };
                
                // Demo balance
                gameState.wallets.ton = {
                    connected: true,
                    address: demoAddress,
                    balance: parseFloat((Math.random() * 50).toFixed(2))
                };
                
                updateWalletDisplay();
                saveState();
                
                tg.showPopup({
                    title: '✅ Wallet Connected!',
                    message: 'Your wallet has been connected successfully!',
                    buttons: [{ type: 'ok' }]
                });
                
                // Sayfayı güncelle
                location.reload();
            }, 1000);
        }
    });
};

// TON Wallet Connection
if (document.getElementById('connectTonBtn')) {
    document.getElementById('connectTonBtn').addEventListener('click', connectTonWallet);
}

async function connectTonWallet() {
    console.log('Connecting TON wallet...');
    
    if (window.ton && window.ton.isConnected) {
        try {
            const accounts = await window.ton.send('ton_requestAccounts');
            const address = accounts[0];
            
            gameState.wallets.ton = {
                connected: true,
                address: address,
                balance: await getTonBalance(address)
            };
            
            updateWalletDisplay();
            saveState();
            
            tg.showPopup({
                title: '✅ TON Wallet Connected',
                message: `Address: ${address.slice(0, 6)}...${address.slice(-4)}`,
                buttons: [{ type: 'ok' }]
            });
        } catch (error) {
            console.error('TON connection error:', error);
            tg.showPopup({
                title: '❌ Connection Failed',
                message: 'Could not connect to TON wallet. Please try again.',
                buttons: [{ type: 'ok' }]
            });
        }
    } else {
        tg.showPopup({
            title: 'TON Wallet Required',
            message: 'Please install TON wallet from @wallet bot first.',
            buttons: [
                { type: 'default', text: 'Open @wallet' },
                { type: 'cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === '0') {
                tg.openTelegramLink('https://t.me/wallet');
            }
        });
    }
}

// Ethereum Wallet Connection
if (document.getElementById('connectEthBtn')) {
    document.getElementById('connectEthBtn').addEventListener('click', connectEthWallet);
}

async function connectEthWallet() {
    console.log('Connecting Ethereum wallet...');
    
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const address = accounts[0];
            
            // Get ETH balance
            if (window.web3) {
                const web3 = new Web3(window.ethereum);
                const balance = await web3.eth.getBalance(address);
                const ethBalance = web3.utils.fromWei(balance, 'ether');
                
                gameState.wallets.eth = {
                    connected: true,
                    address: address,
                    balance: parseFloat(ethBalance)
                };
            } else {
                gameState.wallets.eth = {
                    connected: true,
                    address: address,
                    balance: 0.01 // demo
                };
            }
            
            updateWalletDisplay();
            saveState();
            
            tg.showPopup({
                title: '✅ Ethereum Wallet Connected',
                message: `Address: ${address.slice(0, 6)}...${address.slice(-4)}`,
                buttons: [{ type: 'ok' }]
            });
        } catch (error) {
            console.error('ETH connection error:', error);
            tg.showPopup({
                title: '❌ Connection Failed',
                message: 'Could not connect to Ethereum wallet. Please try again.',
                buttons: [{ type: 'ok' }]
            });
        }
    } else {
        tg.showPopup({
            title: 'MetaMask Required',
            message: 'Please install MetaMask first.',
            buttons: [
                { type: 'default', text: 'Download MetaMask' },
                { type: 'cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === '0') {
                tg.openLink('https://metamask.io/download.html');
            }
        });
    }
}

// Email Connection
if (document.getElementById('connectEmailBtn')) {
    document.getElementById('connectEmailBtn').addEventListener('click', connectEmail);
}

async function connectEmail() {
    console.log('Connecting email...');
    
    tg.showPopup({
        title: 'Submit Email',
        message: 'Enter your email address for airdrop notifications:',
        buttons: [
            { type: 'default', text: 'Submit' },
            { type: 'cancel' }
        ]
    }, (buttonId) => {
        if (buttonId === '0') {
            // Telegram showPopup ile direkt input alınamaz, prompt kullan
            const email = prompt('Enter your email address:');
            if (email && email.includes('@') && email.includes('.')) {
                gameState.wallets.email = {
                    connected: true,
                    address: email
                };
                
                updateWalletDisplay();
                saveState();
                
                tg.showPopup({
                    title: '✅ Email Submitted',
                    message: `You will receive airdrop updates at ${email}`,
                    buttons: [{ type: 'ok' }]
                });
            } else {
                tg.showPopup({
                    title: '❌ Invalid Email',
                    message: 'Please enter a valid email address.',
                    buttons: [{ type: 'ok' }]
                });
            }
        }
    });
}

function updateWalletDisplay() {
    if (!walletBalances) return;
    
    walletBalances.innerHTML = '';
    
    // Telegram Wallet göster (bağlı değilse buton göster)
    if (!gameState.wallets.telegram || !gameState.wallets.telegram.connected) {
        const connectButton = document.createElement('div');
        connectButton.className = 'wallet-connect-prompt';
        connectButton.innerHTML = `
            <button class="connect-telegram-wallet-btn" onclick="connectTelegramWallet()">
                <span class="wallet-icon">📱</span>
                Connect Telegram Wallet
            </button>
            <p class="wallet-hint">Required for claiming rewards</p>
        `;
        walletBalances.appendChild(connectButton);
    } else {
        // Connected wallet info
        const walletInfo = document.createElement('div');
        walletInfo.className = 'wallet-item connected-wallet';
        walletInfo.innerHTML = `
            <span class="wallet-name">Telegram Wallet</span>
            <span class="wallet-value">✅ Connected</span>
            <span class="wallet-address">${gameState.wallets.telegram.address.slice(0, 8)}...</span>
        `;
        walletBalances.appendChild(walletInfo);
    }
    
    // Diğer wallet balances
    const wallets = [
        { name: 'TON', value: gameState.wallets.ton?.balance?.toFixed(2) || '0.00', symbol: 'TON', connected: gameState.wallets.ton?.connected || false },
        { name: 'ETH', value: gameState.wallets.eth?.balance?.toFixed(4) || '0.0000', symbol: 'ETH', connected: gameState.wallets.eth?.connected || false },
        { name: 'STARS', value: gameState.stars, symbol: '⭐', connected: true }
    ];
    
    wallets.forEach(wallet => {
        if (wallet.connected || wallet.name === 'STARS') {
            const item = document.createElement('div');
            item.className = 'wallet-item';
            item.innerHTML = `
                <span class="wallet-name">${wallet.name}</span>
                <span class="wallet-value">${wallet.value} ${wallet.symbol}</span>
            `;
            walletBalances.appendChild(item);
        }
    });
    
    // Connected addresses (token section için)
    const addresses = document.getElementById('connectedAddresses');
    if (addresses) {
        const addrList = [];
        if (gameState.wallets.telegram?.connected) {
            addrList.push(`Telegram: ${gameState.wallets.telegram.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.ton?.connected) {
            addrList.push(`TON: ${gameState.wallets.ton.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.eth?.connected) {
            addrList.push(`ETH: ${gameState.wallets.eth.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.email?.connected) {
            addrList.push(`Email: ${gameState.wallets.email.address}`);
        }
        
        addresses.innerHTML = addrList.length > 0 ? addrList.join('<br>') : 'No wallets connected yet';
    }
}

// TON Wallet Connection
connectTonBtn.addEventListener('click', connectTonWallet);

async function connectTonWallet() {
    if (window.ton && window.ton.isConnected) {
        try {
            const accounts = await window.ton.send('ton_requestAccounts');
            const address = accounts[0];
            
            gameState.wallets.ton = {
                connected: true,
                address: address,
                balance: await getTonBalance(address)
            };
            
            updateWalletDisplay();
            saveState();
            
            tg.showPopup({
                title: 'TON Wallet Connected',
                message: `Address: ${address.slice(0, 6)}...${address.slice(-4)}`,
                buttons: [{ type: 'ok' }]
            });
        } catch (error) {
            console.error('TON connection error:', error);
        }
    } else {
        tg.openLink('https://t.me/wallet');
        
        tg.showPopup({
            title: 'TON Wallet Required',
            message: 'Please install TON wallet from @wallet bot first.',
            buttons: [{ type: 'ok' }]
        });
    }
}

// Ethereum Wallet Connection
connectEthBtn.addEventListener('click', connectEthWallet);

async function connectEthWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const address = accounts[0];
            
            const web3 = new Web3(window.ethereum);
            const balance = await web3.eth.getBalance(address);
            const ethBalance = web3.utils.fromWei(balance, 'ether');
            
            gameState.wallets.eth = {
                connected: true,
                address: address,
                balance: parseFloat(ethBalance)
            };
            
            updateWalletDisplay();
            saveState();
            
            tg.showPopup({
                title: 'Ethereum Wallet Connected',
                message: `Address: ${address.slice(0, 6)}...${address.slice(-4)}`,
                buttons: [{ type: 'ok' }]
            });
        } catch (error) {
            console.error('ETH connection error:', error);
        }
    } else {
        tg.openLink('https://metamask.io/download.html');
        
        tg.showPopup({
            title: 'MetaMask Required',
            message: 'Please install MetaMask first.',
            buttons: [{ type: 'ok' }]
        });
    }
}

// Email Connection
connectEmailBtn.addEventListener('click', connectEmail);

async function connectEmail() {
    tg.showPopup({
        title: 'Submit Email',
        message: 'Enter your email address for airdrop notifications:',
        buttons: [
            { type: 'default', text: 'Submit' },
            { type: 'cancel' }
        ]
    }, (buttonId) => {
        if (buttonId === '0') {
            const email = prompt('Enter your email address:');
            if (email && email.includes('@') && email.includes('.')) {
                gameState.wallets.email = {
                    connected: true,
                    address: email
                };
                
                updateWalletDisplay();
                saveState();
                
                tg.showPopup({
                    title: 'Email Submitted',
                    message: `You will receive airdrop updates at ${email}`,
                    buttons: [{ type: 'ok' }]
                });
            } else {
                tg.showPopup({
                    title: 'Invalid Email',
                    message: 'Please enter a valid email address.',
                    buttons: [{ type: 'ok' }]
                });
            }
        }
    });
}

function updateWalletDisplay() {
    walletBalances.innerHTML = '';
    
    // Telegram Wallet göster (bağlı değilse buton göster)
    if (!gameState.wallets.telegram.connected) {
        const connectButton = document.createElement('div');
        connectButton.className = 'wallet-connect-prompt';
        connectButton.innerHTML = `
            <button class="connect-telegram-wallet-btn" onclick="connectTelegramWallet()">
                <span class="wallet-icon">📱</span>
                Connect Telegram Wallet
            </button>
            <p class="wallet-hint">Required for claiming rewards</p>
        `;
        walletBalances.appendChild(connectButton);
    }
    
    // Diğer wallet balances
    const wallets = [
        { name: 'TON', value: gameState.wallets.ton.balance?.toFixed(2) || '0.00', symbol: 'TON', connected: gameState.wallets.ton.connected },
        { name: 'ETH', value: gameState.wallets.eth.balance?.toFixed(4) || '0.0000', symbol: 'ETH', connected: gameState.wallets.eth.connected },
        { name: 'STARS', value: gameState.stars, symbol: '⭐', connected: true }
    ];
    
    wallets.forEach(wallet => {
        if (wallet.connected || wallet.name === 'STARS') {
            const item = document.createElement('div');
            item.className = 'wallet-item';
            item.innerHTML = `
                <span class="wallet-name">${wallet.name}</span>
                <span class="wallet-value">${wallet.value} ${wallet.symbol}</span>
            `;
            walletBalances.appendChild(item);
        }
    });
    
    // Connected addresses
    const addresses = document.getElementById('connectedAddresses');
    if (addresses) {
        const addrList = [];
        if (gameState.wallets.telegram.connected) {
            addrList.push(`Telegram: ${gameState.wallets.telegram.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.ton.connected) {
            addrList.push(`TON: ${gameState.wallets.ton.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.eth.connected) {
            addrList.push(`ETH: ${gameState.wallets.eth.address.slice(0, 6)}...`);
        }
        if (gameState.wallets.email.connected) {
            addrList.push(`Email: ${gameState.wallets.email.address}`);
        }
        
        addresses.innerHTML = addrList.length > 0 ? addrList.join('<br>') : 'No wallets connected yet';
    }
}

// ===== TASKS SYSTEM =====
const dailyTasks = document.getElementById('dailyTasks');
const specialEvents = document.getElementById('specialEvents');

function loadTasks() {
    // Top 1000 kontrolü
    const top1000Task = gameState.tasks.daily.find(t => t.id === 'top1000');
    if (top1000Task) {
        top1000Task.completed = gameState.isInTop1000;
    }
    
    dailyTasks.innerHTML = '';
    gameState.tasks.daily.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        
        let buttonHtml = '';
        if (task.id === 'top1000') {
            if (gameState.isInTop1000 && !task.completed) {
                buttonHtml = '<button class="claim-btn" data-task="top1000">Claim</button>';
            } else if (task.completed) {
                buttonHtml = '<button class="claim-btn" disabled>Claimed</button>';
            } else {
                buttonHtml = '<button class="claim-btn" disabled>Not in Top 1000</button>';
            }
        } else {
            buttonHtml = `<button class="claim-btn" data-task="${task.id}" ${task.completed ? 'disabled' : ''}>
                ${task.completed ? 'Claimed' : 'Claim'}
            </button>`;
        }
        
        taskItem.innerHTML = `
            <span>${task.name}</span>
            <span class="task-reward">+${task.reward} RXN</span>
            ${buttonHtml}
        `;
        dailyTasks.appendChild(taskItem);
    });
    
    specialEvents.innerHTML = '';
    gameState.tasks.events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        eventItem.innerHTML = `
            <span>${event.name}</span>
            <span class="event-multiplier">${event.description || `${event.multiplier}x Earnings`}</span>
        `;
        specialEvents.appendChild(eventItem);
    });
    
    document.querySelectorAll('.claim-btn[data-task]').forEach(btn => {
        btn.addEventListener('click', claimTask);
    });
}

async function claimTask(event) {
    const btn = event.target;
    const taskId = btn.dataset.task;
    const task = gameState.tasks.daily.find(t => t.id === taskId);
    
    if (!task || task.completed) return;
    
    if (taskId === 'top1000' && !gameState.isInTop1000) {
        tg.showPopup({
            title: 'Not Eligible',
            message: 'You need to be in Top 1000 farmers to claim this reward!',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    if (taskId === 'invite' && gameState.referrals.length === 0) {
        tg.showPopup({
            title: 'Task Not Completed',
            message: 'You need to invite at least 1 friend first!',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    task.completed = true;
    gameState.rxn += task.reward;
    
    updateRXNBalance();
    saveState();
    
    btn.disabled = true;
    btn.textContent = 'Claimed';
    btn.style.background = '#94A3B8';
    
    await apiCall('complete-task', 'POST', {
        userId,
        task: taskId,
        reward: task.reward
    });
    
    tg.showPopup({
        title: 'Task Completed!',
        message: `You earned ${task.reward} RXN!`,
        buttons: [{ type: 'ok' }]
    });
}

// ===== REFERRAL SYSTEM =====
const referralLinkInput = document.getElementById('referralLinkInput');
const totalReferrals = document.getElementById('totalReferrals');
const referralBonus = document.getElementById('referralBonus');
const referralList = document.getElementById('referralList');

const BOT_USERNAME = "Rxn_coin";
const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
referralLinkInput.value = referralLink;

window.copyReferralLink = function() {
    referralLinkInput.select();
    document.execCommand('copy');
    
    tg.showPopup({
        title: 'Copied!',
        message: 'Referral link copied to clipboard!',
        buttons: [{ type: 'ok' }]
    });
};

async function loadReferrals() {
    try {
        const response = await apiCall('referrals', 'GET', null, { userId });
        gameState.referrals = response || [];
        
        totalReferrals.textContent = gameState.referrals.length;
        
        const bonusMultiplier = gameState.boosts[gameState.boostLevel].referral;
        const bonus = gameState.referrals.length * bonusMultiplier;
        referralBonus.textContent = bonus;
        
        // Referral listbox
        if (gameState.referrals.length > 0) {
            let referralsHtml = '<div class="referral-listbox">';
            referralsHtml += '<div class="listbox-header">';
            referralsHtml += '<span>Username</span>';
            referralsHtml += '<span>Joined</span>';
            referralsHtml += '<span>Bonus</span>';
            referralsHtml += '</div>';
            
            gameState.referrals.slice(0, 20).forEach(ref => {
                const joinedDate = new Date(ref.joined_date).toLocaleDateString();
                referralsHtml += `
                    <div class="listbox-item">
                        <span>@${ref.username || 'user'}</span>
                        <span>${joinedDate}</span>
                        <span>+${bonusMultiplier} RXN</span>
                    </div>
                `;
            });
            
            if (gameState.referrals.length > 20) {
                referralsHtml += `<div class="listbox-more">+${gameState.referrals.length - 20} more</div>`;
            }
            
            referralsHtml += '</div>';
            referralList.innerHTML = referralsHtml;
        } else {
            referralList.innerHTML = '<div class="referral-empty">No referrals yet. Invite friends using the link above!</div>';
        }
    } catch (error) {
        console.error('Error loading referrals:', error);
        totalReferrals.textContent = '0';
        referralBonus.textContent = '0';
        referralList.innerHTML = '<div class="referral-empty">Failed to load referrals</div>';
    }
}

// ===== LEADERBOARD with Caching =====
let leaderboardCache = {
    daily: { data: null, timestamp: 0 },
    weekly: { data: null, timestamp: 0 },
    alltime: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const leaderboardList = document.getElementById('leaderboardList');
const userRank = document.getElementById('userRank');
const tabBtns = document.querySelectorAll('.tab-btn');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadLeaderboard(btn.dataset.period, true);
    });
});

async function loadLeaderboard(period = 'daily', forceRefresh = false) {
    // Show loading with skeleton
    leaderboardList.innerHTML = generateSkeletonLoader();
    
    // Check cache
    const cache = leaderboardCache[period];
    if (!forceRefresh && cache.data && (Date.now() - cache.timestamp) < CACHE_DURATION) {
        displayLeaderboard(cache.data, period);
        return;
    }
    
    try {
        const data = await apiCall('leaderboard', 'GET', null, { period, limit: 1000 });
        
        // Update cache
        leaderboardCache[period] = {
            data: data,
            timestamp: Date.now()
        };
        
        displayLeaderboard(data, period);
        
        // Check if user is in top 1000
        const userIndex = data.findIndex(u => u.user_id.toString() === userId);
        gameState.isInTop1000 = userIndex !== -1 && userIndex < 1000;
        gameState.userRank = userIndex !== -1 ? userIndex + 1 : null;
        
        // Update rank display
        if (gameState.userRank) {
            userRank.textContent = `Your Rank: #${gameState.userRank} ${gameState.isInTop1000 ? '🏆' : ''}`;
        } else {
            userRank.textContent = 'Your Rank: Not ranked yet';
        }
        
        // Update tasks if needed
        loadTasks();
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = '<div class="loading">Failed to load leaderboard</div>';
    }
}

function generateSkeletonLoader() {
    let skeleton = '';
    for (let i = 0; i < 10; i++) {
        skeleton += `
            <div class="leaderboard-item skeleton">
                <div class="leaderboard-rank">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-line" style="width: 100px;"></div>
                </div>
                <div class="skeleton-line" style="width: 60px;"></div>
            </div>
        `;
    }
    return skeleton;
}

function displayLeaderboard(data, period) {
    if (data && data.length > 0) {
        leaderboardList.innerHTML = '';
        
        const displayCount = Math.min(data.length, 100);
        
        for (let i = 0; i < displayCount; i++) {
            const user = data[i];
            const isCurrentUser = user.user_id.toString() === userId;
            
            const item = document.createElement('div');
            item.className = `leaderboard-item ${isCurrentUser ? 'current-user' : ''}`;
            
            let rankBadge = '';
            if (i < 3) {
                const medals = ['🥇', '🥈', '🥉'];
                rankBadge = medals[i];
            } else {
                rankBadge = `#${i + 1}`;
            }
            
            item.innerHTML = `
                <div class="leaderboard-rank">
                    <span class="rank-badge">${rankBadge}</span>
                    <span>${user.first_name || user.username || `Farmer ${user.user_id.slice(-4)}`}</span>
                    ${isCurrentUser ? '<span class="you-badge">(You)</span>' : ''}
                </div>
                <span class="leaderboard-score">${user.coins} RXN</span>
            `;
            leaderboardList.appendChild(item);
        }
        
        if (data.length > 100) {
            const more = document.createElement('div');
            more.className = 'leaderboard-more';
            more.textContent = `+${data.length - 100} more farmers`;
            leaderboardList.appendChild(more);
        }
    } else {
        leaderboardList.innerHTML = '<div class="loading">No data yet</div>';
    }
}

// ===== BOOST SYSTEM =====
const boostGrid = document.getElementById('boostGrid');

Object.entries(gameState.boosts).forEach(([id, boost]) => {
    const boostItem = document.createElement('div');
    boostItem.className = `boost-item ${id === gameState.boostLevel ? 'active' : ''}`;
    boostItem.dataset.boost = id;
    boostItem.innerHTML = `
        <span class="boost-name">${boost.name}</span>
        <span class="boost-price">${boost.stars} ⭐</span>
        <span class="boost-multiplier">${boost.multiplier}x</span>
    `;
    boostItem.addEventListener('click', () => purchaseBoost(id));
    boostGrid.appendChild(boostItem);
});

async function purchaseBoost(boostId) {
    const boost = gameState.boosts[boostId];
    
    if (boostId === gameState.boostLevel) {
        tg.showPopup({
            title: 'Already Active',
            message: `You already have ${boost.name} boost active!`,
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    if (gameState.stars < boost.stars) {
        tg.showPopup({
            title: 'Insufficient Stars',
            message: `You need ${boost.stars} ⭐ to purchase ${boost.name} boost.`,
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    tg.showPopup({
        title: 'Purchase Boost',
        message: `Buy ${boost.name} boost for ${boost.stars} ⭐?`,
        buttons: [
            { type: 'default', text: 'Buy' },
            { type: 'cancel' }
        ]
    }, async (buttonId) => {
        if (buttonId === '0') {
            gameState.stars -= boost.stars;
            gameState.boostLevel = boostId;
            gameState.hourlyRate = boost.hourly;
            gameState.dailyMax = boost.daily;
            
            document.querySelectorAll('.boost-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-boost="${boostId}"]`).classList.add('active');
            
            updateFarmStats();
            saveState();
            
            await apiCall('upgrade-boost', 'POST', { userId, boost: boostId });
            
            tg.showPopup({
                title: 'Boost Activated!',
                message: `You are now on ${boost.name} boost!`,
                buttons: [{ type: 'ok' }]
            });
        }
    });
}

// ===== FARM SYSTEM (DÜZELTİLMİŞ) =====
const farmButton = document.getElementById('farmButton');
const farmProgress = document.getElementById('farmProgress');
const nextFarmTimer = document.getElementById('nextFarmTimer');
const hourlyRateDisplay = document.getElementById('hourlyRate');
const dailyMaxDisplay = document.getElementById('dailyMax');

let farmInterval = null;
let farmTimeout = null;
let timerInterval = null;

// Farm butonuna tıklama
farmButton.addEventListener('click', startFarm);

function startFarm() {
    const now = Date.now();
    
    // Cooldown kontrolü
    if (gameState.lastFarm) {
        const timeSinceLastFarm = now - gameState.lastFarm;
        if (timeSinceLastFarm < gameState.farmCooldown) {
            const timeLeft = gameState.farmCooldown - timeSinceLastFarm;
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            
            tg.showPopup({
                title: 'Farm on Cooldown',
                message: `Next farm available in ${hours}h ${minutes}m ${seconds}s`,
                buttons: [{ type: 'ok' }]
            });
            return;
        }
    }
    
    // Farm başlat (demo: 30 saniye)
    const farmDuration = 30 * 1000; // 30 saniye
    const startTime = Date.now();
    
    farmButton.disabled = true;
    farmButton.querySelector('.button-text').textContent = 'FARMING...';
    
    // Progress bar güncelleme
    if (farmInterval) clearInterval(farmInterval);
    farmInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / farmDuration) * 100, 100);
        farmProgress.style.width = `${progress}%`;
        
        if (elapsed >= farmDuration) {
            completeFarm();
        }
    }, 100);
    
    // Farm bitiş zamanlayıcısı
    if (farmTimeout) clearTimeout(farmTimeout);
    farmTimeout = setTimeout(completeFarm, farmDuration);
}

async function completeFarm() {
    // Tüm timerları temizle
    if (farmInterval) {
        clearInterval(farmInterval);
        farmInterval = null;
    }
    if (farmTimeout) {
        clearTimeout(farmTimeout);
        farmTimeout = null;
    }
    
    const earned = Math.floor(gameState.hourlyRate * 4); // 4 saatlik kazanç
    
    gameState.rxn += earned;
    gameState.lastFarm = new Date();
    
    updateRXNBalance();
    saveState();
    
    // API'ye kaydet
    await apiCall('add-coins', 'POST', {
        userId,
        amount: earned,
        type: 'farm'
    });
    
    farmButton.disabled = false;
    farmButton.querySelector('.button-text').textContent = 'START FARM';
    farmProgress.style.width = '0%';
    
    // Timer'ı başlat
    startFarmTimer();
    
    tg.showPopup({
        title: 'Farm Complete! 🎉',
        message: `You earned ${earned} RXN!`,
        buttons: [{ type: 'ok' }]
    });
}

function startFarmTimer() {
    // Eski timer varsa temizle
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (!gameState.lastFarm) {
        nextFarmTimer.textContent = '04:00:00';
        return;
    }
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastFarm = now - gameState.lastFarm;
        const timeLeft = Math.max(0, gameState.farmCooldown - timeSinceLastFarm);
        
        if (timeLeft <= 0) {
            nextFarmTimer.textContent = '00:00:00';
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            return;
        }
        
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
        
        nextFarmTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function updateFarmStats() {
    hourlyRateDisplay.textContent = gameState.hourlyRate;
    dailyMaxDisplay.textContent = gameState.dailyMax;
}

// ===== API FUNCTIONS =====
async function apiCall(endpoint, method = 'GET', body = null, params = null) {
    let url = `/.netlify/functions/api/${endpoint}`;
    
    if (params) {
        const queryParams = new URLSearchParams(params).toString();
        url += `?${queryParams}`;
    }
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error);
        return null;
    }
}

// ===== NAVIGATION =====
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const section = item.dataset.section;
        
        Object.values(sections).forEach(s => {
            if (s) s.classList.add('hidden');
        });
        
        sections[section].classList.remove('hidden');
        
        if (section === 'friends') loadReferrals();
        if (section === 'top') loadLeaderboard();
        if (section === 'earn') loadTasks();
    });
});

// ===== UPDATE FUNCTIONS =====
function updateRXNBalance() {
    rxnBalance.textContent = gameState.rxn;
    
    const container = document.getElementById('rxnBalanceContainer');
    container.style.animation = 'none';
    container.offsetHeight;
    container.style.animation = 'pulse 0.5s ease';
}

// ===== INITIALIZE (DÜZELTİLMİŞ) =====
async function initialize() {
    console.log('Initializing game for user:', userId);
    
    // Önce localStorage'dan state yükle
    loadState();
    
    // Referrer ID'yi al
    let referrerId = null;
    
    // URL'den start parametresini kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    
    if (startParam && startParam.startsWith('ref_')) {
        referrerId = startParam.replace('ref_', '');
        console.log('Found referrer in URL:', referrerId);
        
        // Referrer ID'yi localStorage'a kaydet (sayfa yenilendiğinde kaybolmaması için)
        localStorage.setItem('pending_referrer', referrerId);
    }
    
    // localStorage'dan kontrol et
    if (!referrerId) {
        referrerId = localStorage.getItem('pending_referrer');
        if (referrerId) {
            console.log('Found pending referrer in localStorage:', referrerId);
        }
    }
    
    // Kullanıcıyı kaydet
    let userData;
    if (referrerId && referrerId !== userId) {
        console.log('Creating user with referral:', referrerId);
        userData = await apiCall('user', 'POST', {
            userId,
            username,
            firstName,
            referrerId: referrerId  // String olarak gönder
        });
        
        // Referans başarılıysa localStorage'dan temizle
        if (userData) {
            localStorage.removeItem('pending_referrer');
            
            // Hoşgeldin bonusu göster
            setTimeout(() => {
                tg.showPopup({
                    title: '🎉 Welcome!',
                    message: 'You were invited by a friend! You got 25 RXN bonus!',
                    buttons: [{ type: 'ok' }]
                });
            }, 1000);
        }
    } else {
        console.log('Creating user without referral');
        userData = await apiCall('user', 'POST', {
            userId,
            username,
            firstName,
            referrerId: null
        });
    }
    
    // Kullanıcı verilerini getir
    const userInfo = await apiCall('user', 'GET', null, { userId });
    if (userInfo) {
        gameState.rxn = userInfo.coins || 0;
        gameState.stars = userInfo.stars || 10;
        gameState.boostLevel = userInfo.boost_level || 'free';
        
        updateRXNBalance();
        updateFarmStats();
        updateWalletDisplay();
    }
    
    // Farm timer'ı başlat
    startFarmTimer();
    
    // Diğer verileri yükle
    loadReferrals();
    loadLeaderboard();
    loadTasks();
    
    console.log('RXN Coin initialized successfully for user:', userId);
}

// Start everything
initialize();