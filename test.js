const axios = require('axios');
const cheerio = require('cheerio');

// URL to scrape
const url = 'https://sirup.lkpp.go.id/sirup/home/detailPaketSwakelolaPublic2017?idPaket=37150386';

async function scrapeData() {
    try {
        // Set headers to mimic a browser request
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36',
                'Accept': 'text/html',
                'Referer': 'https://sirup.lkpp.go.id/'
            }
        });

        // Load the HTML content into cheerio
        const $ = cheerio.load(response.data);

        // Example: Scrape the package name
        const packageName = $('h3').text().trim(); // You can refine this if needed
        console.log('Package Name:', packageName);

        // Scraping the "Total Dana" value from the table
        const totalDanaRow = $('tr').filter(function() {
            return $(this).text().includes('Total');
        });

        // Now find the <span> element containing the 'rupiah' class in this row
        const totalDana = totalDanaRow.find('span.rupiah').text().trim();

        if (totalDana) {
            console.log('Total Dana:', totalDana);
        } else {
            console.log('Total Dana: Data not found');
        }

    } catch (error) {
        console.error('Error scraping data:', error);
    }
}

// Run the scrape function
scrapeData();
