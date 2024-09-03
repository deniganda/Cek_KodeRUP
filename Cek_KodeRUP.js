const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Replace with your actual token
const TARGET_KLPD = process.env.TARGET_KLPD; // Constant for the target KLPD
const MAX_RETRIES = 3; // Number of retries for failed requests

// Initialize the Telegram bot with the correct token
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Function to check Kode RUP in both Penyedia and Swakelola
async function checkKodeRup(kodeRup) {
    const types = ['Penyedia', 'Swakelola'];
    let result = null;

    for (const type of types) {
        const url = `https://sirup.lkpp.go.id/sirup/home/detailPaket${type}Public2017/${kodeRup}`;
        console.log(`Visiting URL: ${url}`);

        result = await fetchData(url, type, kodeRup);
        if (result && (!TARGET_KLPD || !result.includes('Kode RUP tidak ditemukan'))) {
            return result; // Return if valid result is found
        }
    }
    
    return 'Kode RUP tidak ditemukan pada Penyedia dan Swakelola.';
}

// Fetch data function with retry mechanism
async function fetchData(url, type, kodeRup, retries = MAX_RETRIES) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://sirup.lkpp.go.id/',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const $ = cheerio.load(response.data);
        const data = {};

        $('table.table tr').each((index, row) => {
            const columns = $(row).find('td');
            if (columns.length < 2) return;

            const key = $(columns[0]).text().trim();
            const value = $(columns[1]).text().trim();
            if (key && value) {
                data[key] = value;
            }
        });

        // Special handling for 'Penyedia' to include specific fields
        if (type === 'Penyedia' && TARGET_KLPD) {
            if (data['Nama KLPD'] !== TARGET_KLPD) {
                return `Kode RUP tidak ditemukan di ${type}.`;
            }
            // Scrape specific fields if found in Penyedia
            const specificFields = ['Jenis Pengadaan', 'Metode Pemilihan'];
            specificFields.forEach(field => {
                if (!data[field]) {
                    data[field] = 'Tidak tersedia';
                }
            });
        } else if (type === 'Swakelola' && TARGET_KLPD) {
            if (data['Nama KLPD'] !== TARGET_KLPD) {
                return `Kode RUP tidak ditemukan di ${type}.`;
            }
        }

        return formatResponse(data, type);
    } catch (error) {
        console.error('Fetch error:', error.message);
        if (retries > 0 && (error.response?.status !== 500)) {
            console.log(`Retrying... ${retries} attempts left.`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
            return fetchData(url, type, kodeRup, retries - 1);
        }
        // If error is not retriable or retries exhausted, return error message
        return `Kode RUP tidak ditemukan pada ${type}.`;
    }
}

// Function to format the response
function formatResponse(data, type) {
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
    });

    return `[${type}]\n\n`
        + `[Kode RUP]\n${data['Kode RUP'] || 'Tidak tersedia'}\n=================\n`
        + `[Satuan Kerja]\n${data['Satuan Kerja'] || 'Tidak tersedia'}\n=================\n`
        + `[Nama KLPD]\n${data['Nama KLPD'] || 'Tidak tersedia'}\n=================\n`
        + `[Nama Paket]\n${data['Nama Paket'] || 'Tidak tersedia'}\n=================\n`
        + `[Tahun Anggaran]\n${data['Tahun Anggaran'] || 'Tidak tersedia'}\n=================\n`
        + `[Jenis Pengadaan]\n${data['Jenis Pengadaan'] || 'Tidak tersedia'}\n=================\n`
        + `[Metode Pemilihan]\n${data['Metode Pemilihan'] || 'Tidak tersedia'}\n=================\n`
        + `[Total Pagu]\n${data['Total Pagu'] ? formatter.format(parseInt(data['Total Pagu'].replace(/\D/g, ''))) : 'Tidak tersedia'}\n`;
}

// Command handler for /rup
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
