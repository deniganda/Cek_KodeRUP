const axios = require('axios');
const cheerio = require('cheerio');

const MAX_RETRIES = 3;
const MAX_LENGTH = 2000; // Set the maximum character limit for chat


// Function to check Kode RUP in both Penyedia and Swakelola
async function checkKodeRup(kodeRup, targetKLPD) {
    const types = ['Penyedia', 'Swakelola'];
    let result = null;

    // Convert the user's targetKLPD to lowercase for case-insensitive comparison
    const targetKLPDLowerCase = targetKLPD.toLowerCase();

    for (const type of types) {
        const url = getUrlForType(type, kodeRup);
        console.log(`Visiting URL: ${url}`);

        result = await fetchData(url, type, kodeRup, targetKLPDLowerCase);
        // console.log(`Result for ${type}:`, result);

        if (result && !result.includes('Kode RUP tidak ditemukan')) {
            return result; // Return if a valid result is found
        }
    }

    return `Kode RUP ${kodeRup} tidak ditemukan pada Penyedia dan Swakelola.`;
}

// Function to get the URL based on type
function getUrlForType(type, kodeRup) {
    if (type === 'Penyedia') {
        return `https://sirup.lkpp.go.id/sirup/home/detailPaketPenyediaPublic2017/${kodeRup}`;
    } else if (type === 'Swakelola') {
        return `https://sirup.lkpp.go.id/sirup/home/detailPaketSwakelolaPublic2017?idPaket=${kodeRup}`;
    }
    return '';
}

// Fetch data function with retry mechanism
async function fetchData(url, type, kodeRup, targetKLPDLowerCase, retries = MAX_RETRIES) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html',
                'Referer': 'https://sirup.lkpp.go.id/',
            }
        });

        // console.log(`Fetched data from URL: ${url}`);
        console.log(`Response Status: ${response.status}`);
        // console.log(`Response Data (snippet): ${response.data.substring(0, 500)}`); // Log a snippet of the response data

        const $ = cheerio.load(response.data);
        const data = {};

        // Scraping the "Total Dana" value from the table
        const totalDanaRow = $('tr').filter(function() {
            return $(this).text().includes('Total');
        });
        const totalDana = totalDanaRow.find('span.rupiah').text().trim();
        if (totalDana) {
            data['Total Dana'] = totalDana;
            console.log('Total Dana:', totalDana);
        } else {
            console.log('Total Dana: Data not found');
        }


        if (type === 'Penyedia') {
            // Extract data for 'Penyedia' using table rows
            $('table.table tr').each((index, row) => {
                const columns = $(row).find('td');
                if (columns.length < 2) return;

                const key = $(columns[0]).text().trim();
                const value = $(columns[1]).text().trim();
                if (key && value) {
                    data[key] = value;
                }
            });

            // console.log(`Extracted Data (Penyedia):`, data);

            const scrapedKLPD = data['Nama KLPD'] ? data['Nama KLPD'].toLowerCase() : '';
            console.log(`Scraped Nama KLPD: ${scrapedKLPD}`);
            console.log(`Target KLPD: ${targetKLPDLowerCase}`);

            // Compare 'Nama KLPD' for Penyedia
            if (scrapedKLPD.includes(targetKLPDLowerCase)) {
                return formatResponse(data, type);
            } else {
                return 'Kode RUP tidak ditemukan pada KLPD yang ditetapkan.';
            }
        }

        if (type === 'Swakelola') {
            // Extract data for 'Swakelola' using the dl-horizontal structure
            $('dl.dl-horizontal dt').each((index, element) => {
                let key = $(element).text().trim();
                let value = $(element).next('dd').text().trim();
        
                // Clean the key and value by removing leading or trailing colons and spaces
                key = key.replace(/:$/, '').trim();  // Remove any trailing colon
                value = value.replace(/^: /, '').trim();  // Remove any leading colon and space from value
        
                if (key && value) {
                    data[key] = value;
                }
            });
        
            // console.log(`Extracted Data (Swakelola):`, data);
        
            const scrapedKLDI = data['KLDI'] ? data['KLDI'].toLowerCase() : '';
            console.log(`Scraped KLDI: ${scrapedKLDI}`);
            console.log(`Target KLPD: ${targetKLPDLowerCase}`);
        
            // Compare 'KLDI' for Swakelola
            if (scrapedKLDI.includes(targetKLPDLowerCase)) {
                return formatResponse(data, type);
            } else {
                return 'Kode RUP tidak ditemukan pada KLDI yang ditetapkan.';
            }
        }        

    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error.message);
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchData(url, type, kodeRup, targetKLPDLowerCase, retries - 1);
        }
        return `Kode RUP tidak ditemukan pada ${type}.`;
    }
}

// Function to format Paket Terkonsolidasi with proper numbering and neat output
function formatPaketTerkonsolidasi(text) {
    const paketLines = text.split('\n').filter(line => line.trim() !== '');
    let formattedText = '';
    let currentNumber = 0;

    for (let i = 0; i < paketLines.length; i++) {
        const line = paketLines[i].trim();
        if (/^\d+\./.test(line)) { // Match lines that start with a number followed by a period (e.g., "1.")
            currentNumber++;
            // Combine the next two lines into a single line with the correct format
            const code = paketLines[i + 1].trim().replace(': ', '');  // Clean up the unwanted ": "
            const description = paketLines[i + 2].trim().replace(': ', ''); // Clean up the unwanted ": "
            formattedText += `${currentNumber}. ${code} ${description}\n`;
            i += 2; // Skip the next two lines since they are part of the current item
        }
    }
    return formattedText.trim();
}

// Function to format Sumber Dana data more neatly with currency formatting for the Pagu value
function formatSumberDana(text) {
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
    });

    const sumberDanaLines = text.split('\n').filter(line => line.trim() !== '');
    let formattedText = '';
    let currentNumber = 0;

    for (let i = 0; i < sumberDanaLines.length; i++) {
        const line = sumberDanaLines[i].trim();
        if (/^\d+\./.test(line)) { // Match lines that start with a number followed by a period (e.g., "1.")
            currentNumber++;
            
            const pagu = sumberDanaLines[i + 5].trim(); // Get the Pagu value
            const formattedPagu = formatter.format(parseInt(pagu.replace(/\D/g, ''))); // Format Pagu using the currency formatter

            formattedText += `${currentNumber}. ${sumberDanaLines[i + 1].trim()} (T.A. ${sumberDanaLines[i + 2].trim()}, ${sumberDanaLines[i + 3].trim()}, MAK ${sumberDanaLines[i + 4].trim()}, Pagu: ${formattedPagu})\n`;
            i += 5; // Skip the next lines since they are part of the current item

            // Check if formattedText exceeds the maximum length
            if (formattedText.length > MAX_LENGTH) {
                formattedText = formattedText.substring(0, MAX_LENGTH) + '...'; // Truncate and add ellipsis
                break;
            }
        }
    }

    return formattedText.trim();
}




function formatResponse(data, type) {
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
    });
    

    // Define formatting based on the type
    if (type === 'Penyedia') {
        return `<b><u>${type}</u></b>\n\n`
            + `<b>Kode RUP:</b> \n<blockquote expandable>${data['Kode RUP'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Nama KLPD:</b> \n<blockquote expandable>${data['Nama KLPD'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Satuan Kerja:</b> \n<blockquote expandable>${data['Satuan Kerja'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Nama Paket:</b> \n<blockquote expandable>${data['Nama Paket'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Tahun Anggaran:</b> \n<blockquote expandable>${data['Tahun Anggaran'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Pra DIPA / DPA:</b> \n<blockquote expandable>${data['Pra DIPA / DPA'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Paket Terkonsolidasi:</b> \n<blockquote expandable>${data['Paket Terkonsolidasi'] ? formatPaketTerkonsolidasi(data['Paket Terkonsolidasi']) : 'Bukan Paket Konsolidasi'}</blockquote>\n`
            + `<b>Jenis Pengadaan:</b> \n<blockquote expandable>${data['Jenis Pengadaan'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Metode Pemilihan:</b> \n<blockquote expandable>${data['Metode Pemilihan'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Total Pagu:</b> \n<blockquote expandable>${data['Total Pagu'] ? formatter.format(parseInt(data['Total Pagu'].replace(/\D/g, ''))) : 'Tidak tersedia'}</blockquote>\n`
            + `<b>Sumber Dana:</b> \n<blockquote expandable>${formatSumberDana(data['Sumber Dana'])}</blockquote>\n`
            + `<b>History Paket:</b> \n<blockquote expandable>${data['History Paket'] || 'Tidak tersedia'}</blockquote>\n`;
    } else if (type === 'Swakelola') {
        return `<b><u>${type}</u></b>\n\n`
            + `<b>Kode RUP:</b> \n<blockquote expandable>${data['Kode RUP'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>KLDI:</b> \n<blockquote expandable>${data['KLDI'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Satuan Kerja:</b> \n<blockquote expandable>${data['Satuan Kerja'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Nama Paket:</b> \n<blockquote expandable>${data['Nama Paket'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Tahun Anggaran:</b> \n<blockquote expandable>${data['Tahun Anggaran'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Tipe Swakelola:</b> \n<blockquote expandable>${data['Tipe Swakelola'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Penyelenggara Swakelola:</b> \n<blockquote expandable>${data['Penyelenggara Swakelola'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Lokasi:</b> \n<blockquote expandable>${data['Lokasi'] || 'Tidak tersedia'}</blockquote>\n`
            + `<b>Total Pagu:</b> \n<blockquote expandable>${data['Total Dana'] ? formatter.format(parseInt(data['Total Dana'].replace(/\D/g, ''))) : 'Tidak tersedia'}</blockquote>\n`;
    }
    
    return 'Data tidak tersedia.';
}




module.exports = { checkKodeRup };
