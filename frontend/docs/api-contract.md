# Kontrak API Frontend Yusro

Dokumen ini mencatat apa yang **diharapkan frontend** dari backend, supaya penggabungan dengan backend mudah dicocokkan baris per baris.

- Disusun dari kode frontend: `src/lib/api/`, `src/features/*/api.ts`, dan `src/features/*/types.ts`. Bukan dikarang dari SDD.
- Patokan frontend: branch `feature/dengar-tirukan`, commit `593bbf0`.
- Patokan backend: `origin/backend-noval` commit `a8af544ff3eea628eb03d2cd4b295c5bd3e84b99` ("Update backend and CI", 2026-10-02 19:40 +0700). Dibaca dengan `git show`/`git ls-tree` saja.
- Acuan dokumen: SDD Bab 5 (`../../SDD.md`). Kalau SDD bertentangan dengan SRS, SRS yang berlaku.

**Arti kolom "Backend"**

| Nilai | Arti |
| --- | --- |
| sesuai | Path, method, dan bentuk data cocok dengan harapan frontend. |
| beda | Endpoint ada, tetapi path, request, respons, atau galatnya berbeda. Bedanya dijelaskan singkat. |
| belum ada | Tidak ada handler untuk path itu, atau handler hanya stub `501 Not Implemented`. |
| tidak dapat dipastikan | Kode backend tidak cukup untuk menyimpulkan. |

---

## 1. Ketentuan umum

### 1.1 Base URL dan prefix
- Semua request memakai `VITE_API_BASE_URL` + `/` + path relatif. Contoh: `auth/login` (`src/lib/api/client.ts`, `getBaseUrl`).
- `VITE_API_BASE_URL` **sudah memuat** `/api/v1`. Contoh `.env.example`: `http://localhost:3000/api/v1`. Garis miring di akhir dibuang.
- Kalau variabel kosong dan mode mock mati, request gagal dengan pesan konfigurasi.
- [FAKTA] Backend memakai `app.setGlobalPrefix('api/v1')` dan `enableCors()` tanpa opsi (`backend/src/main.ts`).

### 1.2 Autentikasi
- Header `Authorization: Bearer <accessToken>` dikirim pada semua request, kecuali yang memakai `auth: false`: register, login, forgot-password, reset-password.
- Token disimpan di `sessionStorage` (`src/lib/auth/tokenStore.ts`). Ini **menyimpang sementara dari SDD 6.3**: access token di memori + refresh token di cookie HttpOnly. Frontend belum memanggil `POST auth/refresh`.
- Saat request terautentikasi dijawab **401**:
  - token dihapus;
  - cache TanStack Query dibersihkan;
  - pengguna diarahkan ke `/login` dengan `state.from` (`src/app/providers.tsx`).
- Saat request terautentikasi dari endpoint mana pun dijawab **403 dengan `errorCode: AUTH_ACCOUNT_INACTIVE`** (akun dinonaktifkan saat sesinya masih aktif, SDD 3.16.5) [ASUMSI AS32]:
  - token dan cache dihapus seperti 401;
  - pengguna diarahkan ke `/login`, dan `message` server tampil di kotak status bernada peringatan (`src/lib/auth/sessionNotice.ts`);
  - 403 dengan kode lain (mis. `LEARNING_MATERIAL_LOCKED`) tidak mengakhiri sesi; endpoint publik (login) tidak terpengaruh.
- Sesi dipulihkan saat halaman dimuat ulang dengan `GET auth/me` (`src/lib/hooks/useAuth.ts`). Data pengguna lengkap (termasuk email) selalu diambil dari endpoint ini, bukan dari respons login.
- Header lain yang selalu dikirim:
  - `Accept: application/json`;
  - `Content-Type: application/json` untuk body objek;
  - untuk `FormData`, `Content-Type` diisi browser (multipart + boundary).
- `X-Request-Id` (SDD 5.4) tidak dikirim dan tidak dibaca.

### 1.3 Format respons (satu-satunya tempat: `src/lib/api/responseFormat.ts`)

**Sukses**

| Bentuk | Dikenali bila | Yang dibaca |
| --- | --- | --- |
| SDD 5.5 `{ success: true, message, data, meta }` | `success === true` dan ada `data` | `data`, `meta` (bila berbentuk meta pagination), `message` (string) |
| JSON mentah (sementara, bentuk backend saat ini) | selain di atas | seluruh body dianggap `data`; `meta` dan `message` = null |

**Galat**

| Bentuk | Dikenali bila | Yang dibaca |
| --- | --- | --- |
| SDD 5.5 `{ success: false, message, errorCode, errors? }` | `success === false` atau `errorCode` berupa string | `message` ditampilkan apa adanya; `errorCode` → `ApiError.code`; `errors` (atau `details`) → `ApiError.details` |
| NestJS `{ statusCode, message: string \| string[], error }` (sementara) | `message` berupa string atau array | hanya disimpan sebagai `serverMessage` untuk debug; **tidak** ditampilkan karena berbahasa Inggris |

`src/lib/api/ApiError.ts`:
- `ApiError.message` selalu kalimat Bahasa Indonesia.
- Untuk format SDD 5.5, isinya `message` server.
- Untuk format lain, isinya dipetakan dari status: 0 (jaringan), 400, 401, 403, 404, 409, 413, 415, 422, 429, 5xx, dan lainnya.
- Status **415** tanpa `errorCode` diperlakukan sebagai `AUDIO_FORMAT_UNSUPPORTED`.
- Field galat per kolom dibaca dari `errors[]` (`{ field, message }`). Ini dipakai di Profil (`applyFieldErrors`).

Query GET dicoba ulang 2 kali untuk jaringan/5xx. Galat 4xx tidak dicoba ulang (`src/app/providers.tsx`).

### 1.4 Pagination
- Request: query `?page=&limit=`, hanya bila diisi (`withPage`, `src/lib/api/types.ts`).
- Respons: `meta: { page, limit, total, totalPages }` (SDD 5.5). Dianggap valid bila `page` dan `totalPages` berupa angka.
- Dipakai di `progress/history` dan `imitation/tasks/:taskId/submissions`.
- Kalau `meta` tidak ada, Riwayat tetap tampil tanpa navigasi halaman.

### 1.5 Idempotency-Key
- Hanya untuk `POST imitation/tasks/:taskId/submissions` (SDD 5.23).
- Nilainya `crypto.randomUUID()`, dibuat **sekali per rekaman**, dan dipakai ulang saat rekaman yang sama dikirim ulang (misalnya setelah 503).
- Frontend mengharapkan kunci yang sama dalam 10 menit mengembalikan submission yang sama.

### 1.6 Unduhan berkas
- `apiRequestBlob` (`src/lib/api/client.ts`) membaca body sebagai `Blob`.
- Nama berkas diambil dari `Content-Disposition: attachment; filename="..."`.
- Kalau header tidak terbaca, Profil memakai nama cadangan `Laporan-<studentCode>-<YYYY-MM-DD>.pdf` (`src/features/profile/ProfilePage.tsx`).
- Untuk backend di origin lain, header `Content-Disposition` harus diizinkan lewat `Access-Control-Expose-Headers`. Tanpa itu browser menyembunyikannya.

### 1.7 Mode mock (`VITE_USE_MOCK`)
- `VITE_USE_MOCK=true` membuat `client.ts` memanggil `mockFetch` dari `src/lib/api/mock/` (import dinamis), bukan `fetch`.
- Mock meniru amplop SDD 5.5, galat, jeda jaringan, dan aturan bisnis. Datanya ada di memori dan kembali ke awal saat halaman dimuat ulang.
- `vite.config.ts` selalu mengganti `import.meta.env.VITE_USE_MOCK` menjadi literal (bawaan `'false'`). Akibatnya cabang mock dan modul mock terbuang dari build produksi; perbandingannya sengaja ditulis langsung di kondisi `if`.
- Kontrol uji manual di `window.__yusroMock` (hanya mode mock):
  - `failNext(status | 'network', pola)`;
  - `setDelay(ms)`;
  - `expireSession()`;
  - `nextEvaluation('FAILED')`;
  - `reset()`.
- Akun contoh: `santri@yusro.mock` / `santri123` dan `admin@yusro.mock` / `admin1234`.

### 1.8 Kondisi umum backend-noval (berlaku untuk semua baris di Bagian 2)
- [FAKTA] `backend/src/shared/interceptors/` dan `shared/filters/` hanya berisi `.gitkeep`. Respons sukses berupa **JSON mentah** dan galat berformat **NestJS**. Frontend masih membaca keduanya (1.3), tetapi `message` siap tampil dan `errorCode` tidak tersedia, sehingga penanganan berdasarkan kode galat tidak berjalan.
- [FAKTA] Sebagian galat backend mengirim objek kustom `{ message, error_code }`, misalnya di `imitation.service.ts`. Nama field `error_code` (snake_case) tidak dikenali `responseFormat.ts`, yang mencari `errorCode`.
- [FAKTA] `JwtAuthGuard` dipasang global (`APP_GUARD` di `app.module.ts`). Semua endpoint wajib token kecuali yang bertanda `@Public()`. `RolesGuard` hanya dipakai di `imitation` (POST submissions), `evaluation`, dan `monitoring`.
- [FAKTA] `ValidationPipe` global dengan `whitelist` + `forbidNonWhitelisted`: field body yang tidak dikenal DTO ditolak 400.
- [FAKTA] Galat validasi dikembalikan sebagai **400**, bukan 422 seperti SDD 5.21.
- [FAKTA] Masa berlaku JWT `1d` (`auth.module.ts`). SDD 6.11 menetapkan 15 menit + refresh 7 hari. Tidak ada refresh token.
- [FAKTA] Path parameter divalidasi `ParseUUIDPipe`: id harus UUID.

---

## 2. Endpoint per fitur

Kolom Peran mengikuti SDD/route frontend. Guard backend dibahas di kolom Backend.

### 2.1 Auth (`src/features/auth/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan (field utama) | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| POST `auth/register` | publik | body `RegisterInput { name, email, password, passwordConfirmation }`; tanpa token | `User { id, studentCode, name, email, role, status }` + `message` (ditampilkan di halaman login) | 409 `AUTH_EMAIL_TAKEN` (di kolom email + tautan masuk), 422 `AUTH_WEAK_PASSWORD` (di kolom password), `errors[]` | SDD 5.6 | **beda** (A1) |
| POST `auth/login` | publik | body `LoginInput { email, password }`; tanpa token | `LoginResponse { accessToken, expiresIn, user: AuthUser }`; hanya `accessToken` yang dipakai, user diambil dari `auth/me` | `AUTH_INVALID_CREDENTIALS` atau 400/401 tanpa kode → "Email atau password salah."; `AUTH_ACCOUNT_INACTIVE` atau 403 tanpa kode → pesan akun nonaktif | SDD 5.6, 3.2.7 | **beda** (A2) |
| POST `auth/logout` | Santri, Admin | tanpa body | tidak dibaca (`void`); token lokal tetap dihapus walau gagal | — | SDD 5.6 | **belum ada** |
| POST `auth/forgot-password` | publik | body `{ email }` | `data` null + `message` (ditampilkan) | umum | SDD 5.6 | **belum ada** |
| POST `auth/reset-password` | publik (token reset) | body `{ token, password, passwordConfirmation }` | `data` null + `message` (cadangan [ASUMSI] "Password berhasil diubah. Silakan masuk.") | `AUTH_RESET_INVALID` (pesan + tautan minta ulang), `AUTH_WEAK_PASSWORD` | SDD 5.6 | **belum ada** (A3) |
| GET `auth/me` | Santri, Admin | — | `User` = `AuthUser` + `email` [ASUMSI] | 401 → login; galat lain → layar "coba lagi" | SDD 5.6 (isi [ASUMSI]) | **belum ada** (A4) |

- **A1:**
  - `RegisterDto` hanya `{ email, password (min 8), name (min 1) }`. `passwordConfirmation` dari frontend akan **ditolak 400** karena `forbidNonWhitelisted`.
  - Respons berisi `{ accessToken, user }` (user tanpa `studentCode`), bukan `User` + `message`.
  - Email terpakai: `409 ConflictException('Email is already registered')` tanpa `errorCode`. Aturan huruf+angka (SDD 3.2.6) tidak diperiksa.
  - `@Public()` ada.
- **A2:**
  - Respons `{ accessToken, user: { id, email, name, role, status, createdAt, updatedAt } }`. Tidak ada `expiresIn` dan `studentCode`.
  - Kredensial salah: `401 'Invalid email or password'` tanpa kode; frontend tetap menampilkan pesan seragam.
  - Status akun tidak diperiksa saat login, jadi tidak ada 403 akun nonaktif.
  - `@Public()` ada.
  - Karena `auth/me` belum ada, login berhasil tetapi pemulihan sesi gagal (lihat A4).
- **A3:** model `PasswordResetToken` ada di `schema.prisma`, tetapi tidak ada endpoint maupun pengiriman email.
- **A4:** padanan terdekat adalah `GET user/me` (`user.controller.ts`). Isinya `{ id, email, name, role, status, createdAt, updatedAt }`, tanpa `studentCode` (kolom DB `studentId` tidak dipilih).

### 2.2 Profile (`src/features/profile/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `profile` | Santri | — | `Profile { studentCode, name, email, status, joinedAt }` (`joinedAt` tidak ditampilkan) | umum (layar galat + coba lagi) | SDD 5.7 | **belum ada** (stub `501`) |
| PATCH `profile` | Santri | body `{ name }` saja | `Profile` terbaru [ASUMSI] | `errors[]` field `name`; pesan server | SDD 5.7 | **belum ada** |
| PATCH `profile/password` | Santri | body `{ currentPassword, password, passwordConfirmation }` [ASUMSI] | tidak dibaca (`void`) | `errors[]` per kolom; `AUTH_WEAK_PASSWORD` → kolom password | SDD 5.7 (body [ASUMSI]) | **belum ada** |

### 2.3 Learning (`src/features/learning/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `learning/stages` | Santri | — | `StageSummary[] { id, code, title, orderIndex, access: UNLOCKED\|LOCKED, isCompleted?, lockReason?, materialsTotal, materialsCompleted }` | umum | SDD 5.8 | **beda** (L1) |
| GET `learning/stages/:stageId/materials` | Santri | — | `StageMaterials { stage { id, title, access }, materials: MaterialSummary[] { id, code, title, orderIndex, isRequired, status: COMPLETED\|AVAILABLE\|LOCKED, taskCount?, tasksCompleted?, lockReason? } }` | 404 dan `LEARNING_STAGE_LOCKED` → tanpa "coba lagi" | SDD 5.8 | **belum ada** (L2) |
| GET `learning/materials/:materialId` | Santri | — | `MaterialDetail { id, code, title, isRequired, status, blocks[] (TEXT/AUDIO/IMAGE), tasks[] { id, type, title, status [ASUMSI], bestScore, attemptCount }, navigation { previousMaterialId, nextMaterialId, nextMaterialLocked } }` | 404, `LEARNING_MATERIAL_LOCKED`, `LEARNING_MATERIAL_INACTIVE` → tanpa "coba lagi"; URL audio kedaluwarsa → refetch sekali | SDD 5.8 | **belum ada** |
| POST `learning/materials/:materialId/complete` | Santri | tanpa body | `CompleteMaterialResult { materialId, completedAt, progress { learningProgressPct, materialsCompleted, materialsTotal, tasksCompleted, tasksTotal }, stageUnlocked { id, code, title } \| null [ASUMSI] }` | pesan server | SDD 5.8, 5.23 | **beda** (L3) |
| GET `learning/continue` | Santri | — | `{ materialId, materialTitle, stageTitle } \| null` [ASUMSI] | umum | SDD 5.8 (isi [ASUMSI]) | **belum ada** |

- **L1:**
  - Respons berupa array `{ id, title, description, order, isUnlocked, materials[] { id, title, order, isRequired, status, isUnlocked, isCompleted } }`.
  - Tidak ada `code`, `orderIndex`, `access`, `lockReason`, `materialsTotal`, dan `materialsCompleted`.
  - `status` materi berisi status konten (`ACTIVE`), bukan status belajar.
- **L2:** daftar materi saat ini hanya tersedia sebagai `materials[]` di dalam `learning/stages`.
- **L3:**
  - Respons berupa baris `materialProgress` mentah (upsert). Tidak ada `progress` maupun `stageUnlocked`.
  - Materi terkunci: `403 'Material is locked'` tanpa kode.
  - Idempoten (upsert), tetapi `completedAt` ditimpa setiap kali dipanggil.

### 2.4 Dashboard (`src/features/dashboard/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `dashboard` | Santri | — | `DashboardData { greeting { name, studentCode }, learningProgressPct, lastMaterial \| null, unfinishedTasks[] { id, title, materialTitle }, lastAttemptScore { score, taskTitle, submittedAt } \| null, materialsCompleted, tasksCompleted, continueTarget { materialId } \| null }` | umum | SDD 5.8 | **belum ada** (tidak ada modul dashboard) |

### 2.5 Quiz / Dengar-Pilih (`src/features/quiz/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `quiz/tasks/:taskId` | Santri | — | `QuizTask { id, title, instruction, questionCount, attemptCount, bestScore, questions[] { id, orderIndex, prompt, audioUrl, options[] { id, label, arabicLabel, orderIndex } } }`; tanpa kunci jawaban | 404, `QUIZ_TASK_INACTIVE`, `TASK_INACTIVE`, `LEARNING_MATERIAL_LOCKED` → tanpa "coba lagi"; audio kedaluwarsa → refetch | SDD 5.9 | **belum ada** (Q1) |
| POST `quiz/tasks/:taskId/submit` | Santri | body `{ answers: [{ questionId, optionId }] }`, semua soal sekaligus | `QuizSubmitResult { attemptId, attemptNo, score, correctCount, questionCount, feedbackCategory, results[] { questionId, isCorrect, selectedOptionId, correctOptionId }, progress { learningProgressPct, tasksCompleted } }` | pesan server (`QUIZ_ANSWERS_INCOMPLETE`, `QUIZ_OPTION_MISMATCH` tidak ditangani khusus) | SDD 5.9 | **beda** (Q2) |
| GET `quiz/attempts/:attemptId` | Santri | — | `QuizAttempt` = `QuizSubmitResult` tanpa `progress` + `taskId`, `submittedAt`, `questions[]` snapshot `{ id, orderIndex, prompt, options }` [ASUMSI] | 404 → "Kembali ke riwayat", tanpa "coba lagi" | SDD 5.9 (isi [ASUMSI]) | **belum ada** |

- **Q1:** padanan terdekat adalah `GET quiz/tasks` (daftar semua tugas QUIZ). Opsi berbentuk `{ id, text }` tanpa `label`/`arabicLabel`/`orderIndex`. Soal berisi `audioId`, bukan `audioUrl`. Tidak ada `instruction`, `attemptCount`, dan `bestScore`.
- **Q2:**
  - Path backend `POST quiz/tasks/:taskId/attempts`.
  - Body sama (`SubmitQuizDto { answers[] { questionId (UUID), optionId (UUID) } }`).
  - Respons `{ attemptId, score, correctAnswers, totalQuestions, completedAt }`. Tidak ada `attemptNo`, `feedbackCategory`, `results[]`, dan `progress`, padahal `results[]` dibutuhkan layar hasil.
  - Galat validasi 400 (bukan 422) tanpa kode.

### 2.6 Imitation / Dengar-Tirukan (`src/features/imitation/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `imitation/tasks/:taskId` | Santri | — | `ImitationTask { id, title, instruction, referenceAudio { id, url, durationMs }, arabicText, constraints { acceptedFormats[], minDurationMs, maxDurationMs, maxSizeBytes, cooldownSeconds }, activeSubmission (+ polling [ASUMSI]) \| null, attemptCount, bestScore }` | 404 dan kode akses → tanpa "coba lagi"; audio kedaluwarsa → refetch | SDD 5.10 | **beda** (I1) |
| POST `imitation/tasks/:taskId/submissions` | Santri | multipart field `audio_file` (nama `rekaman.webm`/`rekaman.mp4`, format asli perangkat sesuai `acceptedFormats`); header `Idempotency-Key` | 202: `SubmitRecordingResult { submissionId, attemptNo, evaluationStatus: SUBMITTED, score: null, submittedAt, polling { recommendedSchedule[] { intervalMs, times }, stopAfterMs } }` | 409 `IMITATION_ACTIVE_EXISTS` → muat ulang tugas + DIPROSES; 429/`IMITATION_COOLDOWN` → hitung mundur `cooldownSeconds`; 413/422 dan `AUDIO_*`, `VALIDATION_ERROR`, `TASK_INACTIVE` → rekam ulang; 503/jaringan → kirim ulang rekaman yang sama | SDD 5.10, 3.6.8, 3.10.8, 5.23 | **beda** (I2) |
| GET `imitation/submissions/:id` | Santri | — | `SubmissionStatus`: pending `{ submissionId, evaluationStatus, score: null, feedbackCategory: null, submittedAt, processingStartedAt?, elapsedMs }` / evaluated `{ ..., score, feedbackCategory, feedbackLabel, evaluatedAt, attemptNo, bestScore, progress }` / failed `{ ..., score: null, failedAt, userMessage, canResend }` | 404 → "Kembali ke riwayat" (detail percobaan); galat polling diabaikan, jadwal lanjut | SDD 5.10 | **beda** (I3) |
| GET `imitation/tasks/:taskId/submissions` | Santri | query `?page=&limit=` | `SubmissionHistoryItem[] { submissionId, attemptNo, evaluationStatus, score, feedbackCategory, submittedAt }` [ASUMSI] + `meta` | umum | SDD 5.10 (isi [ASUMSI]) | **beda** (I4) |

- **I1:**
  - Respons `{ id, title, order, stageId, materialId, referenceAudio { id, originalName, durationSeconds, url } }`.
  - Tidak ada `instruction`, `arabicText`, `constraints`, `activeSubmission`, `attemptCount`, dan `bestScore`.
  - Durasi dalam detik (`durationSeconds`), bukan `durationMs`.
  - Tanpa `constraints`, frontend menampilkan "tidak mendukung perekaman" karena tidak ada format yang bisa dipilih.
  - Peran: hanya JWT, tanpa `@Roles`.
- **I2:**
  - Nama field multipart backend **`audio`**, bukan `audio_file`.
  - Hanya menerima **WAV PCM 16-bit 16 kHz mono**, batas 10 MB, durasi 2–60 detik (konstanta di kode). Ini bertentangan dengan keputusan final SRS FR-IMITATE-06: WebM/Opus + cadangan MP4, 1–30 detik, 5 MB, format asli.
  - Header `Idempotency-Key` tidak dibaca.
  - Status 201 (bawaan NestJS), bukan 202.
  - Respons `{ submissionId, status, submittedAt }`: tanpa `attemptNo` dan `polling`, dan memakai `status`, bukan `evaluationStatus`.
  - Semua galat audio 400 (bukan 413/422) tanpa kode.
  - 409/429 dikirim sebagai `{ message, error_code }`. Kodenya tidak terbaca (1.8). 429 tetap tertangani lewat status; 409 jatuh ke pesan umum, bukan ke tampilan DIPROSES.
  - `@Roles(SANTRI)` dengan `RolesGuard`.
- **I3:**
  - Respons `{ submissionId, status, score, feedback, errorCode, submittedAt, evaluatedAt, failedAt }`.
  - Nama field berbeda: `status` ≠ `evaluationStatus`, `feedback` ≠ `feedbackCategory`.
  - Tidak ada `feedbackLabel`, `elapsedMs`, `attemptNo`, `bestScore`, `progress`, `userMessage`, dan `canResend`.
  - `errorCode` teknis ikut dikirim ke Santri; SDD 5.10/UI-IMITATE-03 melarang informasi teknis untuk Santri.
  - `score` bertipe Decimal Prisma, kemungkinan terserialisasi sebagai string: **tidak dapat dipastikan** tanpa menjalankan backend.
- **I4:** array mentah tanpa pagination/`meta`, dengan nama field `status`/`feedback`. Ada `attemptNo`.

### 2.7 Progress dan riwayat (`src/features/progress/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `progress` | Santri | — | `Progress { learningProgressPct, materials { completed, total, pct }, tasks { completed, total, pct }, stages[] { id, title, access, pct } }` | umum | SDD 5.11 | **beda** (P1) |
| GET `progress/history` | Santri | query `?page=&limit=` | `HistoryItem[] { attemptId, taskId, taskTitle, materialTitle, taskType, attemptNo, score \| null, evaluationStatus \| null, displayStatus, submittedAt }` + `meta` | umum | SDD 5.11 | **belum ada** (P2) |

- **P1:** respons `{ materials { completed, total }, tasks { completed, total }, progress }`. `progress` ≠ `learningProgressPct`; tidak ada `pct` per bagian dan tidak ada `stages[]`.
- **P2:** padanan terdekat adalah `GET statistics/history` (lihat 2.10). Isinya hanya percobaan IMITATION yang EVALUATED, dengan field `{ submissionId, taskId, score, feedback, submittedAt, evaluatedAt }`. Tidak ada percobaan Dengar-Pilih, percobaan gagal, judul, `displayStatus`, dan pagination.

### 2.8 Statistik (`src/features/statistics/api.ts`, `types.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `statistics` | Santri | — | `Statistics { materialsCompleted, tasksCompleted, averageScore \| null [ASUMSI], bestScore \| null, learningProgressPct, evaluatedAttempts, failedAttempts }` | umum | SDD 5.12 | **beda** (S1) |
| GET `statistics/chart` | Santri | — | `StatisticsChart { points[] { sequence, attemptId, taskTitle, score, submittedAt }, trend: UP\|DOWN\|FLAT\|INSUFFICIENT_DATA }` | umum | SDD 5.12 | **belum ada** |

- **S1:**
  - Respons `{ materialsCompleted, tasksCompleted, progress, averageScore, bestScore, validEvaluationCount }`.
  - Beda nama: `progress` ≠ `learningProgressPct`, `validEvaluationCount` ≠ `evaluatedAttempts`. Tidak ada `failedAttempts`.
  - `averageScore`/`bestScore` sudah `null` bila belum ada hasil, sama dengan harapan frontend.
  - Hanya percobaan IMITATION yang dihitung (lihat Temuan T7).

### 2.9 Laporan (`src/features/report/api.ts`)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `report/pdf` | Santri | — (tanpa parameter identitas) | `application/pdf` sebagai Blob; nama dari `Content-Disposition` (SDD: `Laporan-<studentCode>-<tanggal>.pdf`) | pesan galat ditampilkan (mis. 503 `REPORT_BUSY`); tidak dicoba ulang | SDD 5.13 | **beda** (R1) |

- **R1:**
  - Path, method, dan `Content-Type` cocok.
  - Nama berkas `yusro-report.pdf`, bukan pola SDD.
  - `enableCors()` tanpa `exposedHeaders`, sehingga untuk origin berbeda frontend tidak dapat membaca `Content-Disposition` dan memakai nama cadangan.
  - Tidak ada pembatasan dua pembuatan bersamaan / `REPORT_BUSY`.
  - Peran: hanya JWT, tanpa `@Roles`.

### 2.10 Endpoint backend yang tidak dipanggil frontend

| Method + path | Controller backend | Catatan | Padanan di frontend |
| --- | --- | --- | --- |
| GET `/` (tanpa path) | `app.controller.ts` | `getHello`; wajib token (guard global) | — |
| GET `health` | `health.controller.ts` | `@Public()` | — |
| GET `user/me` | `user/user.controller.ts` | identitas pengguna tanpa `studentCode` | `GET auth/me` (2.1, A4) |
| GET `quiz/tasks` | `quiz/quiz.controller.ts` | daftar semua tugas QUIZ beserta soal | `GET quiz/tasks/:taskId` (2.5, Q1) |
| POST `quiz/tasks/:taskId/attempts` | `quiz/quiz.controller.ts` | kirim jawaban Dengar-Pilih | `POST quiz/tasks/:taskId/submit` (2.5, Q2) |
| GET `statistics/history` | `statistics/statistics.controller.ts` | hasil IMITATION yang EVALUATED, urut `evaluatedAt` | `GET progress/history` (2.7, P2); juga bahan `GET statistics/chart` |
| GET `evaluation` | `evaluation/evaluation.controller.ts` | kesiapan layanan ML `{ status: 'ready', evaluator }`; tanpa `@Roles` | `GET admin/evaluation/health` (2.13, M6) |
| GET `ml-client/health` | `ml-client/ml-client.controller.ts` | kesehatan layanan ML | — |
| GET `audio`, `content`, `task`, `student-admin` | masing-masing `*.controller.ts` | stub `501 Not Implemented` | — (admin) |
| GET `monitoring/students` | `monitoring/monitoring.controller.ts` | `@Roles(ADMIN)`; semua santri dengan statistik ringkas, tanpa pagination, pencarian, maupun filter | `GET admin/students` (2.12, S2-1) |
| GET `monitoring` | `monitoring/monitoring.controller.ts` | admin; status layanan `ok \| degraded` | `GET admin/evaluation/health` (2.13, M6) |
| GET `ml-client/health` | `ml-client/ml-client.controller.ts` | kesehatan layanan ML | `GET admin/evaluation/health` (2.13, M6) |

### 2.11 Admin — Dashboard (`src/features/admin/dashboard/api.ts`, `types.ts`; ditambahkan di A1)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `admin/dashboard` | Admin | — | `AdminDashboard { totalStudents, activeStudents, attemptsTotal, averageScore \| null [ASUMSI], averageProgressPct, evaluation { queued, processing, failedLast24h, serviceStatus [ASUMSI], modelVersion } }` | umum (layar galat + coba lagi); 401 → login | SDD 5.18 | **belum ada** (D1) |
| GET `admin/dashboard/attention` | Admin | — | `AttentionItem[] { studentId, studentCode, name, reasons[], learningProgressPct?, previousBest?, latestBest?, delta?, availableTasks? }` | umum; daftar kosong → pesan keadaan kosong | SDD 5.18, 3.17.3 | **belum ada** (D2) |

- **D1:** tidak ada route `admin/dashboard`. Padanan terdekat untuk kondisi layanan adalah `GET monitoring` (`monitoring.service.ts`, `@Roles(ADMIN)`): `{ status: 'ok' | 'degraded', services { api, ml: 'ok' | 'unavailable' }, checkedAt }`, tanpa angka antrean, versi model, maupun ringkasan santri. Nilai `degraded` akan tampil "Terganggu" menurut AS16.
- **D2:** tidak ada route `admin/dashboard/attention`. `StatisticsService.getStudentOverviewForAdmin()` menyediakan statistik per santri lewat `GET monitoring/students` (lihat 2.10 dan S2-1), tetapi tidak menghitung kriteria SDD 3.17.3. *(Koreksi A2: versi A1 dokumen ini keliru menulis fungsi itu tidak dipanggil route mana pun.)*

### 2.12 Admin — Santri (`src/features/admin/students/api.ts`, `types.ts`; ditambahkan di A2)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `admin/students` | Admin | query `page, limit (maks 100), q, stageId, progressMin, progressMax, scoreMin, scoreMax, status, sort` (`name \| progress \| averageScore \| lastActivity` + `:asc \| :desc`) | `StudentListItem[] { id, studentCode, name, email, currentStage (judul) \| null, learningProgressPct, averageScore \| null [ASUMSI], status, lastActivityAt \| null }` + `meta` | umum (layar galat + coba lagi); daftar kosong → pesan + HAPUS FILTER | SDD 5.14, 3.16.3, 3.16.4 | **belum ada** (S2-1) |
| GET `admin/students/:id` | Admin | — | `StudentDetail { id, studentCode, name, email, status, joinedAt, lastActivityAt \| null, currentStage { id, title } \| null, progress: Progress }` [ASUMSI] | 404 → "Kembali ke daftar santri", tanpa coba lagi | SDD 5.14 (isi [ASUMSI]) | **belum ada** |
| PATCH `admin/students/:id/status` | Admin | body `{ status: ACTIVE \| INACTIVE, reason? }` (reason maks 255 [ASUMSI]) | tidak dibaca; daftar, detail, dan dashboard diinvalidasi | `errors[]` field `reason` di bawah kolom; pesan server di dialog | SDD 5.14, 3.16.5 | **belum ada** |
| GET `admin/students/:id/statistics` | Admin | — | `Statistics`, sama dengan `GET statistics` sisi Santri [ASUMSI] | umum | SDD 5.14 (isi [ASUMSI]) | **belum ada** |
| GET `admin/students/:id/chart` | Admin | — | `StatisticsChart`, sama dengan `GET statistics/chart` sisi Santri [ASUMSI] | umum | SDD 5.14 (isi [ASUMSI]) | **belum ada** |
| GET `admin/students/:id/history` | Admin | query `?page=&limit=` | `HistoryItem[]` + `meta`, sama dengan `GET progress/history` | umum; kosong → "Belum ada riwayat pengerjaan tugas." | **[ASUMSI] endpoint baru**, tidak ada di SDD | **belum ada** |
| GET `admin/students/:id/report/pdf` | Admin | — | `application/pdf` sebagai Blob; nama dari `Content-Disposition`, cadangan `Laporan-<studentCode>-<YYYY-MM-DD>.pdf` (tanggal lokal) | pesan galat ditampilkan | SDD 5.14, FR-REPORT-03 | **belum ada** |
| GET `admin/stages` | Admin | — | `StageOption[] { id, code, title, orderIndex, status }` tanpa pagination [ASUMSI]; dipakai filter tahapan (akan dipakai lagi di A4) | gagal → filter tahapan tidak tersedia, daftar tetap tampil | SDD 5.15 (isi [ASUMSI]) | **belum ada** (S2-2) |

- **S2-1:** tidak ada route `admin/students`. Padanan terdekat `GET monitoring/students` (`@Roles(ADMIN)`) mengembalikan seluruh santri `{ id, studentId, name, email, status, statistics { materialsCompleted, tasksCompleted, progress, averageScore, bestScore, validEvaluationCount } }` tanpa pagination, pencarian, filter, urutan, tahapan, maupun aktivitas terakhir. Nama field berbeda: `studentId` ≠ `studentCode`, `statistics.progress` ≠ `learningProgressPct`. Statistik di sana hanya menghitung IMITATION (lihat AS15).
- **S2-2:** tidak ada route `admin/stages`. Padanan terdekat `GET learning/stages` (lihat L1) hanya untuk konteks santri dan menyertakan status buka per pengguna.
- Endpoint 5.14 lainnya tidak punya padanan; ubah status akun dan laporan per santri belum ada di backend.

### 2.13 Admin — Monitoring Evaluasi (`src/features/admin/monitoring/api.ts`, `types.ts`; ditambahkan di A3)

| Method + path | Peran | Request | Respons yang diharapkan | Galat yang ditangani frontend | Sumber | Backend |
| --- | --- | --- | --- | --- | --- | --- |
| GET `admin/submissions` | Admin | query `status (SUBMITTED\|PROCESSING\|EVALUATED\|FAILED), taskId, studentId, from, to (YYYY-MM-DD), page, limit` | `AdminSubmission[] { submissionId, attemptNo, studentId, studentCode, studentName, taskId, taskTitle, materialTitle, evaluationStatus, score \| null, feedbackCategory \| null, submittedAt, evaluatedAt \| null, failedAt \| null }` + `meta`; terbaru dulu [ASUMSI] | umum (layar galat + coba lagi); kosong → pesan + HAPUS FILTER | SDD 5.18 (bentuk [ASUMSI]) | **belum ada** |
| GET `admin/submissions/:id` | Admin | — | `AdminSubmission` + `errorCode \| null` [ASUMSI]; tidak dipanggil UI di A3 | — | SDD 5.18 (bentuk [ASUMSI]) | **belum ada** |
| GET `admin/submissions/:id/recording-url` | Admin | — (diminta saat tombol putar ditekan) | `{ url, expiresInSeconds }` [ASUMSI]; URL berlaku 5 menit (SDD 3.17.4) | pesan galat di bawah tombol; URL kedaluwarsa → minta ulang sekali | SDD 5.18, 3.17.4, NFR-PRIV-02 | **belum ada** |
| POST `admin/submissions/:id/retry` | Admin | tanpa body | 202 `{ submissionId, evaluationStatus: SUBMITTED, attemptNo, jobId, isRetry }` (contoh SDD 5.18) | 409 `EVAL_RETRY_NOT_ALLOWED` → pesan server + muat ulang daftar | SDD 5.18, 3.11.7, BR-ML-07 | **beda** (M4) |
| GET `admin/evaluation/queue` | Admin | — | `{ counts: { SUBMITTED, PROCESSING, EVALUATED, FAILED }, oldestWaitingSince \| null }`; EVALUATED/FAILED 24 jam terakhir [ASUMSI] | galat panel terpisah dari tabel | SDD 5.18 (bentuk [ASUMSI]), UI-ADMIN-MONITOR-02 | **beda** (M5) |
| GET `admin/evaluation/health` | Admin | — | `{ serviceStatus, modelVersion \| null, modelLoaded, checkedAt }` [ASUMSI]; status dipetakan AS16 | galat bagian layanan terpisah | SDD 5.18, NFR-AVAIL-02 (bentuk [ASUMSI]) | **belum ada** (M6) |
| GET `admin/tasks?type=IMITATION` | Admin | query `type` | `TaskOption[] { id, title, type, materialTitle, status }` tanpa pagination [ASUMSI]; filter tugas (akan dipakai lagi di A6) | gagal → filter tugas tidak tersedia, daftar tetap tampil | SDD 5.17 (bentuk [ASUMSI]) | **belum ada** (M7) |

- **M4:** route ada (`evaluation.controller.ts`, `@Roles(ADMIN)`), tetapi berbeda:
  - respons `{ submissionId, jobId, status: SUBMITTED }`: tanpa `attemptNo` dan `isRetry`, dan memakai `status`, bukan `evaluationStatus`;
  - status 201 (bawaan NestJS POST), bukan 202;
  - galat 409 dikirim sebagai `ConflictException('EVAL_RETRY_NOT_ALLOWED')`: kode ada di `message`, bukan `errorCode`, sehingga frontend menampilkan pesan umum 409 (lihat 1.8). Penanganan "muat ulang setelah 409" tetap berjalan karena berdasarkan status.
  - Perilaku sudah sesuai SDD 3.11.7: hanya FAILED, membuat job baru `isRetry`, tidak membuat percobaan baru, dan dicatat di audit_logs.
- **M5:** route ada (`@Roles(ADMIN)`) dengan respons `{ jobs: [...], counts }`, tetapi `counts` dikelompokkan per **status job** (`QUEUED`, `RUNNING`, `DONE`, `FAILED`), bukan per status evaluasi submission seperti yang diminta UI-ADMIN-MONITOR-02. Tidak ada batas 24 jam dan tidak ada `oldestWaitingSince`. Respons juga memuat seluruh job aktif/gagal beserta id santri, yang tidak dipakai frontend.
- **M6:** tidak ada route `admin/evaluation/health`. Padanan terdekat: `GET monitoring` (`{ status: ok \| degraded, services { api, ml }, checkedAt }`), `GET evaluation` (`{ status: 'ready', evaluator }`, galat bila ML mati), dan `GET ml-client/health`. Tidak ada yang mengirim `modelVersion`.
- **M7:** tidak ada route `admin/tasks`; `task.controller.ts` hanya stub `GET task` 501. Daftar tugas QUIZ ada di `GET quiz/tasks` (lihat Q1), tetapi tidak untuk tugas IMITATION.
- `GET admin/submissions`, `/:id`, dan `/:id/recording-url` belum ada sama sekali.

**Ringkasan status (27 endpoint yang dipanggil frontend):** sesuai 0 · beda 12 · belum ada 15 · tidak dapat dipastikan 0. Ditambah 2 endpoint admin di 2.11 (A1) dan 8 di 2.12 (A2): semuanya belum ada. Ditambah 7 endpoint di 2.13 (A3): 2 beda (retry, queue) dan 5 belum ada. Ada satu detail yang tidak dapat dipastikan di dalam baris "beda": serialisasi `score`, lihat I3.

---

## 3. Daftar [ASUMSI] kontrak

| # | Asumsi | Alasan | Dipakai di |
| --- | --- | --- | --- |
| AS1 | `GET auth/me` = ringkasan login (`AuthUser`) + `email`. | SDD 5.6 hanya menyebut "identitas pengguna beserta perannya". | `src/features/auth/types.ts`, `src/lib/hooks/useAuth.ts` |
| AS2 | Parameter tautan reset bernama `?token=`. | SDD tidak menyebut format tautan email. | `src/features/auth/ResetPasswordPage.tsx` |
| AS3 | Teks cadangan "Password berhasil diubah. Silakan masuk." bila reset tidak mengirim `message`. | Respons sukses reset tidak dicontohkan SDD. | `src/features/auth/ResetPasswordPage.tsx` |
| AS4 | Respons `PATCH profile` berisi profil terbaru. | SDD 5.7 tidak merinci respons. | `src/features/profile/api.ts`, `ProfilePage.tsx` |
| AS5 | Body `PATCH profile/password` = `{ currentPassword, password, passwordConfirmation }`. | SDD 5.7 tidak merinci body. | `src/features/profile/types.ts` |
| AS6 | Enum status tugas di detail materi `AVAILABLE \| COMPLETED \| LOCKED`. | SDD 5.8 hanya mencontohkan `AVAILABLE`. | `src/features/learning/types.ts` |
| AS7 | `stageUnlocked` = `{ id, code, title } \| null`. | SDD 5.8 hanya menyebut "ringkasan tahapan yang baru terbuka". | `src/features/learning/types.ts`, `MaterialDetailPage.tsx` |
| AS8 | `GET learning/continue` = `{ materialId, materialTitle, stageTitle } \| null` (null bila semua selesai). | SDD 5.8 hanya menjelaskan aturannya, tanpa contoh respons. | `src/features/learning/types.ts` |
| AS9 | `GET quiz/attempts/:id` = data submit tanpa `progress` + `taskId`, `submittedAt`, dan snapshot `questions[]` (prompt + options, tanpa audio dan kunci). Kontrak baru. | SDD 5.9 hanya menyebut "rincian jawaban, diambil dari snapshot". Layar detail butuh teks soal dan opsi. | `src/features/quiz/types.ts`, `src/features/progress/AttemptDetailPage.tsx` |
| AS10 | `activeSubmission` berbentuk status submission pending **ditambah `polling`** seperti respons 202. Kontrak baru. | Jadwal polling hanya ada di respons 202. Saat halaman dibuka ulang, frontend tetap butuh jadwal dari backend (tanpa angka di kode). | `src/features/imitation/types.ts`, `hooks.ts`, `ImitationTaskPage.tsx` |
| AS11 | Butir `GET imitation/tasks/:taskId/submissions` = `{ submissionId, attemptNo, evaluationStatus, score, feedbackCategory, submittedAt }`. | SDD 5.10 tidak merinci bentuk butir. | `src/features/imitation/types.ts` (belum dipakai halaman) |
| AS12 | `averageScore`/`bestScore` bernilai `null` bila belum ada hasil valid. | SDD 5.12 hanya mencontohkan angka. | `src/features/statistics/types.ts`, `StatisticsPage.tsx` |
| AS13 | `attemptId` di riwayat = `submissionId` untuk percobaan Dengar-Tirukan, sehingga detailnya dibuka dengan `GET imitation/submissions/:attemptId`. | Contoh SDD 5.10/5.11 memakai id yang sama (`at88…`), tetapi tidak dinyatakan eksplisit. | `src/features/progress/view.ts`, `AttemptDetailPage.tsx` |
| AS14 | Kode galat `AUTH_RESET_INVALID` untuk token reset tidak berlaku. | SDD 5.6 tidak mencantumkan kode galat reset. | `src/features/auth/ResetPasswordPage.tsx` |
| AS15 | Percobaan Dengar-Pilih ikut dihitung sebagai hasil valid di `GET statistics` (rata-rata, terbaik, jumlah) dan `GET statistics/chart` (titik grafik). | Keputusan proyek; SDD 3.14.2 tidak tegas (lihat T7). Backend-noval saat ini hanya menghitung IMITATION. | `src/features/statistics/types.ts`, `src/lib/api/mock/db.ts` |
| AS16 | Pemetaan `evaluation.serviceStatus`: `ok` → "Berjalan normal", `loading` → "Sedang memuat model", nilai lain atau kosong → "Terganggu". | SDD 5.18 hanya mencontohkan `"ok"`; health ML (SDD 8.11.3) mengenal `ok` dan `loading`. Backend-noval memakai `degraded` di `GET monitoring`. | `src/features/admin/dashboard/types.ts`, `view.ts` |
| AS17 | Dashboard admin: `averageScore` bernilai `null` bila belum ada hasil valid; kode alasan di luar tiga kriteria SDD 3.17.3 tetap tampil sebagai "Perlu diperhatikan". | SDD 5.18 hanya mencontohkan angka dan tiga kode alasan. | `src/features/admin/dashboard/types.ts`, `view.ts` |
| AS18 | Bentuk `GET admin/students/:id`: profil (termasuk `joinedAt` dan `lastActivityAt`), `currentStage { id, title }`, dan `progress` berbentuk sama dengan `GET /progress`. | SDD 5.14 tidak merinci isi detail santri. Tanggal bergabung dan aktivitas terakhir ditampilkan atas keputusan proyek (SRS UI-ADMIN-STUDENT-03 tidak merinci isi profil). | `src/features/admin/students/types.ts`, `StudentDetailPage.tsx` |
| AS19 | `GET admin/students/:id/statistics` dan `/chart` berbentuk sama dengan `GET statistics` dan `GET statistics/chart` sisi Santri. | SDD 5.14 hanya mencantumkan path. Komponen statistik dan grafik santri dipakai ulang. | `src/features/admin/students/api.ts`, `src/features/statistics/StatisticsView.tsx` |
| AS20 | Endpoint baru `GET admin/students/:id/history?page=&limit=`, bentuk sama dengan `GET progress/history` termasuk `meta`. | SRS FR-STUDENT-06/FR-MONITOR-04 meminta riwayat tugas santri, tetapi SDD 5.14 tidak menyediakan endpoint-nya. | `src/features/admin/students/api.ts`, `StudentDetailPage.tsx` |
| AS21 | `PATCH admin/students/:id/status`: `reason` maksimal 255 karakter; respons tidak dibaca frontend. | SDD 5.14 hanya menyebut alasan bersifat opsional dan dicatat di audit_logs. | `src/features/admin/students/types.ts`, `StudentStatusDialog.tsx` |
| AS22 | Bentuk minimal `GET admin/stages`: `[{ id, code, title, orderIndex, status }]` tanpa pagination. | SDD 5.15 tidak merinci respons daftar tahapan. | `src/features/admin/students/types.ts`, `StudentFilters.tsx` |
| AS23 | Butir daftar santri: `averageScore` bernilai `null` bila belum ada hasil valid; `currentStage` berupa judul tahapan (string) atau `null`. Filter rentang nilai tidak memuat santri tanpa nilai. | Contoh SDD 5.14 hanya memuat angka dan judul. | `src/features/admin/students/types.ts`, `StudentListPage.tsx` |
| AS24 | Daftar "perlu diperhatikan" (`GET admin/dashboard/attention`) hanya memuat santri berstatus ACTIVE. | SDD 3.17.3 tidak mengatur akun nonaktif. | `src/lib/api/mock/handlers/admin.ts` (diharapkan sama di backend) |
| AS25 | Butir `GET admin/submissions` mengikuti bentuk status submission/riwayat sisi Santri (lihat 2.13); urutan terbaru dulu; `from`/`to` berupa tanggal `YYYY-MM-DD` dan inklusif per hari. | SDD 5.18 hanya mencantumkan parameter, tanpa bentuk respons maupun format tanggal. | `src/features/admin/monitoring/types.ts`, `query.ts` |
| AS26 | `GET admin/submissions/:id` = butir daftar + `errorCode` (kode teknis kegagalan boleh dilihat Admin; UI-IMITATE-03 hanya membatasi Santri). | SDD 5.18 tidak merinci respons detail. | `src/features/admin/monitoring/types.ts` |
| AS27 | `GET admin/submissions/:id/recording-url` = `{ url, expiresInSeconds }`. | SDD 3.17.4 menetapkan presigned URL 5 menit, tanpa bentuk respons. | `src/features/admin/monitoring/types.ts`, `RecordingPlayer.tsx` |
| AS28 | `GET admin/evaluation/queue` = `{ counts: { SUBMITTED, PROCESSING, EVALUATED, FAILED }, oldestWaitingSince }`; EVALUATED dan FAILED dihitung 24 jam terakhir. | UI-ADMIN-MONITOR-02 meminta tampilan per status evaluasi; SDD 5.18 tidak merinci respons. Berbeda dengan `getQueue()` backend yang menghitung per status job (M5). | `src/features/admin/monitoring/types.ts`, `EvaluationPanel.tsx` |
| AS29 | `GET admin/evaluation/health` = `{ serviceStatus, modelVersion, modelLoaded, checkedAt }`, dengan `serviceStatus` dipetakan seperti AS16. | SDD 5.18 hanya mencantumkan path; health ML (SDD 8.11.3) mengenal `ok` dan `loading`. | `src/features/admin/monitoring/types.ts`, `EvaluationPanel.tsx` |
| AS30 | Bentuk minimal `GET admin/tasks` = `[{ id, title, type, materialTitle, status }]` tanpa pagination, dengan query `type` untuk menyaring jenis tugas. | SDD 5.17 tidak merinci respons maupun parameter. | `src/features/admin/monitoring/types.ts`, `MonitoringFilters.tsx` |
| AS31 | Kalimat 409 `EVAL_RETRY_NOT_ALLOWED`: "Evaluasi ulang hanya dapat diminta untuk submission yang gagal diproses." | SDD 5.18 hanya menyebut kode galatnya; frontend menampilkan `message` server apa adanya. | `src/lib/api/mock/handlers/monitoring.ts` (diharapkan dari backend) |
| AS32 | Akun yang dinonaktifkan saat sesinya aktif menerima 403 `AUTH_ACCOUNT_INACTIVE` di request terautentikasi berikutnya, dan frontend mengakhiri sesi. | SDD 3.16.5 hanya membatalkan refresh token; access token yang masih berlaku tidak ditarik (SDD 5.6), sehingga backend perlu menolaknya dengan kode ini agar sesi berakhir seketika. | `src/lib/api/client.ts`, `src/app/providers.tsx`, mock `router.ts` |

Asumsi yang hanya ada di mock (`src/lib/api/mock/`) tidak membentuk kontrak dan tidak dicantumkan, kecuali AS15 yang sudah menjadi keputusan. Contohnya: waktu tiruan evaluasi, rumus `pct` per tahapan, label riwayat SUBMITTED/PROCESSING, dan cara menghitung tren.

---

## 4. Ketergantungan di luar API

### 4.1 Tautan reset password di email
- Backend harus mengirim tautan berbentuk `<origin-frontend>/reset-password?token=<token>` (AS2).
- Halaman membaca `token` dari query dan mengirimnya di body `POST auth/reset-password`.
- `/reset-password` tetap bisa dibuka walau pengguna sedang masuk; halaman itu dikecualikan dari pengalihan pengguna yang sudah login.
- Kondisi backend-noval: endpoint dan pengiriman email belum ada (A3).

### 4.2 Route frontend (sitemap SDD 12.5, `src/app/router.tsx`)

| Route | Halaman | Akses |
| --- | --- | --- |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Autentikasi | publik |
| `/` | Dashboard | Santri |
| `/belajar`, `/belajar/:stageId`, `/materi/:materialId` | Daftar tahapan, daftar materi, detail materi | Santri |
| `/tugas/:taskId/pilih`, `/tugas/:taskId/tirukan` | Dengar-Pilih, Dengar-Tirukan (layar penuh) | Santri |
| `/progress`, `/riwayat`, `/statistik`, `/profil` | Progress, Riwayat, Statistik, Profil | Santri |
| `/riwayat/:attemptId` (`?jenis=tirukan` untuk Dengar-Tirukan) | Detail percobaan | Santri; **penyimpangan sitemap yang disetujui, [TBD]** |
| `/tugas` | Placeholder menu Tugas | Santri; **penyimpangan sitemap yang disetujui, [TBD]** |
| `/admin` | Placeholder Admin | Admin; halaman `/admin/*` lain belum dibangun |

Id di route diteruskan apa adanya ke path API (`encodeURIComponent`). Backend-noval mewajibkan UUID (`ParseUUIDPipe`).

---

## 5. Temuan (dicatat, tidak diperbaiki)

| # | Temuan | Lokasi |
| --- | --- | --- |
| T1 | Penyimpanan token di `sessionStorage` dan tidak adanya pemanggilan `POST auth/refresh` menyimpang dari SDD 6.3/5.6. Sudah ditandai `TODO(SDD 6.3)`. **Keputusan: penyimpangan sementara yang disetujui sampai backend menyediakan refresh token** (tercatat di CLAUDE.md). | `src/lib/auth/tokenStore.ts` |
| T2 | AS13 dan AS14 belum diberi label `[ASUMSI]` di kode, padahal CLAUDE.md mewajibkannya. **Diperbaiki:** label `[ASUMSI]` sudah ditambahkan. | `src/features/progress/view.ts`, `src/features/auth/ResetPasswordPage.tsx` |
| T3 | Rekaman diunggah dalam format asli tanpa keadaan CONVERTING. Ini menyimpang dari SDD 7.6.2 dan DD-03 ("konversi audio ke WAV di sisi klien", SDD 12.6), sesuai keputusan final berbasis SRS FR-IMITATE-06. Contoh galat SDD 5.5 ("Hanya berkas WAV yang diterima", field `recording`) juga masih mengacu WAV. Penyimpangan ini disetujui, tetapi di kode belum ada komentar yang menyebut DD-03. | `src/features/imitation/recorder.ts`, `ImitationTaskPage.tsx` |
| T4 | Pesan "tidak mendukung perekaman" mengikuti SDD 7.9 ("Chrome, Edge, atau Firefox"). SRS revisi 2 menambahkan Safari sebagai target browser (NFR-COMP-01). Kalimat SDD belum mengikuti SRS. **Keputusan:** pesan menjadi "Perangkat atau browser Anda tidak mendukung perekaman suara. Coba gunakan Chrome, Edge, Firefox, atau Safari versi terbaru." (SRS berlaku atas SDD); penyimpangan dari SDD 7.9 diberi komentar di kode. | `src/features/imitation/ImitationTaskPage.tsx` |
| T5 | Nama berkas cadangan laporan memakai tanggal UTC (`toISOString`), bukan tanggal lokal. Sebelum pukul 07.00 WIB tanggalnya mundur sehari dibanding pola SDD 5.13. **Diperbaiki:** memakai tanggal lokal perangkat (`formatDateStamp`, `src/lib/utils/format.ts`), dengan test. | `src/features/profile/ProfilePage.tsx` |
| T6 | `requestId` respons (SDD 5.5) dan `X-Request-Id` (SDD 5.4) tidak dibaca atau disimpan di `ApiError`, sehingga keluhan pengguna tidak bisa ditelusuri ke log dari sisi frontend. | `src/lib/api/responseFormat.ts`, `ApiError.ts` |
| T7 | Percobaan Dengar-Pilih dihitung sebagai hasil valid untuk statistik dan grafik. Rumus SDD 3.14.2 mensyaratkan `evaluation_status = 'EVALUATED'`, padahal percobaan Dengar-Pilih di SDD 5.11 ber-`evaluationStatus: null`, sehingga SDD tidak tegas. Backend-noval hanya menghitung IMITATION. **Keputusan: dihitung; perlu diperjelas di SDD dan disepakati dengan backend** (AS15). | `src/lib/api/mock/db.ts`, `src/features/statistics/types.ts` |
| T8 | Halaman Profil dan Riwayat tidak memakai `joinedAt` dan `GET imitation/tasks/:taskId/submissions`, walau keduanya ada di `api.ts`/`types.ts`. Tidak salah, hanya kontrak yang belum dipakai UI. | `src/features/profile/types.ts`, `src/features/imitation/api.ts` |
| T9 | SDD 5.21 membedakan 400 (tidak dapat diurai) dan 422 (validasi). Frontend menangani galat audio dengan 413/422 + kode, dan memetakan 400 ke pesan umum. Backend-noval mengirim semua galat validasi sebagai 400 tanpa kode, sehingga pembedaan di frontend tidak pernah terpicu (lihat 1.8). | `src/features/imitation/ImitationTaskPage.tsx`, `src/lib/api/ApiError.ts` |
| T10 | SRS FR-DASH-A-01 meminta kartu "jumlah tugas yang dikerjakan", tetapi API SDD 5.18 hanya menyediakan `attemptsTotal` (jumlah percobaan). **Keputusan:** kartu berlabel "PERCOBAAN TUGAS" dengan nilai `attemptsTotal`, diberi komentar [TBD]; perlu diselaraskan di SDD/API. | `src/features/admin/dashboard/AdminDashboardPage.tsx` |
| T11 | Backend-noval menolak akun nonaktif dengan `ForbiddenException('Account is inactive')` (403 tanpa `errorCode`) di banyak service. Tanpa kode `AUTH_ACCOUNT_INACTIVE`, frontend tidak mengakhiri sesi dan hanya menampilkan pesan umum 403 (AS32). | `src/lib/api/client.ts` |
| T12 | Rail kanan 300 px (SDD 7.5.1, "bila diperlukan") tidak dipakai di Monitoring: tabel 8 kolom hanya tersisa ±780 px di 1440 dan ±360 px di 1024. Panel status ditaruh di atas tabel selebar penuh. Di lebar 768–1023 px tabel admin tetap dapat digulir mendatar, sesuai SDD 7.5.1 untuk layar administrasi. | `src/features/admin/monitoring/MonitoringPage.tsx` |
