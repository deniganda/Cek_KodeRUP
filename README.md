# Telegram Bot

Bot Telegram ini dirancang untuk memeriksa Kode RUP (Rencana Umum Pengadaan) dari SiRUP dan memungkinkan pengguna untuk mengatur TARGET_KLPD.

## Daftar Perintah

- `/set_klpd`: Memulai proses pengaturan nama KLPD. Bot akan meminta Anda untuk memasukkan nama KLPD yang akan digunakan.
- `/rup [kode_rup]`: Memeriksa informasi untuk satu atau beberapa kode RUP. Kode RUP harus terdiri dari 8 digit angka dan dipisahkan dengan spasi.
- `/ping`: Menguji apakah bot berfungsi dengan baik.

## Instalasi

1. **Clone Repository:**

   ```bash
   git clone https://github.com/username/repository.git
   cd repository

2. **Instalasi Dependensi:**
   
   ```bash
   npm install

3. **Konfigurasi:**
   
     Salin `config_sample.env` menjadi `config.env`:
  
   ```bash
   cp config_sample.env config.env
   ```

   Setelah menyalin, buka file config.env dengan editor teks dan isi TELEGRAM_BOT_TOKEN dengan token bot Telegram Anda:

   ```bash
   TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
   ```
   Pastikan untuk mengganti your_telegram_bot_token_here dengan token bot Telegram yang Anda dapatkan dari BotFather.

   
4. **Jalankan Bot:**
  
   ```bash
   npm start

## Contoh Penggunaan

- **Menetapkan TARGET_KLPD:**

  Kirimkan perintah `/set_klpd` dan bot akan meminta Anda untuk memasukkan nama KLPD yang ingin digunakan. Contoh: Kirimkan `Kab. Lampung Barat` setelah perintah tersebut.

- **Memeriksa Kode RUP:**

  Kirimkan perintah `/rup 12341234 56785678` untuk memeriksa beberapa kode RUP.

- **Mengujicoba Bot:**

  Kirimkan perintah `/ping` untuk menguji apakah bot berfungsi dengan baik.
