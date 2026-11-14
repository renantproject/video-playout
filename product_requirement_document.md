# Product Requirement Document (PRD)
## Desktop Video Player & SRT Playout Broadcaster

---

## 1. Document Information
- **Project Name:** Desktop Playout Player & SRT Broadcaster (PlayoutStream)
- **Target OS:** Windows 10/11 (Primary), macOS, Linux
- **Document Version:** v1.0.0
- **Status:** Draft / Ready for Review

---

## 2. Product Overview & Goals

### 2.1 Problem Statement
Operator event, live streaming, dan master control room (MCR) sering membutuhkan alat pemutar video sederhana untuk konten bumper, iklan, atau playback materi rekaman yang langsung disalurkan ke vision mixer (seperti vMix, OBS Studio, TriCaster, atau cloud switchers) melalui protokol jaringan berlatensi rendah tanpa harus membuka software broadcast suite yang berat.

### 2.2 Product Goals
1. Menyediakan aplikasi pemutar media desktop yang ringan, stabil, dan responsif.
2. Memfasilitasi pengelolaan playlist/antrean pemutaran video secara fleksibel (drag-and-drop, loop, reorder).
3. Mengirimkan sinyal output video/audio secara real-time melalui protokol **SRT (Secure Reliable Transport)** dengan stabilitas stream tinggi antar perpindahan klip video.

---

## 3. User Personas & Use Cases

| Persona | Kebutuhan Utama | Goal |
|---|---|---|
| **Live Stream Operator** | Memutar playlist video bumper/sponsor saat jeda acara live. | Stream video langsung masuk ke OBS/vMix via SRT input tanpa screen capture. |
| **Broadcaster / Playout Operator** | Playout video berurutan tanpa jeda black screen atau decoder crash. | Transmisi berkelanjutan ke SRT ingest point dengan buffer latency terkontrol. |

---

## 4. System & Tech Stack Recommendation

- **Desktop Framework:**
  - **Tauri (Rust + React/Svelte):** Direkomendasikan untuk ukuran binary ultra-kecil dan konsumsi RAM rendah.
  - *Alternatif:* **Electron (Node.js + React):** Pilihan cepat dengan ekosistem integrasi yang matang.
- **Media Engine & SRT Transcoder:**
  - **FFmpeg (Embedded binary):** Menangani demuxing, decoding, scaling seragam, dan encoding MPEG-TS via SRT library (`libsrt`).
  - **HTML5 Video Element / Canvas:** Untuk rendering preview lokal di UI.

---

## 5. Functional Requirements

### 5.1 Local Media Player (Preview)
- **FR-1.1:** Mendukung format file umum: `.mp4`, `.mov`, `.mkv`, `.avi`, `.ts` (H.264, H.265, AAC).
- **FR-1.2:** Kontrol dasar: Play, Pause, Stop, Step Frame, Seek Scrubber.
- **FR-1.3:** Tampilan timecode: Elapsed Time / Remaining Time / Total Duration.
- **FR-1.4:** Volume slider, Mute toggle, dan Audio Level Meter (Peak Meter L/R).
- **FR-1.5:** Toggle Fullscreen Preview untuk monitor sekunder.

### 5.2 Queue & Playlist Management
- **FR-2.1:** **Add Media:** Tombol File Picker atau Drag-and-Drop langsung dari file explorer.
- **FR-2.2:** **Reorder:** Drag-and-drop item untuk mengubah urutan pemutaran.
- **FR-2.3:** **Item Metadata:** Menampilkan judul file, thumbnail, resolusi, framerate, dan durasi masing-masing klip.
- **FR-2.4:** **Item Actions:** Remove individual item, Clear All, Duplicate item.
- **FR-2.5:** **Playback Modes:**
  - `Sequential`: Putar berurutan dari atas ke bawah.
  - `Loop Item`: Mengulang satu klip yang sedang aktif.
  - `Loop Playlist`: Mengulang seluruh daftar antrean jika sudah selesai.
  - `Manual Cue`: Selesai memutar satu klip, berhenti di frame pertama klip berikutnya (standby).

### 5.3 SRT Broadcast Module
- **FR-3.1:** **Connection Modes:**
  - `Caller Mode`: Mengirim stream ke IP & port target (misal: vMix / cloud ingest).
  - `Listener Mode`: Membuka listening socket lokal agar switcher penerima dapat melakukan pull stream.
  - `Rendezvous Mode`: Untuk koneksi *peer-to-peer* melewati NAT traversal sederhana.
- **FR-3.2:** **Configurable Parameters:**
  - Destination Host / IP dan Destination Port.
  - Latency Buffer (default: 200ms, range: 20ms - 8000ms).
  - Stream ID (opsional, untuk routing server SRT).
  - Passphrase (enkripsi AES-128 / AES-256).
- **FR-3.3:** **Playout Continuity (Seamless Splicing):**
  - Menggunakan filter graph FFmpeg untuk standarisasi output (misal: *normalize* semua klip ke 1080p60 CBR).
  - Mencegah SRT socket terputus saat beralih dari satu klip ke klip lainnya dengan resolusi/fps berbeda.
- **FR-3.4:** **Broadcast Control & Telemetry:**
  - Tombol aksi: `Start Broadcast` / `Stop Broadcast`.
  - Indikator status: `IDLE`, `CONNECTING`, `LIVE`, `ERROR`.
  - Live metric overlay: Output Bitrate (kbps), Drop Frames, RTT (Round Trip Time), dan SRT buffer health.

---

## 6. UI/UX Wireframe & Layout Concept

```text
+------------------------------------------------------------------------------------+
| App Header: File | Settings | Tools | Help                                        |
+---------------------------------------------------+--------------------------------+
|                                                   | Playlist Queue                 |
|                                                   | [ + Add Files ] [ Clear All ]  |
|                                                   |--------------------------------|
|               VIDEO PREVIEW WINDOW                | [::] 1. Intro_Bumper.mp4 00:15 |
|                                                   | [::] 2. Segment_01.mp4   05:30 |
|                                                   | [::] 3. Sponsor_Ad.mov   00:30 |
|                                                   |                                |
|                                                   | Play Mode: [ Sequential v ]    |
|                                                   | Loop: [Off / Single / All]     |
+---------------------------------------------------+--------------------------------+
| Timecode: 00:02:14 / 00:05:30 [ -00:03:16 ]                                       |
| [===========================O====================================================] |
| Controls: [ |< ] [ > Play ] [ || Pause ] [ Stop ] [ >| ] | Vol: [========|] 80%     |
+------------------------------------------------------------------------------------+
| SRT BROADCAST PANEL                                                                |
| Mode: [ Caller v ]  Host: [ 192.168.1.100 ] Port: [ 9000 ] Latency: [ 200 ms ]     |
| Status: [ ● LIVE ] | Bitrate: 4520 kbps | RTT: 12ms | Drops: 0  | [ STOP BROADCAST ]|
+------------------------------------------------------------------------------------+
```

---

## 7. Non-Functional Requirements

| Aspek | Spesifikasi |
|---|---|
| **Performance** | Utilisasi CPU < 20% pada decoding/encoding 1080p60 dengan hardware acceleration (NVENC, Intel QuickSync, Apple VideoToolbox). |
| **Memory Footprint** | Standby RAM < 350 MB; Saat streaming aktif < 700 MB. |
| **Audio-Video Sync** | Toleransi A/V desync maksimal $\pm 10\text{ ms}$. |
| **Resilience** | Fitur *Auto-reconnect* otomatis mencoba menyambung kembali jika koneksi SRT terputus akibat packet drop ekstrim. |
| **Packaging** | Standalone installer / Portable executable (Windows `.exe` / macOS `.dmg` / Linux `.AppImage`). |

---

## 8. Implementation Details: FFmpeg Playout Pipeline

Contoh perintah pipeline backend FFmpeg untuk membaca playlist terpadu dan melakukan broadcast SRT secara stabil:

```bash
# Menjalankan FFmpeg dengan concat demuxer dan target SRT Caller
ffmpeg -re -f concat -safe 0 -i playlist.txt \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=60,format=yuv420p" \
  -c:v libx264 -preset veryfast -b:v 4500k -maxrate 5000k -bufsize 10000k -g 120 \
  -c:a aac -b:a 128k -ar 48000 \
  -f mpegts "srt://192.168.1.100:9000?mode=caller&latency=200000&pkt_size=1316"
```

---

## 9. Development Phases & Roadmap

### Phase 1: MVP Player & Queue (Weeks 1-2)
- Inisialisasi UI shell desktop (Tauri / Electron).
- Fitur drag-and-drop file video ke panel antrean.
- Player engine lokal dengan kontrol playback dasar.

### Phase 2: SRT Broadcast Integration (Weeks 3-4)
- Integrasi pipeline FFmpeg background process.
- Form konfigurasi parameter SRT (Caller, Listener, Latency, Passphrase).
- Verifikasi transmisi SRT ke receiver (OBS Studio / vMix).

### Phase 3: Playout Reliability & Telemetry (Weeks 5-6)
- Penanganan transisi klip tanpa memutus koneksi SRT (*seamless concat scaling*).
- Panel telemetri real-time (bitrate monitor, RTT counter, status koneksi).
- Packaging aplikasi dan pengujian di multi-platform.