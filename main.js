require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { checkKodeRup } = require('./commands/rup');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Path to the user settings file
const USER_SETTINGS_FILE = './userSettings.json';

// Load user settings from the JSON file
let userSettings = {};
if (fs.existsSync(USER_SETTINGS_FILE)) {
    userSettings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf-8'));
}

// Save user settings to the JSON file
const saveUserSettings = () => {
    fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(userSettings, null, 2), 'utf-8');
};

// Temporary storage to track which user is in the process of setting KLPD
const awaitingKLPDInput = {};

// Command to start the process of setting TARGET_KLPD
bot.onText(/\/set_klpd/, (msg) => {
    const chatId = msg.chat.id;

    // Notify the user and prompt them to input their KLPD
    bot.sendMessage(chatId, 'Silakan masukkan nama KLPD yang ingin Anda gunakan untuk pencarian Kode RUP, sesuai dengan nama yang tercantum di SiRUP (contoh: Kab. Lampung Barat).');
    
    // Mark the user as awaiting KLPD input
    awaitingKLPDInput[chatId] = true;
});

// Listen for messages that may contain the KLPD after prompting
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Check if the user is awaiting KLPD input
    if (awaitingKLPDInput[chatId]) {
        // Store the TARGET_KLPD for this user
        userSettings[chatId] = { TARGET_KLPD: text };
        saveUserSettings();  // Save the settings to the file

        // Confirm that the KLPD has been set
        bot.sendMessage(chatId, `Nama KLPD telah disimpan: ${text}. Nama KLPD ini yang akan dijadikan patokan dalam pencarian Kode RUP selanjutnya.`);
        
        // Reset the awaiting status for this user
        delete awaitingKLPDInput[chatId];
    }
});


// Command to check RUP codes
bot.onText(/\/rup (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchText = match[1].trim();
    const kodeRups = searchText.split(' ').filter(code => code !== '');

    if (kodeRups.length === 0 || !kodeRups.every(code => /^\d{8}$/.test(code))) {
        bot.sendMessage(chatId, 'Kode RUP harus terdiri dari 8 digit angka dan dipisahkan dengan spasi.');
        return;
    }

    // Check if the user has set TARGET_KLPD
    const userTargetKLPD = userSettings[chatId]?.TARGET_KLPD;
    if (!userTargetKLPD) {
        bot.sendMessage(chatId, 'Anda belum menetapkan TARGET_KLPD. Silakan tetapkan dengan menggunakan perintah /set_klpd.');
        return;
    }

    try {
        for (const kodeRup of kodeRups) {
            const result = await checkKodeRup(kodeRup, userTargetKLPD);
            await bot.sendMessage(chatId, result);
            await new Promise(resolve => setTimeout(resolve, 1000));  // 1-second delay between messages
        }
    } catch (error) {
        console.error('Error:', error.message);
        bot.sendMessage(chatId, 'Terjadi kesalahan, silakan coba kembali.');
    }
});
