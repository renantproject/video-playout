# PlayoutStream: Desktop Video Player & SRT Playout Broadcaster

> **PlayoutStream** adalah aplikasi pemutar video desktop profesional dan broadcaster real-time berbasis **SRT (Secure Reliable Transport)** yang dirancang untuk Master Control Room (MCR), operator live streaming, broadcast switcher (vMix, OBS Studio, TriCaster), dan event playout.

---

## 🚀 Fitur Utama Sesuai PRD

### 1. Local Media Player & Live Preview (FR-1.1 - FR-1.5)
- **Format Media Universal:** Mendukung `.mp4`, `.mov`, `.mkv`, `.avi`, `.ts` (H.264, H.265, AAC).
- **Protokol Streaming Internal (`media-file://`):** Mendukung HTTP 206 Partial Content (Range bytes), memungkinkan scrubbing halus dan instant buffer tanpa hambatan browser file policy.
- **Kontrol Playback Lengkap:** Play, Pause, Stop, Previous/Next clip, Scrubber bar responsif, dan **Frame Stepping (-1 frame / +1 frame)**.
- **Dual Timecode Display:** Elapsed Time (`HH:MM:SS.FF`), Total Duration, dan Remaining Time countdown (`[-HH:MM:SS]`).
- **Real-Time Audio VU Meter:** Peak meter stereo dual-channel L/R dengan skala decibel (-60 dB hingga 0 dB) berbasis Web Audio API Analyser.
- **Auxiliary Monitor Output:** Jendela pratinjau sekunder tanpa bezel (clean video feed) tersinkronisasi untuk layar eksternal, proyektor, atau capture card.

### 2. Queue & Playlist Management (FR-2.1 - FR-2.5)
- **Drag-and-Drop Ingest:** Drag langsung file video dari Windows Explorer ke area playlist antrean.
- **Metadata Otomatis:** Ekstraksi otomatis resolusi (misal: 1920x1080), framerate (misal: 60 fps), durasi, dan **thumbnail snapshot** menggunakan FFprobe/FFmpeg.
- **Antrean Interaktif:** Reorder via drag & drop atau tombol naik/turun, duplikasi klip, hapus per item, dan pembersihan antrean (Clear All).
- **4 Mode Playout Otomasi:**
  1. `Sequential`: Memutar daftar antrean secara berurutan dari atas ke bawah.
  2. `Manual Cue`: Selesai memutar klip, otomatis standby di frame pertama klip berikutnya.
  3. `Loop Clip`: Mengulang klip yang sedang aktif terus-menerus.
  4. `Loop All`: Mengulang seluruh antrean video dari awal secara terus-menerus.

### 3. SRT Broadcast Module & Seamless Splicing (FR-3.1 - FR-3.4)
- **3 Mode Koneksi SRT:**
  - `Caller Mode`: Mengirim stream ke IP & port target (vMix, cloud SRT ingest).
  - `Listener Mode`: Membuka server listening lokal (e.g. `srt://0.0.0.0:9000`) agar OBS/vMix dapat melakukan pull stream.
  - `Rendezvous Mode`: Untuk koneksi peer-to-peer traversal NAT.
- **Seamless Playout Splicing:** Menggunakan FFmpeg concat demuxer dan filter graph normalisasi (`scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=60,format=yuv420p`) sehingga perpindahan video klip dengan resolusi atau fps berbeda **tidak pernah memutus socket SRT penerima**.
- **Security & Enkripsi:** Mendukung opsional `Stream ID` dan enkripsi passphrase `AES-128 / AES-256`.
- **Telemetri Real-time:** Menampilkan status On-Air (`LIVE`, `CONNECTING`, `IDLE`), Output Bitrate (kbps), Stream FPS, Dropped Frames, RTT (Round Trip Time ms), dan Buffer Health.
- **Auto-Reconnect:** Otomatis menyambung kembali jika koneksi jaringan terputus.

---

## 🛠️ Tech Stack
- **Framework Desktop:** Electron 33 + TypeScript
- **Frontend UI:** React 18 + Tailwind CSS + Lucide Icons
- **Bundler:** Vite 5 + vite-plugin-electron
- **Media & Playout Engine:** FFmpeg & FFprobe (Gyan full build dengan `libsrt`, `nvenc`, `qsv`, `amf`, `libx264`, `aac`)

---

## 📦 Cara Menjalankan

### 1. Menjalankan Mode Development
```bash
npm run dev
```

### 2. Kompilasi & Build Produksi
```bash
npm run build
```

### 3. Menjalankan Aplikasi
```bash
npm start
```

---

## 🎬 Pengujian Cepat dengan Sample Assets
Proyek ini telah dilengkapi 3 video broadcast sample 1080p60 di folder `samples/`:
- `samples/Intro_Bumper.mp4` (Durasi: 5 detik)
- `samples/Segment_01.mp4` (Durasi: 10 detik)
- `samples/Sponsor_Ad.mp4` (Durasi: 5 detik)

Cukup seret (drag & drop) file-file di atas ke panel **Playout Queue** di aplikasi untuk menguji pemutaran dan siaran SRT!

---

## ⌨️ Shortcut Keyboard

| Tombol | Fungsi |
|---|---|
| `Space` | Play / Pause |
| `S` | Stop & Reset ke Frame Awal |
| `Ctrl + Left` | Klip Sebelumnya |
| `Ctrl + Right` | Klip Berikutnya |
| `,` (Koma) | Mundur 1 Frame (-1F) |
| `.` (Titik) | Maju 1 Frame (+1F) |
| `Left / Right` | Seek mundur/maju 5 detik |
| `M` | Mute / Unmute Audio |
| `B` | Start / Stop SRT Broadcast On-Air |

