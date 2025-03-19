require('dotenv').config({ path: './config.env' });  // Load environment variables from config.env
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fuzz = require("fuzzball");

const API_KEY = process.env.API_KEY; // Replace with your actual API key

const predefinedInstansi = process.env.PREDEFINED_INSTANSI.split(";");
const pejabatList = process.env.PEJABAT_LIST.split(";");

async function processImage(imagePath, tanggalSurat, emailPenerima, pejabatPengadaan) {
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

        // console.log("📄 Teks yang Diekstrak:\n", extractedText);

        if (!extractedText) {
            return "⚠️ Tidak ada teks yang ditemukan dalam gambar.";
        }

        const questions = {
            instansi: "Sebutkan instansi pengirim surat?",
            nomorSurat: "Sebutkan nomor surat?",
            perihal: "Sebutkan perihal surat?",
            kodeRup: "Sebutkan semua kode RUP yang ada, pisahkan dengan koma jika lebih dari satu?"
        };

        let answers = {};

        for (const [key, question] of Object.entries(questions)) {
            const questionResult = await model.generateContent([
                { text: `Jawab dengan singkat berdasarkan teks ini:\n\n"${extractedText}"\n\n${question}` }
            ]);

            const questionResponse = await questionResult.response;
            answers[key] = questionResponse.text().trim();
        }

        let bestInstansiMatch = fuzz.extract(
            answers.instansi.toLowerCase(),
            predefinedInstansi.map(i => i.toLowerCase()),
            { scorer: fuzz.partial_ratio, limit: 1 }
        );
        
        if (bestInstansiMatch.length > 0 && bestInstansiMatch[0][1] >= 70) {  // Increase threshold
            let originalMatch = predefinedInstansi.find(i => i.toLowerCase() === bestInstansiMatch[0][0]);
            answers.instansi = originalMatch || bestInstansiMatch[0][0];
        } else {
            return "⚠️ Instansi tidak ditemukan dalam daftar.";
        }
        
        // Match pejabatPengadaan
        let bestPejabatMatch = fuzz.extract(
            pejabatPengadaan.toLowerCase(),
            pejabatList.map(p => p.toLowerCase()),
            { scorer: fuzz.partial_ratio, limit: 1 }
        );
        
        if (bestPejabatMatch.length > 0 && bestPejabatMatch[0][1] >= 60) {  // Increased threshold to match instansi
            let originalMatch = pejabatList.find(p => p.toLowerCase() === bestPejabatMatch[0][0]);
            pejabatPengadaan = originalMatch || bestPejabatMatch[0][0];
        } else {
            return "⚠️ Pejabat pengadaan tidak ditemukan dalam daftar.";
        }
        

        answers.tanggalsurat = tanggalSurat;
        answers.emailpenerima = emailPenerima;

        let kodeRupArray = answers.kodeRup ? answers.kodeRup.split(",").map(r => r.trim()) : [];

        // console.log("\n📜 Extracted Data:");
        // console.log(`📌 Instansi: ${answers.instansi}`);
        // console.log(`📌 Nomor Surat: ${answers.nomorSurat}`);
        // console.log(`📌 Perihal: ${answers.perihal}`);
        // console.log(`📌 Tanggal Surat: ${answers.tanggalsurat}`);
        // console.log(`📌 Email Penerima: ${answers.emailpenerima}`);
        // console.log(`📌 Pejabat Pengadaan: ${pejabatPengadaan}`);
        // console.log(`📌 Kode RUP: ${kodeRupArray.join(", ") || "Tidak ada"}`);


        let googleFormURL = `https://docs.google.com/forms/d/e/1FAIpQLSdivk8RS_OSl1hX93beSaW19oYZKmxG9TiGD6-4o0cGGPdH3Q/viewform?usp=pp_url`
            + `&entry.1129931024=${encodeURIComponent(kodeRupArray.length)}` 
            + `&entry.51947438=${encodeURIComponent(answers.instansi).replace(/%20/g, "+")}` 
            + `&entry.1344618841=${encodeURIComponent(answers.nomorSurat.replace(/\s+|\.{2,}/g, ""))}`
            + `&entry.1992581915=${encodeURIComponent(answers.perihal.replace(/\.+/g, ""))}`
            + `&entry.1712954723=${encodeURIComponent(answers.tanggalsurat)}`
            + `&entry.1732353446=${encodeURIComponent(answers.emailpenerima)}`
            + `&entry.1189723868=${encodeURIComponent(pejabatPengadaan)}`;

        const entryRupFields = [
            "1758763754", "1665074227", "1214865365", "1172219468", "480767324",
            "1966776539", "171809390", "1364507263", "1478064799", "1818751586",
            "1600732722", "1182121141", "762453082", "1311139489", "2115970786",
            "488204573", "899865557", "1817032607", "119318655", "759792063", 
            "621960190", "1859907600", "2049718850", "1064239266", "610042270",
            "872279779", "1540825750", "1576439004", "1385684866", "1334924361"
        ];

        kodeRupArray.forEach((rup, index) => {
            if (entryRupFields[index]) {
                googleFormURL += `&entry.${entryRupFields[index]}=${encodeURIComponent(rup)}`;
            }
        });

        console.log(`\n🔗 Google Form URL:\n${googleFormURL}`);

        return `📜 <b>Data yang Diekstrak:</b>\n`
        + `<blockquote>📌 Instansi: ${answers.instansi}\n`
        + `📌 Nomor Surat: ${answers.nomorSurat}\n`
        + `📌 Perihal: ${answers.perihal}\n`
        + `📌 Tanggal Surat: ${answers.tanggalsurat}\n`
        + `📌 Email Penerima: ${answers.emailpenerima}\n`
        + `📌 Pejabat Pengadaan: ${pejabatPengadaan}\n`
        + `📌 Kode RUP: ${kodeRupArray.join(", ") || "Tidak ada"}</blockquote>\n\n`
        + `🔗 <b>Tautan Google Form:</b>\n<blockquote expandable>${googleFormURL}</blockquote>`;
    
    } catch (error) {
        console.error("❌ Error:", error.message);
        return "❌ Terjadi kesalahan saat memproses gambar.";
    }
}

module.exports = { processImage };
