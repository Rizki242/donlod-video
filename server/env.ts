// Diimpor paling awal oleh server.ts agar variabel .env sudah terbaca
// sebelum modul lain membaca process.env saat dimuat.
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });
