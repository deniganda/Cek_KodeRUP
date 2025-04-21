require('dotenv').config({ path: './config.env' });  // Load environment variables from config.env
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fuzz = require("fuzzball");

const API_KEY = process.env.API_KEY; // Replace with your actual API key

const predefinedInstansi = process.env.PREDEFINED_INSTANSI.split(";");
const pokjaList = process.env.PEJABAT_LIST.split(";");

async function processPokja(imagePath, emailPenerima, pokjaNames) {
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString("base64");

        const result = await model.generateContent([
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: "Ekstrak teks dari gambar ini dalam Bahasa Indonesia. Jangan beri tambahan teks lain, hanya ekstrak teksnya saja." }
        ]);

        const response = await result.response;
        const extractedText = response.text().trim();

        if (!extractedText) {
            return "⚠️ Tidak ada teks yang ditemukan dalam gambar.";
        }

        const questions = {
            instansi: "Sebutkan instansi pengirim surat?",
            nomorSurat: "Sebutkan nomor surat?",
            perihal: "Sebutkan perihal surat?",
            tanggalSurat: "Sebutkan tanggal surat dengan format YYYY-MM-DD?",
            kodeRup: "Sebutkan semua kode RUP yang ada?"
        };

        let answers = {};

        for (const [key, question] of Object.entries(questions)) {
            const questionResult = await model.generateContent([
                { text: `Jawab dengan singkat berdasarkan teks ini:\n\n"${extractedText}"\n\n${question}` }
            ]);

            const questionResponse = await questionResult.response;
            answers[key] = questionResponse.text().trim();
        }

        // Match instansi
        let bestInstansiMatch = fuzz.extract(
            answers.instansi.toLowerCase(),
            predefinedInstansi.map(i => i.toLowerCase()),
            { scorer: fuzz.partial_ratio, limit: 1 }
        );
        
        if (bestInstansiMatch.length > 0 && bestInstansiMatch[0][1] >= 70) {
            let originalMatch = predefinedInstansi.find(i => i.toLowerCase() === bestInstansiMatch[0][0]);
            answers.instansi = originalMatch || bestInstansiMatch[0][0];
        } else {
            return "⚠️ Instansi tidak ditemukan dalam daftar.";
        }

        answers.emailpenerima = emailPenerima;

        // Match Pokja names
        let matchedPokjas = pokjaNames.map(pokjaInput => {
            let bestMatch = fuzz.extract(
                pokjaInput.toLowerCase(),
                pokjaList.map(p => p.toLowerCase()),
                { scorer: fuzz.partial_ratio, limit: 1 }
            );

            if (bestMatch.length > 0 && bestMatch[0][1] >= 30) {
                let originalMatch = pokjaList.find(p => p.toLowerCase() === bestMatch[0][0]);
                return originalMatch || bestMatch[0][0];
            } else {
                return "⚠️ Pokja Pemilihan tidak ditemukan dalam daftar.";
            }
        });

        const pokjaFields = [
            "1189723868", "1249560783", "1026234403", 
            "1040631271", "1536654219", "868073288", "1731731973"
        ];

        let googleFormURL = `https://docs.google.com/forms/d/e/1FAIpQLSck2K4R5b443zY5TETTwHbVURQyUs3UUk3BRgcdsH7Uqx7Quw/viewform?usp=pp_url`
            + `&entry.1129931024=${matchedPokjas.length}`
            + `&entry.51947438=${encodeURIComponent(answers.instansi).replace(/%20/g, "+")}`
            + `&entry.1344618841=${encodeURIComponent(answers.nomorSurat.replace(/\s+|\.{2,}/g, ""))}`
            + `&entry.1712954723=${encodeURIComponent(answers.tanggalSurat)}`
            + `&entry.1992581915=${encodeURIComponent(answers.perihal.replace(/\.+/g, ""))}`
            + `&entry.1758763754=${encodeURIComponent(answers.kodeRup)}`;

        matchedPokjas.forEach((pokja, index) => {
            if (index < pokjaFields.length) {
                googleFormURL += `&entry.${pokjaFields[index]}=${encodeURIComponent(pokja.trim())}`;
            }
        });

        googleFormURL += `&entry.1732353446=${encodeURIComponent(answers.emailpenerima)}`;

        return `📜 <b>Data yang Diekstrak:</b>\n`
        + `<blockquote>📌 Instansi: ${answers.instansi}\n`
        + `📌 Nomor Surat: ${answers.nomorSurat}\n`
        + `📌 Perihal: ${answers.perihal}\n`
        + `📌 Tanggal Surat: ${answers.tanggalSurat}\n`
        + `📌 Email Penerima: ${answers.emailpenerima}\n`
        + `📌 Pokja Pemilihan: ${matchedPokjas.join(", ") || "Tidak ada"}\n`
        + `📌 Kode RUP: ${answers.kodeRup}</blockquote>\n\n`
        + `🔗 <b>Tautan Google Form:</b>\n<blockquote expandable>${googleFormURL}</blockquote>`
        +'\n\nCek kembali data-data pada link <b>Google Form</b> di atas.';

    } catch (error) {
        console.error("❌ Error:", error.message);
        return "❌ Terjadi kesalahan saat memproses gambar.";
    }
}

module.exports = { processPokja };
