require('dotenv').config({ path: './config.env' });  // Load environment variables from config.env
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const TelegramBot = require('node-telegram-bot-api');
const { checkKodeRup } = require('./commands/rup');
const { checkDataRup } = require('./commands/database');
const { processImage } = require('./commands/sptpp');
const { processPokja } = require('./commands/sptpokja');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

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

    // Send the image with a caption using HTML parse mode
    bot.sendPhoto(chatId, './image/sirup.png', {
        caption: 'Berikut adalah contoh Nama KLPD yang ada pada <b>SiRUP</b>. Pastikan penulisan Nama KLPD sesuai baik itu dalam penggunaan spasi dan tanda titik. ',
        parse_mode: 'HTML'
    });

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
    const filePath = path.join('./', file.file_path.split('/').pop());
    await bot.downloadFile(fileId, './');

} else if (text === '/rup') {
    // Send instructions
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

const userState = {}; // Track users' responses

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (text === '/sptpp' && msg.reply_to_message?.photo) {
        const fileId = msg.reply_to_message.photo.pop().file_id;
        const file = await bot.getFile(fileId);
        const filePath = `./${file.file_path.split('/').pop()}`;
        await bot.downloadFile(fileId, './');
        userState[chatId] = { filePath, step: 1, type: 'sptpp' };


        bot.sendMessage(chatId, "📧 Masukkan email penerima:\n\nContoh: \n<blockquote>deniganda@yahoo.com</blockquote> ", { parse_mode: "HTML"});
    } else if (text === '/sptpokja' && msg.reply_to_message?.photo) {
        const fileId = msg.reply_to_message.photo.pop().file_id;
        const file = await bot.getFile(fileId);
        const filePath = `./${file.file_path.split('/').pop()}`;
        await bot.downloadFile(fileId, './');
        userState[chatId] = { filePath, step: 1, type: 'sptpokja' };

        bot.sendMessage(chatId, "🛠 Jumlah Pokja:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "3", callback_data: "pokja_3" }],
                    [{ text: "5", callback_data: "pokja_5" }],
                    [{ text: "7", callback_data: "pokja_7" }]
                ]
            }
        });
    } else if (userState[chatId]) {
        handleUserResponse(chatId, text);
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('pokja_')) {
        const jumlahPokja = parseInt(data.split('_')[1]);

        if (!userState[chatId]) return; // 🔥 Ensure state exists

        // ✅ Preserve filePath
        userState[chatId].step = 2;
        userState[chatId].jumlahPokja = jumlahPokja;
        userState[chatId].pokjaNames = [];
        userState[chatId].type = 'sptpokja';

        bot.sendMessage(chatId, `📝 Masukkan nama Pokja 1:`);
    }
});

async function handleUserResponse(chatId, text) {
    const user = userState[chatId];

    if (user.type === 'sptpokja') {
        if (user.step === 2) {
            user.pokjaNames.push(text);
            if (user.pokjaNames.length < user.jumlahPokja) {
                bot.sendMessage(chatId, `📝 Masukkan nama Pokja ${user.pokjaNames.length + 1}:`);
            } else {
                user.step++;
                bot.sendMessage(chatId, "📧 Masukkan email penerima:\n\nContoh: \n<blockquote>deniganda@yahoo.com</blockquote> ", { parse_mode: "HTML"});
            }
        } else if (user.step === 3) {
            user.emailPenerima = text;
            bot.sendMessage(chatId, "🔄 Memproses data, harap tunggu...", { parse_mode: "HTML" });

            if (!user.filePath) {
                bot.sendMessage(chatId, "⚠️ Terjadi kesalahan: file gambar tidak ditemukan.");
                return;
            }

            const result = await processPokja(user.filePath, user.emailPenerima, user.pokjaNames);
            bot.sendMessage(chatId, `${result}`, { parse_mode: "HTML" });

            if (fs.existsSync(user.filePath)) fs.unlinkSync(user.filePath);
            delete userState[chatId];
        }
    } else if (user.type === 'sptpp') {
        switch (user.step) {
            case 1:
                user.emailPenerima = text;
                user.step++;
                bot.sendMessage(chatId, "👤 Masukkan nama pejabat pengadaan:\n\nContoh: \n<blockquote>Deni</blockquote> ", { parse_mode: "HTML"});
                break;
            case 2:
                user.pejabatPengadaan = text;
                user.step++;

                bot.sendMessage(chatId, "🔄 Memproses gambar, harap tunggu... ", { parse_mode: "HTML"});
                if (!user.filePath) {
                    bot.sendMessage(chatId, "⚠️ Terjadi kesalahan: file gambar tidak ditemukan.");
                    return;
                }

                const result = await processImage(user.filePath, user.emailPenerima, user.pejabatPengadaan);
                bot.sendMessage(chatId, `${result}\n\nCek kembali data2 pada link <b>Google Form</b> di atas.`, { parse_mode: 'HTML' });

                if (fs.existsSync(user.filePath)) fs.unlinkSync(user.filePath);
                delete userState[chatId];
                break;
        }
    }
}

// Command to test if the bot is working
bot.onText(/\/ping/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Bot berjalan dengan baik.");
});

// Function: Extract text from image using Gemini
async function extractTextFromImage(filePath) {
    const imageBuffer = fs.readFileSync(filePath);
    const imageBase64 = imageBuffer.toString('base64');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        { text: "Ekstrak teks dari gambar ini dalam Bahasa Indonesia. Jangan beri tambahan teks lain, hanya ekstrak teksnya saja." }
    ]);

    const response = await result.response;
    return response.text();
}

// /rup handler
bot.onText(/\/rup(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchText = match[1] ? match[1].trim() : '';

    // If it's a reply to a photo
    if (msg.reply_to_message?.photo && !searchText) {
        const fileId = msg.reply_to_message.photo.slice(-1)[0].file_id;
        const file = await bot.getFile(fileId);
        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const filePath = path.join(tempDir, file.file_path.split('/').pop());
        await bot.downloadFile(fileId, tempDir);

        try {
            const extractedText = await extractTextFromImage(filePath);

            if (!extractedText || extractedText.trim().length === 0) {
                await bot.sendMessage(chatId, "⚠️ Tidak ada teks yang ditemukan dalam gambar.");
                return;
            }

            const kodeRups = [...new Set((extractedText.match(/\b\d{8}\b/g) || []))];

            if (!kodeRups.length) {
                await bot.sendMessage(chatId, 'Tidak ada kode RUP yang ditemukan dalam teks hasil OCR.');
                return;
            }

            const log = `${kodeRups.length} <b>Kode RUP</b> ditemukan\n<blockquote>${kodeRups.join(', ')}</blockquote>`;
            await bot.sendMessage(chatId, log, { parse_mode: 'HTML' });

            const userTargetKLPD = userSettings[chatId]?.TARGET_KLPD;
            if (!userTargetKLPD) {
                await bot.sendMessage(chatId, 'Anda belum menetapkan TARGET_KLPD. Silakan tetapkan dengan perintah /set_klpd.');
                return;
            }

            for (const kodeRup of kodeRups) {
                const result = await checkKodeRup(kodeRup, userTargetKLPD);
                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (err) {
            console.error("Gemini OCR Error:", err.message);
            await bot.sendMessage(chatId, "❌ Gagal memproses gambar dengan Gemini.");
        } finally {
            fs.unlink(filePath, () => {});
        }

    // If it's regular /rup with text input
    } else if (searchText) {
        const kodeRups = searchText.split(' ').filter(code => code !== '');

        if (!kodeRups.every(code => /^\d{8}$/.test(code))) {
            await bot.sendMessage(chatId,
                'Terdapat satu atau lebih Kode RUP yang tidak terdiri dari 8 digit angka, pastikan setiap kode terdiri dari 8 digit angka dan dipisahkan dengan spasi.\n' +
                '<b>Contoh:</b>\n' +
                '<blockquote>/rup 12341234</blockquote>\n' +
                '<blockquote>/rup 12341234 56785678</blockquote>\n' +
                '<blockquote>/rup 12341234 56785678 11112233</blockquote>',
                { parse_mode: 'HTML' }
            );
            return;
        }

        const userTargetKLPD = userSettings[chatId]?.TARGET_KLPD;
        if (!userTargetKLPD) {
            await bot.sendMessage(chatId, 'Anda belum menetapkan TARGET_KLPD. Silakan tetapkan dengan perintah /set_klpd.');
            return;
        }

        try {
            for (const kodeRup of kodeRups) {
                const result = await checkKodeRup(kodeRup, userTargetKLPD);
                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error('Error:', error.message);
            await bot.sendMessage(chatId, 'Terjadi kesalahan, silakan coba kembali.');
        }

    // If just /rup with no text or image
    } else {
        await bot.sendMessage(chatId,
            'Silakan masukkan kode RUP setelah perintah ini, atau balas gambar yang berisi kode RUP dengan perintah /rup.\n' +
            '<b>Contoh:</b>\n' +
            '<blockquote>/rup 12341234</blockquote>\n' +
            '<blockquote>/rup 12341234 56785678</blockquote>\n' +
            '<blockquote>/rup 12341234 56785678 11112233</blockquote>',
            { parse_mode: 'HTML' }
        );
    }
});

// /cekdata command with Gemini image OCR support
bot.onText(/\/cekdata(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const textInput = match[1]?.trim();
    let kodeRups = [];
  
    if (textInput) {
      kodeRups = textInput.split(/\s+/);
      const invalid = kodeRups.some(code => !/^\d{8}$/.test(code));
  
      if (invalid) {
        return bot.sendMessage(chatId,
          'Terdapat satu atau lebih Kode RUP yang tidak terdiri dari 8 digit angka, pastikan setiap kode terdiri dari 8 digit angka dan dipisahkan dengan spasi.\n' +
          '<b>Contoh:</b>\n' + 
          '<blockquote>/cekdata 12341234.</blockquote>\n' +
          '<blockquote>/cekdata 12341234 56785678.</blockquote>\n' +
          '<blockquote>/cekdata 12341234 56785678 11112233.</blockquote>\n',
          { parse_mode: 'HTML' }
        );
      }
    } else if (msg.reply_to_message?.photo) {
      const fileId = msg.reply_to_message.photo.slice(-1)[0].file_id;
      const file = await bot.getFile(fileId);
      const filePath = `./${file.file_path.split('/').pop()}`;
      await bot.downloadFile(fileId, './');
  
      try {
        const extractedText = await extractTextFromImage(filePath);
        kodeRups = extractedText.match(/\b\d{8}\b/g) || [];
  
        if (kodeRups.length > 0) {
          const log = `${kodeRups.length} <b>Kode RUP</b> ditemukan\n<blockquote>${kodeRups.join(', ')}</blockquote>`;
          await bot.sendMessage(chatId, log, { parse_mode: 'HTML' });
        } else {
          return bot.sendMessage(chatId, 'Tidak ada kode RUP yang ditemukan dalam gambar.', { parse_mode: 'HTML' });
        }
      } catch (err) {
        console.error('OCR Error:', err.message);
        return bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses gambar.', { parse_mode: 'HTML' });
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
  
    if (kodeRups.length === 0) {
      return bot.sendMessage(chatId,
        'Silakan masukkan kode RUP setelah perintah ini atau balas gambar dengan perintah ini.\n' +
        '<b>Contoh:</b>\n' + 
        '<blockquote>/cekdata 12341234.</blockquote>\n' +
        '<blockquote>/cekdata 12341234 56785678.</blockquote>\n' +
        '<blockquote>/cekdata 12341234 56785678 11112233.</blockquote>\n',
        { parse_mode: 'HTML' }
      );
    }
  
    // Process valid Kode RUPs
    try {
      for (const kodeRup of kodeRups) {
        console.log(`Processing Kode RUP: ${kodeRup}`);
        const result = await checkDataRup(kodeRup);
        await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error:', error.message);
      bot.sendMessage(chatId, 'Terjadi kesalahan, silakan coba kembali.', { parse_mode: 'HTML' });
    }
  });
  