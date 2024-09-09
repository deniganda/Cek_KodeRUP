const axios = require('axios');
const cheerio = require('cheerio');

const TARGET_KLPD = process.env.TARGET_KLPD;
const MAX_RETRIES = 3;

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
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html',
                'Referer': 'https://sirup.lkpp.go.id/',
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

        // Additional logic here for Penyedia and Swakelola
        return formatResponse(data, type);
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchData(url, type, kodeRup, retries - 1);
        }
        return `Kode RUP tidak ditemukan pada ${type}.`;
    }
}

// Function to format the response
function formatResponse(data, type) {
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
    });

    return `[${type}]\n`
        + `[Kode RUP]\n${data['Kode RUP'] || 'Tidak tersedia'}\n`
        + `[Satuan Kerja]\n${data['Satuan Kerja'] || 'Tidak tersedia'}\n`
        + `[Nama KLPD]\n${data['Nama KLPD'] || 'Tidak tersedia'}\n`
        + `[Nama Paket]\n${data['Nama Paket'] || 'Tidak tersedia'}\n`
        + `[Tahun Anggaran]\n${data['Tahun Anggaran'] || 'Tidak tersedia'}\n`
        + `[Total Pagu]\n${data['Total Pagu'] ? formatter.format(parseInt(data['Total Pagu'].replace(/\D/g, ''))) : 'Tidak tersedia'}\n`;
}

module.exports = { checkKodeRup };
