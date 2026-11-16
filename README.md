# 🔥 666 BOT — DUO STREAK

**TWO MEMBERS. ONE CONNECTION. ONE STREAK.**

Discord bot khusus **666 DUO STREAK**: dua member terhubung sebagai Duo, lalu streak bertambah hanya ketika **keduanya** menyelesaikan aktivitas valid pada hari yang sama. Dibangun dengan Node.js 22+, discord.js v14, dan MongoDB.

```
🔥 666 DUO STREAK
DUO CONNECTION: ACTIVE
Tama  ×  Zen
🔥 28 DAYS STREAK — 28 DAYS TOGETHER
BOTH MEMBERS COMPLETED TODAY'S ACTIVITY
BEST STREAK: 45 DAYS • DUO XP: 2,800 XP
666 SYSTEM • DUO CONNECTION
```

## Fitur

- **Duo Connection** — undang partner, terima/tolak, satu member hanya boleh punya satu Duo aktif.
- **Daily Duo Streak** — streak +1 hanya jika kedua member aktif pada hari yang sama.
- **Timezone-aware** — default `Asia/Jakarta`, dapat diubah per server; pergantian hari konsisten dan anti double-count.
- **Activity detection** — membaca pesan valid, anti spam, cooldown, minimum panjang pesan, abaikan bot/emoji-only/link-only.
- **Profile Card PNG** — kartu 1280×1280 dengan avatar Discord asli, streak, best streak, XP, total hari, status hari ini, dan progres badge.
- **Leaderboard Card PNG** — halaman leaderboard dengan avatar, nama Duo, current/best streak, dan pagination tombol.
- **666 DUO STREAK LOGS** — log otomatis saat streak benar-benar naik, tidak dobel per hari.
- **Automatic Rewards** — milestone 7, 14, 30, 50, 100, dan 365 hari; diberikan sekali.
- **Notification** — reminder harian, streak selesai, streak putus, badge baru, dan partner keluar.
- **History & Leaderboard** — riwayat lengkap dan peringkat dengan pagination.
- **Server Config** — timezone, channel notifikasi, jam reminder, cooldown, minimum panjang pesan, dan log channel.
- **Restart-safe** — aktivitas, streak, reward, konfigurasi, dan antrean log tersimpan di MongoDB.
- **Streak API opsional** — endpoint HTTP untuk uptime monitor.
- **Test suite** — 55 test otomatis tanpa MongoDB atau token Discord.

## Teknologi

| Komponen | Versi |
| --- | --- |
| Node.js | **22+** |
| discord.js | `^14.28.1` |
| MongoDB | 6 / 7 / 8 |
| Mongoose | `^8.24.9` |
| @napi-rs/canvas | `^1.1.1` |
| Test runner | built-in `node:test` |

## Persyaratan

- Node.js 22 atau lebih baru.
- MongoDB lokal, Docker, atau MongoDB Atlas.
- Discord Application + Bot Token.
- Scope `bot` dan `applications.commands`.
- Privileged intent **Message Content** dan **Server Members**.
- Font sudah dibundel di `src/assets/fonts`.

## Quick Start

```bash
npm install
cp .env.example .env
# isi DISCORD_TOKEN, DISCORD_CLIENT_ID, MONGODB_URI
npm run deploy   # opsional; bot juga auto-deploy saat start
npm start
```

Setelah bot online:

```text
/duo invite @partner
/duo accept          (dijalankan oleh partner)
/duo profile         (kartu profil PNG)
/duo streak
/duo help
```

Admin server dapat mengatur log:

```text
/duo setlog #duo-streak-logs
/duo logstatus
```

## Setup Discord Application

1. Buka <https://discord.com/developers/applications> → **New Application**.
2. Tab **Bot** → salin token ke `DISCORD_TOKEN`.
3. Aktifkan **MESSAGE CONTENT INTENT** dan **SERVER MEMBERS INTENT**.
4. Tab **General Information** → salin Application ID ke `DISCORD_CLIENT_ID`.
5. OAuth2 → URL Generator → scope `bot` + `applications.commands`; permission minimal `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`.

## Environment Variables

### Wajib

| Variable | Keterangan |
| --- | --- |
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_CLIENT_ID` | Application ID |
| `MONGODB_URI` | Koneksi MongoDB |

### Opsional

| Variable | Default | Keterangan |
| --- | --- | --- |
| `GUILD_ID` | kosong | Deploy slash command instan ke satu server |
| `DEFAULT_TIMEZONE` | `Asia/Jakarta` | Timezone default server baru |
| `ACTIVITY_COOLDOWN_SECONDS` | `60` | Cooldown aktivitas |
| `MIN_MESSAGE_LENGTH` | `3` | Panjang minimum pesan valid |
| `XP_PER_DAY` | `100` | Duo XP per hari lengkap |
| `INVITE_TTL_HOURS` | `24` | Masa berlaku undangan |
| `MAX_PENDING_INVITES` | `3` | Maksimum undangan pending per member |
| `REMINDER_HOUR` | `21` | Jam reminder (0–23) |
| `REMINDER_MINUTE` | `0` | Menit reminder |
| `NOTIFICATIONS_ENABLED` | `true` | Notifikasi global |
| `AUTO_DEPLOY` | `true` | Auto-register slash command saat start |
| `ENABLE_API` | `true` | Aktifkan Streak API |
| `API_PORT` | `3000` | Port API |
| `API_HOST` | `0.0.0.0` | Host API |
| `API_KEY` | kosong | Jika diisi, `/api/*` membutuhkan `x-api-key` |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `LOG_TO_FILE` | `false` | Simpan log ke `logs/666bot.log` |
| `NODE_ENV` | `production` | Environment |

## Commands

Semua command memakai slash command `/duo`.

| Subcommand | Fungsi |
| --- | --- |
| `/duo help` | Panduan lengkap |
| `/duo invite @member` | Mengundang partner |
| `/duo accept` | Menerima undangan |
| `/duo decline` | Menolak undangan |
| `/duo profile [user]` | Profil + kartu PNG |
| `/duo streak` | Status streak hari ini |
| `/duo leaderboard [category]` | Peringkat Duo |
| `/duo rewards` | Badge dan progres |
| `/duo history` | Riwayat aktivitas |
| `/duo rename <nama>` | Mengganti nama Duo |
| `/duo break` | Mengakhiri Duo dengan konfirmasi |
| `/duo config` | Pengaturan server (Manage Server) |
| `/duo setlog #channel` | Channel log otomatis (Manage Server) |
| `/duo logstatus` | Status log otomatis (Manage Server) |

`/help` menampilkan panduan yang sama secara ephemeral.

## Cara Kerja Duo Streak

1. Member A mengundang member B dengan `/duo invite`.
2. B menerima dengan `/duo accept`; keduanya menjadi satu Duo aktif.
3. Setiap hari, masing-masing member harus mengirim minimal satu pesan valid.
4. Jika keduanya aktif pada hari yang sama, streak bertambah satu.
5. Jika hanya satu yang aktif sampai pergantian hari, streak putus.
6. Hari dihitung berdasarkan timezone server, bukan waktu lokal masing-masing member.

Aktivitas tidak dihitung jika pesan berasal dari bot, hanya emoji, hanya link, terlalu pendek, spam, berulang, atau masih dalam cooldown.

## Rewards

Milestone badge: **7, 14, 30, 50, 100, dan 365 hari**. Reward diberikan sekali per Duo dan disimpan di `DuoReward`, sehingga tidak dobel setelah restart atau multi-instance.

## Notifications & Logs

- Reminder harian dikirim sekali per hari setelah jam reminder server.
- Notifikasi streak selesai/putus dan badge baru dapat dikirim ke channel atau DM.
- `/duo setlog` mengaktifkan **666 DUO STREAK LOGS**.
- Log hanya dibuat saat streak bertambah; satu log per Duo per hari.
- Log yang gagal terkirim masuk antrean durable dan dicoba ulang oleh scheduler.

## Database

Database dan data lama **tidak dihapus** oleh versi ini. Collection yang dipakai:

| Collection | Fungsi |
| --- | --- |
| `Duo` | Relasi dan status streak |
| `Invitation` | Undangan pending |
| `DailyActivity` | Aktivitas harian per member |
| `StreakHistory` | Riwayat event streak |
| `DuoReward` | Reward yang sudah diberikan |
| `UserStat` | Statistik per user |
| `GuildConfig` | Konfigurasi server |
| `StreakLog` | Antrean dan status log |

Unique index utama: satu user hanya boleh berada di satu Duo aktif. TTL index membersihkan undangan kedaluwarsa.

## Streak API (opsional)

Aktif dengan `ENABLE_API=true`.

| Endpoint | Keterangan |
| --- | --- |
| `GET /health` | Status bot, MongoDB, uptime, queue |
| `GET /api/stats?guildId=...` | Statistik global/server |
| `GET /api/leaderboard?guildId=...&category=current` | Leaderboard |
| `GET /api/duo/:userId?guildId=...` | Detail Duo dan status hari ini |
| `GET /api/rewards/:userId?guildId=...` | Reward dan progres |

Jika `API_KEY` diisi, endpoint `/api/*` memerlukan header `x-api-key`. `/health` tetap publik.

## Testing

Test berjalan tanpa MongoDB dan tanpa token Discord:

```bash
npm test
```

Cakupan: flow Duo lengkap, tombol accept/decline/break, activity detection, timezone, streak rollover, reward idempotency, notifikasi, streak log, render kartu PNG, embed, validator, dan Streak API.

## Struktur Project

```text
src/
  commands/
    duo/                    subcommand /duo
    help.js                 /help
  config/                   env + validasi
  database/models/          model MongoDB Duo Streak
  events/                   ready, interaction, message, member remove
  handlers/                 loader command/event
  services/                 duo, activity, streak, reward, config, log,
                            notification, profile, scheduler, card, API
  ui/
    cards/                  renderer PNG
    embeds.js               embed 666
    paginator.js            pagination tombol
  utils/                    logger, time, validators, member, cooldown
tests/                      test suite in-memory
```

## Troubleshooting

| Masalah | Solusi |
| --- | --- |
| Bot tidak start | Pastikan `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, dan `MONGODB_URI` valid. |
| Slash command tidak muncul | Jalankan `npm run deploy`; command global bisa butuh hingga 1 jam. |
| Aktivitas tidak dihitung | Cek cooldown, panjang pesan, channel ignored, dan intent Message Content. |
| Streak tidak naik | Kedua member harus menyelesaikan aktivitas valid pada hari yang sama. |
| Log tidak terkirim | Pastikan `/duo setlog` sudah diatur dan bot punya permission Send Messages + Attach Files. |
| Kartu gagal dirender | Pastikan dependency `@napi-rs/canvas` terpasang; sistem tetap mengirim embed fallback. |

## License

MIT.
