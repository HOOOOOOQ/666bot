# 🔥 666 BOT

**TWO MEMBERS. ONE CONNECTION. ONE STREAK.**

Discord bot dengan fitur utama **666 DUO STREAK** — sistem streak harian untuk dua member yang saling terhubung sebagai Duo. Dibangun dengan Node.js 22, discord.js v14, MongoDB, dan arsitektur modular yang siap dijalankan 24/7 di hosting **Pterodactyl**.

```
🔥 666 DUO STREAK
DUO CONNECTION: ACTIVE
Tama  ×  Zen
🔥 28 DAYS STREAK — 28 DAYS TOGETHER
BOTH MEMBERS COMPLETED TODAY'S ACTIVITY
BEST STREAK: 45 DAYS • DUO XP: 2,800 XP
666 SYSTEM • DUO CONNECTION
```

---

## Daftar Isi

1. [Fitur](#fitur)
2. [Teknologi](#teknologi)
3. [Persyaratan](#persyaratan)
4. [Quick Start](#quick-start)
5. [Setup Discord Application](#setup-discord-application)
6. [Environment Variables](#environment-variables)
7. [Setup MongoDB](#setup-mongodb)
8. [Deploy Slash Commands](#deploy-slash-commands)
9. [Menjalankan Bot](#menjalankan-bot)
10. [Deploy ke Pterodactyl](#deploy-ke-pterodactyl)
11. [Commands](#commands)
12. [Cara Kerja Duo Streak](#cara-kerja-duo-streak)
13. [Rewards](#rewards)
14. [Notifikasi](#notifikasi)
15. [Leaderboard](#leaderboard)
16. [Database](#database)
17. [Security & Reliability](#security--reliability)
18. [Streak API (HTTP)](#streak-api-http)
19. [Testing](#testing)
20. [Struktur Project](#struktur-project)
21. [Troubleshooting](#troubleshooting)
22. [Checklist Deployment](#checklist-deployment)

---

## Fitur

- **Duo Connection** — undang partner, terima/tolak, satu member hanya bisa berada di satu Duo aktif.
- **Daily Duo Streak** — streak bertambah hanya jika **kedua member** menyelesaikan aktivitas valid pada hari yang sama.
- **Timezone-aware day boundary** — default `Asia/Jakarta`, bisa diubah per server. Pergantian hari konsisten dan anti double-count.
- **Activity detection dari Message Event** — anti spam, anti pesan berulang, cooldown, minimum panjang pesan, abaikan bot/emoji-only/link-only/command-like.
- **Duo Profile Card (image)** — kartu PNG 1280×1280 bergaya dark cyber / blood red / gothic gaming: avatar Discord asli kedua member, nama, streak, best streak, Duo XP, total days, status aktivitas harian, progress badge. Bukan dummy data.
- **Duo Leaderboard Card (image)** — rank dengan avatar, nama Duo, current streak, best streak. Rank 1 emas, 2 perak, 3 perunggu, sisanya merah. 10 Duo per halaman + tombol Prev/Next.
- **666 DUO STREAK LOGS** — channel log otomatis per server. Bot memposting banner + embed setiap kali streak benar-benar naik: timestamp, kedua avatar, nama, current/previous/best streak, XP, status aktivitas.
- **Automatic Rewards** — 7, 14, 30, 50, 100, 365 hari. Sekali diberikan, tidak akan pernah dobel.
- **Notification System** — reminder harian sekali per hari, notifikasi streak selesai, streak putus, dan badge baru. Bisa dikirim ke channel atau DM.
- **Leaderboard** — current streak, best streak, total XP, total days. Pagination tombol.
- **History** — riwayat joined, completed, broken, reward, ended. Pagination tombol.
- **Server Config** — `/duo config` untuk timezone, channel notifikasi, jam reminder, cooldown, minimum panjang pesan.
- **MongoDB** — 8 collection terpisah, unique index, partial index, TTL index, validasi schema.
- **Restart-safe** — streak, aktivitas, reward, konfigurasi, dan antrean log tetap konsisten setelah restart.
- **Graceful shutdown** — flush antrean log & notifikasi, tutup API, tutup koneksi MongoDB.
- **Streak API opsional** — endpoint HTTP untuk uptime monitor (Pterodactyl).
- **Test suite** — 48 test otomatis (`node --test`) termasuk render kartu PNG, dedupe log, retry, dan recovery setelah restart.

---

## Teknologi

| Komponen | Versi |
| --- | --- |
| Node.js | **22+** (wajib) |
| discord.js | `^14.28.1` |
| MongoDB | 6 / 7 / 8 (local atau Atlas) |
| Mongoose | `^8.24.9` |
| dotenv | `^17.4.2` |
| @napi-rs/canvas | `^1.1.1` (prebuilt, tanpa system library) |
| Test runner | built-in `node:test` |

---

## Persyaratan

- Node.js **22.0.0** atau lebih baru (`node -v`).
- MongoDB (local, Docker, atau MongoDB Atlas).
- Discord Application + Bot Token.
- Bot diundang ke server dengan scope `bot` + `applications.commands`.
- Privileged intents **Message Content** dan **Server Members** diaktifkan.
- Font sudah dibundel di `src/assets/fonts` (Bebas Neue + Chakra Petch, lisensi OFL). Tidak perlu install font di host.

---

## Quick Start

```bash
# 1. Install dependency
npm install

# 2. Salin template environment
cp .env.example .env

# 3. Isi .env (token, client id, MongoDB URI)
nano .env

# 4. Deploy slash commands (opsional, bot juga auto-deploy saat start)
npm run deploy

# 5. Jalankan
npm start
```

Setelah bot online:

```text
/duo invite @partner
/duo accept          (dijalankan oleh partner)
/duo profile         (kartu profil PNG)
/duo leaderboard     (kartu leaderboard PNG)
/duo help
```

Admin dapat mengaktifkan log otomatis:

```text
/duo setlog #duo-streak-logs
/duo logstatus
```

---

## Setup Discord Application

1. Buka <https://discord.com/developers/applications> → **New Application** → beri nama `666 BOT`.
2. Tab **Bot**:
   - Klik **Reset Token** → salin token ke `DISCORD_TOKEN`.
   - Aktifkan **MESSAGE CONTENT INTENT** (wajib untuk membaca isi pesan).
   - Aktifkan **SERVER MEMBERS INTENT** (wajib untuk mendeteksi member keluar).
3. Tab **General Information** → salin **Application ID** ke `DISCORD_CLIENT_ID`.
4. Tab **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`
   - Buka URL hasil generate → pilih server → authorize.

> Catatan: bot tidak membutuhkan permission Administrator. Cukup permission di atas.

---

## Environment Variables

Semua konfigurasi sensitif dibaca dari `.env` — **tidak ada token/kredensial di source code**.

### Wajib

| Variable | Contoh | Keterangan |
| --- | --- | --- |
| `DISCORD_TOKEN` | `MTIz...` | Bot token |
| `DISCORD_CLIENT_ID` | `123456789012345678` | Application ID |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/666bot` | Koneksi MongoDB |

### Opsional

| Variable | Default | Keterangan |
| --- | --- | --- |
| `GUILD_ID` | *(kosong)* | Deploy command instan ke 1 server (testing). Kosong = global. |
| `DEFAULT_TIMEZONE` | `Asia/Jakarta` | Timezone default server baru |
| `ACTIVITY_COOLDOWN_SECONDS` | `60` | Cooldown aktivitas |
| `MIN_MESSAGE_LENGTH` | `3` | Panjang minimum pesan valid |
| `XP_PER_DAY` | `100` | Duo XP per hari lengkap |
| `INVITE_TTL_HOURS` | `24` | Masa berlaku undangan |
| `MAX_PENDING_INVITES` | `3` | Maksimum undangan pending per member |
| `REMINDER_HOUR` | `21` | Jam reminder harian (0–23) |
| `REMINDER_MINUTE` | `0` | Menit reminder |
| `NOTIFICATIONS_ENABLED` | `true` | Notifikasi global |
| `AUTO_DEPLOY` | `true` | Auto-register slash command saat start |
| `ENABLE_API` | `true` | Aktifkan Streak API HTTP |
| `API_PORT` | `3000` | Port API |
| `API_HOST` | `0.0.0.0` | Host API |
| `API_KEY` | *(kosong)* | Jika diisi, `/api/*` butuh header `x-api-key` |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `LOG_TO_FILE` | `false` | Simpan log ke `logs/666bot.log` |
| `NODE_ENV` | `production` | Environment |

---

## Setup MongoDB

### Opsi A — MongoDB lokal / VPS

```bash
# Ubuntu/Debian (contoh)
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

URI: `mongodb://127.0.0.1:27017/666bot`

### Opsi B — MongoDB Atlas (gratis)

1. Buat cluster di <https://cloud.mongodb.com>.
2. **Database Access** → buat user + password.
3. **Network Access** → allow IP server bot (atau `0.0.0.0/0` untuk testing).
4. **Connect → Drivers** → salin connection string:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/666bot?retryWrites=true&w=majority
```

### Catatan penting

- Bot **tidak memerlukan replica set / transaction**. Semua proteksi race condition memakai atomic update + unique index, sehingga MongoDB standalone (umum di Pterodactyl) aman.
- Collection dan index dibuat otomatis saat startup (`Model.createIndexes()`).
- Unique index utama: satu user hanya boleh berada di **satu Duo aktif**. Duo yang sudah di-`break` tidak menghalangi pembuatan Duo baru.
- Index TTL menghapus undangan pending yang kedaluwarsa secara otomatis.
- Jika startup log menampilkan error index, bersihkan dokumen duplikat lama lalu restart.

---

## Deploy Slash Commands

Register command **sebelum** atau saat bot start.

```bash
# Deploy ke guild pada GUILD_ID (instan, cocok untuk testing)
npm run deploy

# Deploy global (bisa butuh hingga 1 jam propagasi)
node src/deploy-commands.js --global
```

Dengan `AUTO_DEPLOY=true`, bot otomatis meng-update command setiap start. Set `AUTO_DEPLOY=false` jika ingin deploy manual saja (mis. untuk menghemat rate limit).

> Jika `GUILD_ID` diisi, command hanya terdaftar di guild tersebut. Command global lama tidak otomatis dihapus.

---

## Menjalankan Bot

```bash
npm start        # production
npm run dev      # development (node --watch)
npm test         # jalankan test suite
```

Startup yang sehat akan menampilkan log seperti:

```text
[boot] Environment: production • Node v22.x
[ready] Logged in as 666 BOT#0001
[ready] Registered 1 guild slash command(s)
[cards] Canvas renderer ready (fonts + background plates loaded).
[streaklogs] 666 DUO STREAK LOGS service ready.
[scheduler] Daily scheduler started
[api] Streak API listening on http://0.0.0.0:3000
```

---

## Deploy ke Pterodactyl

### 1. Egg & Runtime

Gunakan **Node.js Egg** (generic) dengan image Node **22**:

- Docker image: `ghcr.io/parkervcp/yolks:nodejs_22` (atau image Node 22 lain yang tersedia di panel).
- Startup command: **`npm start`** (atau `node src/index.js`).
- Install command: **`npm install --omit=dev`**.

### 2. Upload project

- Upload file project (tanpa `node_modules`, tanpa `.env`) via **File Manager** atau clone Git:

```bash
git clone https://github.com/HOOOOOOQ/666bot.git .
npm install --omit=dev
```

### 3. Environment variables

Tambahkan di tab **Startup** panel Pterodactyl **atau** buat file `.env` lewat File Manager:

```
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
MONGODB_URI=mongodb://...
DEFAULT_TIMEZONE=Asia/Jakarta
AUTO_DEPLOY=true
```

> Jangan pernah menaruh token di file yang di-commit ke Git. `.env` sudah masuk `.gitignore`.

### 4. Port (opsional)

Jika `ENABLE_API=true`:

- Buat **Additional Allocation** di panel.
- Set `API_PORT` ke port allocation tersebut.
- Pterodactyl otomatis memetakan port; `API_HOST=0.0.0.0` wajib.

Jika tidak memakai API: `ENABLE_API=false`.

### 5. 24/7

- Aktifkan **Start on Boot**.
- Bot menangani `SIGTERM`/`SIGINT` dengan graceful shutdown (aman saat restart dari panel).
- `uncaughtException` akan menutup proses dengan kode error, lalu panel menjalankan ulang otomatis.
- Rendering memakai **@napi-rs/canvas** yang sudah menyertakan binary prebuilt — tidak perlu `libcairo`, `pango`, atau `ffmpeg` di container. Font dan background plate ikut di repository (`src/assets`), jadi hasil render identik di Pterodactyl.
- Render kartu memakai ~1–3 MB per gambar dan CPU singkat (< 1 detik). Cache avatar 250 entri / 15 menit; aman untuk RAM 512 MB.
- Untuk menghemat resource, biarkan `LOG_LEVEL=info` dan `LOG_TO_FILE=false`.

### 6. Backup

Data penting ada di MongoDB, bukan di filesystem container. Backup dari sisi MongoDB (Atlas snapshot / `mongodump`).

---

## Commands

Semua command berada di bawah `/duo`.

| Command | Fungsi |
| --- | --- |
| `/duo invite @member` | Mengirim undangan Duo (dengan tombol Accept/Decline) |
| `/duo accept` | Menerima undangan Duo terbaru |
| `/duo decline` | Menolak undangan Duo terbaru |
| `/duo profile [user]` | Kartu PNG profil Duo: kedua avatar, nama, streak, best, XP, total days, status harian |
| `/duo streak` | Info streak saat ini + status aktivitas hari ini |
| `/duo leaderboard [category] [page]` | Kartu PNG peringkat Duo (current/best/xp/days) 10 baris + pagination |
| `/duo rewards` | Semua badge + progres menuju badge berikutnya |
| `/duo history [page]` | Riwayat joined/completed/broken/reward/ended |
| `/duo rename <nama>` | Mengubah nama Duo (sanitasi mention & karakter kontrol) |
| `/duo break` | Mengakhiri Duo dengan konfirmasi tombol |
| `/duo config` | Pengaturan server (Manage Server): timezone, channel, reminder, cooldown, min length |
| `/duo setlog #channel` | Mengaktifkan channel **666 DUO STREAK LOGS** (Manage Server) |
| `/duo logstatus` | Status sistem log: channel, sent/pending/failed/skipped, log terakhir (Manage Server) |
| `/duo help` | Panduan lengkap |

Detail `/duo config`:

```
/duo config timezone:Asia/Jakarta channel:#duo-log reminder_hour:21 notifications:true
/duo config clear_channel:true
/duo config cooldown_seconds:90 min_message_length:5
```

Tanpa opsi, `/duo config` hanya menampilkan konfigurasi saat ini.

---

## 666 DUO STREAK LOGS

Log otomatis dikirim ke channel yang dipilih admin **hanya saat streak benar-benar bertambah** (kedua member aktif pada hari yang sama).

```text
/duo setlog #duo-streak-logs
/duo logstatus
```

Contoh pesan log:

```text
🔥 666 DUO STREAK UPDATED
STREAK INCREASED!
🔥 27 DAYS → 28 DAYS

✅ Tama completed   ✅ Zen completed

CURRENT STREAK: 28 DAYS • PREVIOUS: 27 DAYS • BEST: 45 DAYS
DUO XP: 2,800 XP • TOTAL DAYS: 28
666 SYSTEM • AUTOMATIC LOGS
```

Setiap log juga menyertakan **banner PNG** berisi kedua avatar, nama, current/previous/best streak, XP, total hari, status aktivitas, dan timestamp.

Aturan yang dijamin:

| Aturan | Implementasi |
| --- | --- |
| Hanya saat increment nyata | Dipanggil setelah atomic update streak berhasil |
| Tidak dikirim jika hanya satu member aktif | Streak baru naik saat `activityCount = 2` |
| Tidak dobel per hari | Unique index `{ duoId, dayKey }` pada collection `streaklogs` |
| Satu increment per Duo per hari | Filter `lastCompletedDay != dayKey` |
| DB sebagai sumber kebenaran | Snapshot log disimpan sebelum dikirim |
| Konsisten setelah restart | Baris `sending` di-recover saat boot, lalu retry otomatis |
| Retry tanpa double-post | Klaim atomik `pending/failed → sending`, exponential backoff 1→30 menit, maksimum 6 attempt |
| Channel per server | `GuildConfig.logChannelId` |

`/duo logstatus` menampilkan jumlah terkirim, antrean, gagal, dilewati, serta log terakhir. Log gagal akan dicoba ulang otomatis oleh scheduler setiap 30 detik dan saat startup.

---

## Cara Kerja Duo Streak

### 1. Membentuk Duo

```
A: /duo invite @B
B: /duo accept
```

Validasi yang dilakukan:

- Tidak bisa mengundang diri sendiri.
- Tidak bisa mengundang bot.
- Pengundang dan target tidak boleh sudah punya Duo aktif.
- Maksimal 3 undangan pending; maksimal 10 undangan per jam.
- Undangan berlaku 24 jam.
- Satu user hanya bisa berada di satu Duo aktif **per server** (unique partial index MongoDB).

Setelah diterima, `currentStreak = 0`. **Streak baru dimulai setelah kedua member menyelesaikan aktivitas pertama.**

### 2. Aktivitas Harian

Syarat pesan dihitung sebagai aktivitas valid:

- Dikirim oleh member manusia di dalam server (bukan DM, bukan bot).
- Bukan pesan sistem.
- Panjang konten ≥ `MIN_MESSAGE_LENGTH` (default 3) setelah emoji/mention/link dibersihkan.
- Bukan emoji-only, bukan mention-only, bukan link-only.
- Bukan spam: `aaaaaaa`, `lolololo`, `asdfasdf`, karakter berulang, atau rasio karakter unik sangat rendah.
- Tidak dimulai dengan `!`, `/`, atau `.` (mirip command).
- Cooldown aktivitas default 60 detik per member.
- Pesan identik yang diulang dalam 30 detik tidak dihitung.
- Channel yang di-ignore (jika dikonfigurasi) tidak dihitung.

Satu member hanya bisa menyumbang **satu aktivitas per hari**. Penulisan aktivitas dilindungi unique index `{ duoId, userId, dayKey }`, sehingga 1.000 pesan atau restart bot tidak akan menghitung ganda.

### 3. Kapan Streak Bertambah?

Saat aktivitas kedua member pada hari yang sama tercatat:

```
currentStreak += 1
totalDays     += 1
xp            += XP_PER_DAY
bestStreak     = max(bestStreak, currentStreak)
lastCompletedDay = hari ini
```

Proses ini memakai atomic update dengan filter `lastCompletedDay != hari ini`, sehingga dua pesan yang masuk bersamaan tetap hanya menambah **satu** hari streak.

### 4. Kapan Streak Putus?

Scheduler memeriksa setiap guild setiap 30 detik:

- Saat pergantian hari (timezone server), semua Duo aktif yang `lastCompletedDay` bukan hari kemarin akan di-reset `currentStreak = 0` dan dicatat sebagai `broken`.
- Notifikasi streak putus dikirim sekali.
- `bestStreak`, `totalDays`, XP, dan badge **tetap tersimpan**.
- Jika bot sempat offline, pengecekan catch-up otomatis berjalan saat startup.

### 5. Timezone & Hari

- Semua hari disimpan sebagai `dayKey` `YYYY-MM-DD` pada timezone server.
- Default `Asia/Jakarta` (UTC+7), dapat diubah per server via `/duo config`.
- Tidak bergantung pada jam host, sehingga pindah hosting tidak mengubah boundary hari.
- Perhitungan DST-aware (untuk timezone yang memakai DST).

### 6. Restart Safety

- Aktivitas harian unik per hari.
- `lastCompletedDay` mencegah streak bertambah dua kali.
- History memiliki unique index per `{ duoId, dayKey, type }`.
- Reward memiliki unique index per `{ duoId, milestone }`.
- Reminder dibatasi `lastReminderDay` atomik.
- Duo cache di memori hanya berisi Duo aktif dan otomatis di-invalidate saat break/rename.

---

## Rewards

| Milestone | Badge |
| --- | --- |
| 7 hari | 🥉 Rookie Duo Badge |
| 14 hari | 🔗 Connected Duo Badge |
| 30 hari | ⚔️ Elite Duo Badge |
| 50 hari | 🔥 Flame Duo Badge |
| 100 hari | 👑 Legendary Duo Badge |
| 365 hari | 👑 Eternal Duo Badge |

Badge diberikan **otomatis** ketika streak mencapai milestone, disimpan di collection `duorewards`, dicatat di `streakhistories`, dan tidak pernah dobel. Badge tetap dimiliki setelah streak putus.

---

## Notifikasi

| Event | Kapan | Tujuan |
| --- | --- | --- |
| Streak selesai | Saat kedua member aktif | Channel notifikasi / DM |
| Streak putus | Saat rollover mendeteksi hari tidak lengkap | Channel / DM |
| Badge baru | Saat milestone tercapai | Channel / DM |
| Reminder harian | Pukul `reminder_hour` (default 21:00), hanya jika streak belum lengkap | Channel / DM |
| Partner keluar server | Saat member meninggalkan server | Partner yang tersisa |

- Reminder dikirim **maksimal sekali per Duo per hari** (`lastReminderDay`).
- Channel notifikasi diatur via `/duo config channel:#channel`. Tanpa channel, notifikasi dikirim via DM.
- Semua notifikasi melewati queue dengan delay agar aman terhadap rate limit Discord.
- Matikan reminder dengan `/duo config reminders:false`, atau matikan semua dengan `notifications:false`.

---

## Leaderboard

Kategori:

| Kategori | Field |
| --- | --- |
| `current` | Current streak |
| `best` | Best streak |
| `xp` | Total Duo XP |
| `days` | Total Days Together |

```text
/duo leaderboard category:best
/duo leaderboard category:xp page:2
```

Setiap halaman dirender sebagai **kartu PNG 1280×1280**: rank, dua avatar Discord, nama Duo, current streak, dan best streak. 10 Duo per halaman dengan tombol Prev / Next / Close. Rank 1 emas, rank 2 perak, rank 3 perunggu, rank lainnya merah. Hanya Duo berstatus `active` yang masuk peringkat, dan angkanya dibaca langsung dari MongoDB.

---

## Database

### Collections

| Collection | Isi |
| --- | --- |
| `duos` | Member, nama, streak, best streak, total days, XP, status, tanggal |
| `invitations` | Undangan pending/accepted/declined/expired + TTL |
| `dailyactivities` | 1 dokumen per member per hari per Duo |
| `streakhistories` | Event: joined, completed, broken, reward, ended |
| `duorewards` | Badge yang sudah didapat per milestone |
| `userstats` | Statistik per member: hari aktif, pesan, completed days, streak |
| `guildconfigs` | Timezone, notifikasi, reminder, cooldown, channel, `logChannelId` |
| `streaklogs` | Satu baris per Duo per hari yang streak-nya naik + status pengiriman/retry |

### Index penting

```text
duos            { guildId: 1, members.userId: 1 } unique partial(status=active)
duos            { guildId, status, currentStreak } (leaderboard)
invitations     { guildId, fromUserId, toUserId } unique partial(status=pending)
dailyactivities { duoId, userId, dayKey } unique
streakhistories { duoId, dayKey, type } unique
duorewards      { duoId, milestone } unique
userstats       { guildId, userId } unique
guildconfigs    { guildId } unique
streaklogs      { duoId, dayKey } unique
streaklogs      { status, nextAttemptAt } (retry queue)
streaklogs      { guildId, createdAt } (logstatus)
```

### Struktur dokumen Duo

```js
{
  guildId: "900000000000000001",
  name: "Tama × Zen",
  members: [
    { userId: "100...1", username: "tama", displayName: "Tama", avatar: "https://..." },
    { userId: "100...2", username: "zen",  displayName: "Zen",  avatar: "https://..." }
  ],
  status: "active",
  currentStreak: 28,
  bestStreak: 45,
  totalDays: 28,
  xp: 2800,
  lastCompletedDay: "2026-11-13",
  lastReminderDay: "2026-11-13",
  streakStartedAt: ISODate("2026-10-17T..."),
  notificationsEnabled: true
}
```

---

## Security & Reliability

- **Validasi command** — tipe opsi, nama Duo disanitasi, semua member diverifikasi.
- **Cegah Duo ganda** — unique partial index per server + pengecekan sebelum insert.
- **Cegah undangan ke diri sendiri / bot** — validasi eksplisit.
- **Anti invite spam** — maksimal 3 pending, 10 undangan/jam, TTL 24 jam, unique pending index.
- **Anti aktivitas palsu** — validasi konten, anti spam, anti pesan berulang, cooldown.
- **Anti double count** — unique daily activity, atomic `lastCompletedDay`, cache per hari.
- **Race condition** — atomic `findOneAndUpdate` dengan filter status & hari; aman tanpa transaction.
- **Error handling** — command error ditangkap dan dibalas ephemeral; event error di-log tanpa mematikan bot.
- **Logging** — scoped logger `boot`, `duo`, `activity`, `streak`, `rewards`, `notify`, `scheduler`, `api`.
- **Rate limit aware** — queue notifikasi berurutan, delay 1.2 detik.
- **Graceful shutdown** — flush antrean log + notifikasi, tutup API, putus MongoDB.
- **Tanpa kredensial di source** — semua lewat `.env`.
- **Permission** — `/duo config`, `/duo setlog`, dan `/duo logstatus` membutuhkan `Manage Server`.
- **Log delivery** — unique index per hari, klaim atomik, retry exponential backoff, recovery saat restart.
- **API opsional** — `API_KEY` untuk membatasi akses endpoint `/api/*`.

---

## Streak API (HTTP)

Aktif secara default (`ENABLE_API=true`). Berguna untuk uptime monitor, status page, atau dashboard eksternal.

```bash
# Health (public)
curl http://localhost:3000/health

# Statistik
curl "http://localhost:3000/api/stats?guildId=900000000000000001" \
  -H "x-api-key: YOUR_KEY"

# Leaderboard
curl "http://localhost:3000/api/leaderboard?guildId=900000000000000001&category=current&limit=10"

# Detail Duo berdasarkan Discord User ID
curl "http://localhost:3000/api/duo/100000000000000001?guildId=900000000000000001"

# Badge
curl "http://localhost:3000/api/rewards/100000000000000001?guildId=900000000000000001"
```

Contoh respons `/health`:

```json
{
  "ok": true,
  "status": "online",
  "uptimeSeconds": 86400,
  "bot": { "id": "123", "tag": "666 BOT#0001", "ping": 42, "guilds": 1 },
  "database": { "state": "connected", "ready": true },
  "notificationsQueued": 0
}
```

- Bind ke `0.0.0.0` agar bisa diakses dari luar container Pterodactyl.
- Jika `API_KEY` diisi, kirim header `x-api-key` (atau `?key=`).
- Rate limit 90 request/menit per IP.
- Matikan dengan `ENABLE_API=false` jika tidak diperlukan.

---

## Testing

Test suite berjalan **tanpa MongoDB dan tanpa token Discord** — memakai in-memory database yang meniru Mongoose + unique index.

```bash
npm test
```

Cakupan:

- Timezone & day-key (midnight Jakarta, leap year, DST-safe offset, US timezone).
- Sanitasi nama Duo dan validasi konten pesan/spam.
- Undangan: self-invite, bot, duplikat, double-duo, limit pending.
- Alur lengkap: invite → accept → aktivitas A → aktivitas B → streak +1.
- Aktivitas hanya satu member tidak menambah streak.
- Anti double-count (termasuk 2 aktivitas bersamaan).
- 7 hari berturut-turut → Rookie Duo Badge (dan tidak dobel).
- Rollover memutus streak, menyimpan best streak, idempotent, dan streak bisa dimulai ulang.
- Break Duo membebaskan member untuk membuat Duo baru.
- Reminder hanya sekali per hari.
- Leaderboard & history.
- Semua embed (profile, streak, rewards, history, notifikasi, help) dirender tanpa `undefined`/`NaN`.
- Renderer PNG profile, leaderboard, dan streak log menghasilkan buffer valid (> 10 KB).
- Log otomatis: hanya saat increment, tidak untuk satu member, unik per hari, retry tanpa dobel, recovery setelah restart.
- `/duo setlog` memvalidasi Manage Server + izin bot; `/duo logstatus` menghitung antrean.

---

## Struktur Project

```text
666bot/
├── src/
│   ├── index.js                  # Entry point, client, graceful shutdown
│   ├── deploy-commands.js        # Register slash commands
│   ├── config/
│   │   └── index.js              # Env loader + validation
│   ├── commands/
│   │   └── duo/
│   │       ├── index.js          # /duo builder + subcommand router
│   │       ├── invite.js
│   │       ├── accept.js
│   │       ├── decline.js
│   │       ├── profile.js
│   │       ├── streak.js
│   │       ├── leaderboard.js
│   │       ├── rewards.js
│   │       ├── history.js
│   │       ├── rename.js
│   │       ├── break.js
│   │       ├── config.js
│   │       ├── setlog.js
│   │       ├── logstatus.js
│   │       ├── help.js
│   │       └── _shared.js
│   ├── events/
│   │   ├── ready.js
│   │   ├── messageCreate.js
│   │   ├── interactionCreate.js
│   │   └── guildMemberRemove.js
│   ├── handlers/
│   │   ├── commandHandler.js
│   │   └── eventHandler.js
│   ├── services/
│   │   ├── duoService.js
│   │   ├── streakService.js
│   │   ├── activityService.js
│   │   ├── rewardService.js
│   │   ├── notificationService.js
│   │   ├── schedulerService.js
│   │   ├── configService.js
│   │   ├── profileService.js
│   │   ├── cardService.js        # Render PNG + cache avatar
│   │   ├── logService.js         # Queue, retry, dedupe 666 DUO STREAK LOGS
│   │   └── apiService.js
│   ├── database/
│   │   ├── connection.js
│   │   └── models/
│   │       ├── Duo.js
│   │       ├── Invitation.js
│   │       ├── DailyActivity.js
│   │       ├── StreakHistory.js
│   │       ├── DuoReward.js
│   │       ├── UserStat.js
│   │       ├── GuildConfig.js
│   │       ├── StreakLog.js
│   │       └── index.js
│   ├── ui/
│   │   ├── theme.js              # Warna, emoji, progress bar
│   │   ├── embeds.js             # Embed card, log & notifikasi
│   │   ├── paginator.js          # Tombol Prev/Next + image attachment
│   │   └── cards/
│   │       ├── canvasTools.js    # Font, panel, crown, flame, chain, avatar
│   │       ├── profileCard.js    # Render profil 1280×1280
│   │       ├── leaderboardCard.js# Render leaderboard 1280×1280
│   │       ├── streakLogCard.js  # Render banner log 1280×720
│   │       └── payloads.js       # Embed + AttachmentBuilder
│   ├── assets/
│   │   ├── fonts/                # Bebas Neue + Chakra Petch (OFL)
│   │   └── images/               # Background plate 666
│   └── utils/
│       ├── time.js               # Timezone, day key, midnight
│       ├── validators.js         # Sanitasi & anti spam
│       ├── logger.js
│       ├── errors.js
│       ├── cooldown.js
│       └── members.js
├── tests/
│   ├── duoFlow.test.js
│   ├── commands.test.js
│   ├── streakLog.test.js
│   ├── embeds.test.js
│   ├── time.test.js
│   ├── validators.test.js
│   └── helpers/fakeDb.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| `Configuration: DISCORD_TOKEN is missing` | `.env` belum dibuat/terbaca. Pastikan file ada di root project. |
| Bot online tapi slash command tidak muncul | Jalankan `npm run deploy`. Jika global, tunggu hingga 1 jam. Coba `GUILD_ID` + `npm run deploy`. |
| Aktivitas tidak dihitung | Aktifkan **MESSAGE CONTENT INTENT** di Developer Portal; pastikan pesan ≥ 3 karakter, bukan emoji/link/command, dan user punya Duo aktif. |
| Streak tidak bertambah meski dua member chat | Kedua member harus chat di **hari yang sama** (timezone server), dan masing-masing minimal satu pesan valid. Cek `/duo streak`. |
| Streak putus padahal sudah chat | Cek timezone server (`/duo config`). Pesan setelah pergantian hari dihitung untuk hari baru. |
| Reminder tidak terkirim | Pastikan `reminders` aktif, channel notifikasi valid, dan DM member terbuka. Reminder hanya untuk Duo dengan streak > 0 yang belum lengkap. |
| Log streak tidak muncul | Jalankan `/duo setlog #channel`, pastikan kedua member benar-benar menyelesaikan aktivitas hari itu, dan bot punya izin **View Channel, Send Messages, Embed Links, Attach Files**. Cek `/duo logstatus`. |
| Log gagal terkirim | Buka `/duo logstatus`. Sistem retry otomatis (1→30 menit, maks 6 attempt). Jika channel dihapus, set ulang dengan `/duo setlog`. |
| `MongoServerError: E11000 duplicate key` saat startup/index | Ada data duplikat lama yang melanggar unique index. Bersihkan dokumen duplikat, lalu restart. |
| API tidak bisa diakses | Set `API_HOST=0.0.0.0`, buka allocation di Pterodactyl, cek firewall. |
| Bot restart terus | Cek log panel: biasanya token salah, MongoDB tidak reachable, atau Node < 22. |
| Command error "Cooldown" | Cooldown internal 2–3 detik antar pemakaian command. |

---

## Checklist Deployment

- [ ] Node.js 22+ terpasang.
- [ ] `npm install --omit=dev` selesai.
- [ ] `.env` berisi `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `MONGODB_URI`.
- [ ] Privileged intents **Message Content** + **Server Members** aktif.
- [ ] Bot diundang dengan scope `applications.commands`.
- [ ] Slash command terdeploy (`AUTO_DEPLOY` atau `npm run deploy`).
- [ ] MongoDB dapat diakses dari server.
- [ ] Timezone dipilih (`Asia/Jakarta` default).
- [ ] Channel notifikasi diset (opsional).
- [ ] `/duo setlog #channel` dijalankan dan `/duo logstatus` menunjukkan channel aktif.
- [ ] Port API dialokasikan (jika `ENABLE_API=true`).
- [ ] Test lulus: `npm test`.
- [ ] Uji alur nyata: invite → accept → chat dua member → cek `/duo profile`, `/duo leaderboard`, dan log otomatis di channel.

---

## Branding

```text
666 BOT
TWO MEMBERS. ONE CONNECTION. ONE STREAK.

🔥 666 DUO STREAK SYSTEM
```

Dibangun untuk koneksi harian yang benar-benar dijaga — bukan sekadar angka.
