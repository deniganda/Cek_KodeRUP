require('dotenv').config();  // Load environment variables

const TelegramBot = require('node-telegram-bot-api');
const { checkKodeRup } = require('./commands/rup');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TARGET_KLPD = process.env.TARGET_KLPD;
const MAX_RETRIES = process.env.MAX_RETRIES || 3;  // Default to 3

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/rup (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchText = match[1].trim();
    const kodeRups = searchText.split(' ').filter(code => code !== '');

    if (kodeRups.length === 0 || !kodeRups.every(code => /^\d{8}$/.test(code))) {
        bot.sendMessage(chatId, 'Kode RUP harus terdiri dari 8 digit angka dan dipisahkan dengan spasi.');
        return;
    }

    try {
        for (const kodeRup of kodeRups) {
            const result = await checkKodeRup(kodeRup);
            bot.sendMessage(chatId, result);
        }
    } catch (error) {
        console.error('Error:', error.message);
        bot.sendMessage(chatId, 'Terjadi kesalahan, silakan coba kembali.');
    }
});
