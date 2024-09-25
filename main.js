require('dotenv').config({ path: './config.env' });  // Load environment variables from config.env
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { checkKodeRup } = require('./commands/rup');
const Tesseract = require('tesseract.js');

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

    const currentKLPD = userSettings[chatId]?.TARGET_KLPD;
    let message = '';

    if (currentKLPD) {
        message += `<b>KLPD yang saat ini tersimpan untuk Pencarian Kode RUP:</b>\n` +
            `<blockquote>${currentKLPD}</blockquote>\n\n`;
    }

    message += 'Silakan masukkan nama KLPD yang ingin Anda gunakan untuk pencarian Kode RUP selanjutnya, pastikan nama KLPD yang anda masukan sesuai dengan nama yang tercantum di SiRUP.\n' +
        '<b>Contoh:</b>\n' +
        '<blockquote>Kab. Lampung Barat</blockquote>\n' +
        '<blockquote>Kab. Aceh Barat</blockquote>\n' +
        '<blockquote>Kab. Belitung Timur</blockquote>\n' +
        '<blockquote>Kota Ambon</blockquote>\n' +
        '<blockquote>Provinsi Jambi</blockquote>\n' +
        '<blockquote>Provinsi DKI Jakarta</blockquote>\n' +
        '<blockquote>Badan Pusat Statistik</blockquote>\n' +
        '<blockquote>Arsip Nasional Republik Indonesia</blockquote>';

    // Send the message to the user
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    // Mark the user as awaiting KLPD input
    awaitingKLPDInput[chatId] = true;
});

// Listen for messages that may contain the KLPD after prompting
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    console.log(`Received message from ${chatId}: ${text}`);

    if (text && text.startsWith('/') && awaitingKLPDInput[chatId]) {
        bot.sendMessage(chatId, 'Proses pengaturan KLPD dibatalkan.');
        delete awaitingKLPDInput[chatId];
        return;
    }

    if (awaitingKLPDInput[chatId]) {
        console.log(`Storing KLPD for ${chatId}: ${text}`);
        userSettings[chatId] = { TARGET_KLPD: text };
        saveUserSettings();

        bot.sendMessage(chatId, `<b>Nama KLPD telah disimpan:</b> <blockquote>${text}</blockquote>\nNama KLPD ini yang akan dijadikan patokan dalam pencarian Kode RUP selanjutnya.`, { parse_mode: 'HTML' });
        delete awaitingKLPDInput[chatId];
    }

    // Handle image replies with /rup
if (msg.reply_to_message && msg.reply_to_message.photo && text === '/rup') {
    const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;

    // Download the image
    const file = await bot.getFile(fileId);
    const filePath = `./${file.file_path.split('/').pop()}`;
    await bot.downloadFile(fileId, './');

    // Perform OCR
    Tesseract.recognize(
        filePath,
        'eng', // Specify the language, you can change this as needed
        {
            logger: info => console.log(info) // Log progress
        }
    ).then(async ({ data: { text } }) => {
        // Extract 8-digit numbers from the OCR result
        let kodeRups = text.match(/\b\d{8}\b/g);
        
        if (kodeRups) {
            const extractedLog = `${kodeRups.length} <b>Kode RUP</b> ditemukan\n<blockquote>${kodeRups.join(', ')}</blockquote>`;
            await bot.sendMessage(chatId, extractedLog, { parse_mode: 'HTML' }); // Send the log to Telegram
            
            // Process the extracted codes in the same order as found
            for (const kodeRup of kodeRups) {
                console.log(`Processing Kode RUP: ${kodeRup}`);
                
                const userTargetKLPD = userSettings[chatId]?.TARGET_KLPD;
                console.log(`Visiting URL: https://sirup.lkpp.go.id/sirup/home/detailPaketPenyediaPublic2017/${kodeRup}`);
                
                const result = await checkKodeRup(kodeRup, userTargetKLPD);
                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            }
        } else {
            bot.sendMessage(chatId, 'Tidak ada kode RUP yang ditemukan dalam gambar.');
        }

        // Clean up the downloaded image file
        fs.unlinkSync(filePath);
    }).catch(err => {
        console.error('OCR Error:', err.message);
        bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses gambar.');
    });
} else if (text === '/rup') {
    // If the message is just '/rup' and not a reply to an image, send the instructions
    bot.sendMessage(chatId, 
        'Silakan masukkan kode RUP setelah perintah ini, pastikan setiap kode terdiri dari 8 digit angka dan dipisahkan dengan spasi.\n' +
        '<b>Contoh:</b>\n' + 
        '<blockquote>/rup 12341234.</blockquote>\n' +
        '<blockquote>/rup 12341234 56785678.</blockquote>\n' +
        '<blockquote>/rup 12341234 56785678 11112233.</blockquote>\n',
        { parse_mode: 'HTML' }
    );
}
});

// Command to test if the bot is working
bot.onText(/\/ping/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Bot berjalan dengan baik.");
});

// Command to check RUP codes
bot.onText(/\/rup(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchText = match[1] ? match[1].trim() : '';
    const kodeRups = searchText.split(' ').filter(code => code !== '');
    if (!kodeRups.every(code => /^\d{8}$/.test(code))) {
        bot.sendMessage(chatId, 'Kode RUP harus terdiri dari 8 digit angka dan dipisahkan dengan spasi.');
        return;
    }

    const userTargetKLPD = userSettings[chatId]?.TARGET_KLPD;
    if (!userTargetKLPD) {
        bot.sendMessage(chatId, 'Anda belum menetapkan TARGET_KLPD. Silakan tetapkan dengan menggunakan perintah /set_klpd.');
        return;
    }

    try {
        for (const kodeRup of kodeRups) {
            const result = await checkKodeRup(kodeRup, userTargetKLPD);
            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            await new Promise(resolve => setTimeout(resolve, 100));  // 0.1-second delay between messages
        }
    } catch (error) {
        console.error('Error:', error.message);
        bot.sendMessage(chatId, 'Terjadi kesalahan, silakan coba kembali.');
    }
});
