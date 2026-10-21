/**
 * seed-curriculum-tasks.ts
 *
 * Mengisi Micro-Quiz (Dengar-Pilih) untuk SETIAP materi (Langkah 1 - 10)
 * dan Ujian Langkah (Dengar-Tirukan / IMITATION) pada materi terakhir tiap Langkah.
 *
 * Mengimpor audio dari ml-service/dataset/REKAMAN BRIN ke backend/uploads/references/.
 */

import { PrismaClient, ContentStatus, TaskType, AudioType, AudioStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface OptionDef {
  arabic: string;
  latin: string;
  isCorrect: boolean;
}

interface QuestionDef {
  prompt: string;
  audioFilename?: string;
  options: OptionDef[];
}

interface QuizDef {
  title: string;
  questions: QuestionDef[];
}

// ── 1. Bank Soal Kuis per Langkah & Materi ─────────────────────────────────────

const STAGE_QUIZ_TEMPLATES: Record<number, Record<number, QuizDef>> = {
  // ── LANGKAH 1: Pengenalan Huruf & Harakat Fathah, Kasrah, Dhammah ────────────
  1: {
    1: {
      title: 'Kuis Kilat: Huruf Ba, Ma, Fa',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m001c001.mp3',
          options: [
            { arabic: 'بَ', latin: 'Ba', isCorrect: true },
            { arabic: 'مَ', latin: 'Ma', isCorrect: false },
            { arabic: 'فَ', latin: 'Fa', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah yang terdengar?',
          audioFilename: 'l001m001c002.mp3',
          options: [
            { arabic: 'مَ', latin: 'Ma', isCorrect: true },
            { arabic: 'بَ', latin: 'Ba', isCorrect: false },
            { arabic: 'فَ', latin: 'Fa', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Pilihlah huruf yang sesuai dengan audio:',
          audioFilename: 'l001m001c003.mp3',
          options: [
            { arabic: 'فَ', latin: 'Fa', isCorrect: true },
            { arabic: 'مَ', latin: 'Ma', isCorrect: false },
            { arabic: 'بَ', latin: 'Ba', isCorrect: false },
          ],
        },
      ],
    },
    2: {
      title: 'Kuis Kilat: Huruf Dza, Tsa, Zha, Da',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m002c001.mp3',
          options: [
            { arabic: 'ذَ', latin: 'Dza', isCorrect: true },
            { arabic: 'دَ', latin: 'Da', isCorrect: false },
            { arabic: 'ثَ', latin: 'Tsa', isCorrect: false },
            { arabic: 'ظَ', latin: 'Zha', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Pilihlah huruf yang diucapkan:',
          audioFilename: 'l001m002c002.mp3',
          options: [
            { arabic: 'ثَ', latin: 'Tsa', isCorrect: true },
            { arabic: 'ذَ', latin: 'Dza', isCorrect: false },
            { arabic: 'ظَ', latin: 'Zha', isCorrect: false },
            { arabic: 'دَ', latin: 'Da', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah ini?',
          audioFilename: 'l001m002c003.mp3',
          options: [
            { arabic: 'ظَ', latin: 'Zha', isCorrect: true },
            { arabic: 'دَ', latin: 'Da', isCorrect: false },
            { arabic: 'ذَ', latin: 'Dza', isCorrect: false },
            { arabic: 'ثَ', latin: 'Tsa', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Pilihlah huruf yang sesuai:',
          audioFilename: 'l001m002c004.mp3',
          options: [
            { arabic: 'دَ', latin: 'Da', isCorrect: true },
            { arabic: 'ذَ', latin: 'Dza', isCorrect: false },
            { arabic: 'ثَ', latin: 'Tsa', isCorrect: false },
            { arabic: 'ظَ', latin: 'Zha', isCorrect: false },
          ],
        },
      ],
    },
    3: {
      title: 'Kuis Kilat: Huruf Dha, Ta, Tha',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m003c001.mp3',
          options: [
            { arabic: 'ضَ', latin: 'Dha', isCorrect: true },
            { arabic: 'تَ', latin: 'Ta', isCorrect: false },
            { arabic: 'طَ', latin: 'Tha', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah yang terdengar?',
          audioFilename: 'l001m003c003.mp3',
          options: [
            { arabic: 'طَ', latin: 'Tha', isCorrect: true },
            { arabic: 'تَ', latin: 'Ta', isCorrect: false },
            { arabic: 'ضَ', latin: 'Dha', isCorrect: false },
          ],
        },
      ],
    },
    4: {
      title: 'Kuis Kilat: Huruf La, Na, Ra',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m004c001.mp3',
          options: [
            { arabic: 'لَ', latin: 'La', isCorrect: true },
            { arabic: 'نَ', latin: 'Na', isCorrect: false },
            { arabic: 'رَ', latin: 'Ra', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah yang terdengar?',
          audioFilename: 'l001m004c003.mp3',
          options: [
            { arabic: 'رَ', latin: 'Ra', isCorrect: true },
            { arabic: 'لَ', latin: 'La', isCorrect: false },
            { arabic: 'نَ', latin: 'Na', isCorrect: false },
          ],
        },
      ],
    },
    5: {
      title: 'Kuis Kilat: Huruf Za, Sa, Sha',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m005c001.mp3',
          options: [
            { arabic: 'زَ', latin: 'Za', isCorrect: true },
            { arabic: 'سَ', latin: 'Sa', isCorrect: false },
            { arabic: 'صَ', latin: 'Sha', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah ini?',
          audioFilename: 'l001m005c003.mp3',
          options: [
            { arabic: 'صَ', latin: 'Sha', isCorrect: true },
            { arabic: 'سَ', latin: 'Sa', isCorrect: false },
            { arabic: 'زَ', latin: 'Za', isCorrect: false },
          ],
        },
      ],
    },
    6: {
      title: 'Kuis Kilat: Huruf Sya, Ja, Ka, Qa',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m006c001.mp3',
          options: [
            { arabic: 'شَ', latin: 'Sya', isCorrect: true },
            { arabic: 'جَ', latin: 'Ja', isCorrect: false },
            { arabic: 'كَ', latin: 'Ka', isCorrect: false },
            { arabic: 'قَ', latin: 'Qa', isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Pilihlah huruf yang sesuai:',
          audioFilename: 'l001m006c004.mp3',
          options: [
            { arabic: 'قَ', latin: 'Qa', isCorrect: true },
            { arabic: 'كَ', latin: 'Ka', isCorrect: false },
            { arabic: 'جَ', latin: 'Ja', isCorrect: false },
            { arabic: 'شَ', latin: 'Sya', isCorrect: false },
          ],
        },
      ],
    },
    7: {
      title: 'Kuis Kilat: Huruf Gha, Kha, \'Ain',
      questions: [
        {
          prompt: 'Dengarkan suara berikut! Manakah huruf yang diucapkan?',
          audioFilename: 'l001m007c001.mp3',
          options: [
            { arabic: 'غَ', latin: 'Gha', isCorrect: true },
            { arabic: 'خَ', latin: 'Kha', isCorrect: false },
            { arabic: 'عَ', latin: "'Ain", isCorrect: false },
          ],
        },
        {
          prompt: 'Dengarkan suara berikut! Huruf apakah ini?',
          audioFilename: 'l001m007c003.mp3',
          options: [
            { arabic: 'عَ', latin: "'Ain", isCorrect: true },
            { arabic: 'غَ', latin: 'Gha', isCorrect: false },
            { arabic: 'خَ', latin: 'Kha', isCorrect: false },
          ],
        },
      ],
    },
    8: {
      title: 'Kuis Kilat: Huruf Ha, Haa, Hamzah',
      questions: [
        {
          prompt: 'Manakah huruf yang berbunyi "Ha" halus (حَ)?',
          options: [
            { arabic: 'حَ', latin: 'Ha', isCorrect: true },
            { arabic: 'هَ', latin: 'Haa (tebal)', isCorrect: false },
            { arabic: 'ءَ', latin: 'Hamzah', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah ini: هَ ?',
          options: [
            { arabic: 'هَ', latin: 'Haa', isCorrect: true },
            { arabic: 'حَ', latin: 'Ha', isCorrect: false },
            { arabic: 'ءَ', latin: 'Hamzah', isCorrect: false },
          ],
        },
      ],
    },
    9: {
      title: 'Kuis Kilat: Huruf Wa, Ya',
      questions: [
        {
          prompt: 'Manakah huruf yang berbunyi "Wa" (وَ)?',
          options: [
            { arabic: 'وَ', latin: 'Wa', isCorrect: true },
            { arabic: 'يَ', latin: 'Ya', isCorrect: false },
            { arabic: 'رَ', latin: 'Ra', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah ini: يَ ?',
          options: [
            { arabic: 'يَ', latin: 'Ya', isCorrect: true },
            { arabic: 'وَ', latin: 'Wa', isCorrect: false },
            { arabic: 'بَ', latin: 'Ba', isCorrect: false },
          ],
        },
      ],
    },
    10: {
      title: 'Kuis Kilat: Tiga Harakat (Fathah, Kasrah, Dhammah)',
      questions: [
        {
          prompt: 'Manakah urutan bacaan "Ba - Bi - Bu"?',
          options: [
            { arabic: 'بَ بِ بُ', latin: 'Ba - Bi - Bu', isCorrect: true },
            { arabic: 'بُ بِ بَ', latin: 'Bu - Bi - Ba', isCorrect: false },
            { arabic: 'بِ بَ بُ', latin: 'Bi - Ba - Bu', isCorrect: false },
          ],
        },
        {
          prompt: 'Harakat apakah yang berbunyi "u" pada huruf مُ ?',
          options: [
            { arabic: 'مُ', latin: 'Ḍammah (u)', isCorrect: true },
            { arabic: 'مِ', latin: 'Kasrah (i)', isCorrect: false },
            { arabic: 'مَ', latin: 'Fathah (a)', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 2: Membaca & Membandingkan Huruf Terputus + Sukun ─────────────────
  2: {
    4: {
      title: 'Kuis Kilat: Perbedaan Ka (ك) vs Qa (ق)',
      questions: [
        {
          prompt: 'Manakah huruf "Ka" yang berbunyi tipis?',
          options: [
            { arabic: 'كَ', latin: 'Ka', isCorrect: true },
            { arabic: 'قَ', latin: 'Qa', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah yang berbunyi pangkal lidah tebal: قَ ?',
          options: [
            { arabic: 'قَ', latin: 'Qa', isCorrect: true },
            { arabic: 'كَ', latin: 'Ka', isCorrect: false },
          ],
        },
      ],
    },
    6: {
      title: 'Kuis Kilat: Perbedaan Ta (ت) vs Tha (ط)',
      questions: [
        {
          prompt: 'Manakah huruf "Tha" yang memiliki sifat tebal/isti\'la?',
          options: [
            { arabic: 'طَ', latin: 'Tha', isCorrect: true },
            { arabic: 'تَ', latin: 'Ta', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah ini: تَ ?',
          options: [
            { arabic: 'تَ', latin: 'Ta', isCorrect: true },
            { arabic: 'طَ', latin: 'Tha', isCorrect: false },
          ],
        },
      ],
    },
    8: {
      title: 'Kuis Kilat: Perbedaan Sa (س) vs Sha (ص)',
      questions: [
        {
          prompt: 'Pilihlah huruf "Sha" yang tebal:',
          options: [
            { arabic: 'صَ', latin: 'Sha', isCorrect: true },
            { arabic: 'سَ', latin: 'Sa', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah ini: سَ ?',
          options: [
            { arabic: 'سَ', latin: 'Sa', isCorrect: true },
            { arabic: 'صَ', latin: 'Sha', isCorrect: false },
          ],
        },
      ],
    },
    10: {
      title: 'Kuis Kilat: Perbedaan Dza (ذ) vs Za (ز)',
      questions: [
        {
          prompt: 'Manakah huruf "Dza" (ujung lidah keluar sedikit)?',
          options: [
            { arabic: 'ذَ', latin: 'Dza', isCorrect: true },
            { arabic: 'زَ', latin: 'Za', isCorrect: false },
          ],
        },
        {
          prompt: 'Huruf apakah yang berbunyi desis tajam: زَ ?',
          options: [
            { arabic: 'زَ', latin: 'Za', isCorrect: true },
            { arabic: 'ذَ', latin: 'Dza', isCorrect: false },
          ],
        },
      ],
    },
    12: {
      title: 'Kuis Kilat: Perbedaan Ha (ح) vs Haa (ه)',
      questions: [
        {
          prompt: 'Manakah huruf "Ha" yang keluar dari tengah tenggorokan (bersih)?',
          options: [
            { arabic: 'حَ', latin: 'Ha', isCorrect: true },
            { arabic: 'هَ', latin: 'Haa (pangkal tenggorokan)', isCorrect: false },
          ],
        },
      ],
    },
    14: {
      title: 'Kuis Kilat: Perbedaan Da (د) vs Dha (ض)',
      questions: [
        {
          prompt: 'Manakah huruf "Dha" yang tebal (tepi lidah)?',
          options: [
            { arabic: 'ضَ', latin: 'Dha', isCorrect: true },
            { arabic: 'دَ', latin: 'Da', isCorrect: false },
          ],
        },
      ],
    },
    16: {
      title: 'Kuis Kilat: Perbedaan Zha (ظ) vs Za (ز)',
      questions: [
        {
          prompt: 'Pilihlah huruf "Zha" yang tebal:',
          options: [
            { arabic: 'ظَ', latin: 'Zha', isCorrect: true },
            { arabic: 'زَ', latin: 'Za', isCorrect: false },
          ],
        },
      ],
    },
    18: {
      title: 'Kuis Kilat: Perbedaan Gha (غ) vs Kha (خ)',
      questions: [
        {
          prompt: 'Manakah huruf "Kha" yang bersuara gesek tenggorokan atas?',
          options: [
            { arabic: 'خَ', latin: 'Kha', isCorrect: true },
            { arabic: 'غَ', latin: 'Gha', isCorrect: false },
          ],
        },
      ],
    },
    20: {
      title: 'Kuis Kilat: Perbedaan \'Ain (ع) vs Ha (ح)',
      questions: [
        {
          prompt: 'Manakah huruf "\'Ain" yang keluar dari tengah tenggorokan?',
          options: [
            { arabic: 'عَ', latin: "'Ain", isCorrect: true },
            { arabic: 'حَ', latin: 'Ha', isCorrect: false },
          ],
        },
      ],
    },
    21: {
      title: 'Kuis Kilat: Evaluasi Perbandingan Huruf & Sukun',
      questions: [
        {
          prompt: 'Bagaimanakah bunyi huruf ب bila diberi sukun: بْ ?',
          options: [
            { arabic: 'بْ', latin: 'Mati / Sukun (Qalqalah)', isCorrect: true },
            { arabic: 'بَ', latin: 'Fathah (Ba)', isCorrect: false },
          ],
        },
        {
          prompt: 'Pilihlah huruf yang bertanda sukun di bawah ini:',
          options: [
            { arabic: 'مْ', latin: 'Mim Sukun', isCorrect: true },
            { arabic: 'مُ', latin: 'Mim Dhammah', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 4: Alif Mamdūdah dan Alif Maqṣūrah ─────────────────────────────
  4: {
    1: {
      title: 'Kuis Kilat: Alif Mamdūdah dan Alif Maqṣūrah',
      questions: [
        {
          prompt: 'Manakah yang merupakan bentuk Alif Maqṣūrah (bentuk seperti Ya tanpa titik)?',
          options: [
            { arabic: 'ى', latin: 'Alif Maqṣūrah', isCorrect: true },
            { arabic: 'ا', latin: 'Alif Mamdūdah', isCorrect: false },
            { arabic: 'ي', latin: 'Ya bertitik', isCorrect: false },
          ],
        },
        {
          prompt: 'Pada kata هَدَى, huruf terakhir dibaca panjang sebagai:',
          options: [
            { arabic: 'هَدَى', latin: 'Alif Maqṣūrah (dibaca panjang 2 harakat)', isCorrect: true },
            { arabic: 'هَدِي', latin: 'Kasrah', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 5: Hamzah dan Tanwin ───────────────────────────────────────────
  5: {
    1: {
      title: 'Kuis Kilat: Bentuk Huruf Hamzah',
      questions: [
        {
          prompt: 'Manakah bentuk penulisan huruf Hamzah?',
          options: [
            { arabic: 'أ / ء / ئ / ؤ', latin: 'Hamzah', isCorrect: true },
            { arabic: 'ع', latin: "'Ain", isCorrect: false },
          ],
        },
      ],
    },
    2: {
      title: 'Kuis Kilat: Fathatain, Kasratain, Dammatain',
      questions: [
        {
          prompt: 'Manakah tanda harakat Fathatain (ــــًــــ)?',
          options: [
            { arabic: 'بَئِيـسًا', latin: 'Fathatain (-an)', isCorrect: true },
            { arabic: 'بَئِيـسٍ', latin: 'Kasratain (-in)', isCorrect: false },
            { arabic: 'بَئِيـسٌ', latin: 'Ḍammatain (-un)', isCorrect: false },
          ],
        },
        {
          prompt: 'Harakat apakah yang berbunyi "-un" pada kata بَئِيـسٌ ?',
          options: [
            { arabic: 'بَئِيـسٌ', latin: 'Ḍammatain', isCorrect: true },
            { arabic: 'بَئِيـسٍ', latin: 'Kasratain', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 6: Melafalkan Tasydid ──────────────────────────────────────────
  6: {
    1: {
      title: 'Kuis Kilat: Tasydid di Akhir Kata',
      questions: [
        {
          prompt: 'Kata مَدَّ sama dengan penggabungan dua huruf:',
          options: [
            { arabic: 'مَدْدَ', latin: 'Dal sukun + Dal fathah', isCorrect: true },
            { arabic: 'مَدَا', latin: 'Dal panjang', isCorrect: false },
          ],
        },
      ],
    },
    7: {
      title: 'Kuis Kilat: Tasydid dengan Madd Badal & Alif Maqshurah',
      questions: [
        {
          prompt: 'Bagaimana cara membaca kata جَلّٰى ?',
          options: [
            { arabic: 'جَلّٰى', latin: 'Lam ditekan (tasydid) lalu dibaca panjang (madd)', isCorrect: true },
            { arabic: 'جَلَى', latin: 'Dibaca pendek biasa', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 7: Madd Asli dan Madd Layyin ───────────────────────────────────
  7: {
    1: {
      title: 'Kuis Kilat: Madd Asli Alif ( ا )',
      questions: [
        {
          prompt: 'Berapa ketukan/harakat panjang bacaan Madd Asli?',
          options: [
            { arabic: 'بَـا', latin: '2 Harakat (1 alif)', isCorrect: true },
            { arabic: 'بَ', latin: '1 Harakat (pendek)', isCorrect: false },
            { arabic: 'بَــــا', latin: '6 Harakat', isCorrect: false },
          ],
        },
      ],
    },
    6: {
      title: 'Kuis Kilat: Bacaan Madd Layyin',
      questions: [
        {
          prompt: 'Madd Layyin terjadi apabila huruf Wau sukun (وْ) atau Ya sukun (يْ) didahului harakat:',
          options: [
            { arabic: 'سَوْفَ / بَيْنَ', latin: 'Fathah (ــــَــــ)', isCorrect: true },
            { arabic: 'سُوفَ', latin: 'Ḍammah (ــــُــــ)', isCorrect: false },
            { arabic: 'سِيفَ', latin: 'Kasrah (ــــِــــ)', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 8: Alif Lam Qamariyyah & Syamsiyyah ────────────────────────────
  8: {
    1: {
      title: 'Kuis Kilat: Alif Lam Qamariyyah vs Syamsiyyah',
      questions: [
        {
          prompt: 'Pada Alif Lam Qamariyyah, huruf Lam dibaca:',
          options: [
            { arabic: 'اَلْـقَمَرُ', latin: 'Jelas / Iẓhār', isCorrect: true },
            { arabic: 'اَلشَّمْسُ', latin: 'Melebur / Idġām', isCorrect: false },
          ],
        },
        {
          prompt: 'Pada Alif Lam Syamsiyyah, huruf setelah Lam selalu bertanda:',
          options: [
            { arabic: 'اَلشَّمْسُ', latin: 'Tasydīd ( ﹽ )', isCorrect: true },
            { arabic: 'اَلْـحَمْدُ', latin: 'Sukun ( ْ )', isCorrect: false },
          ],
        },
      ],
    },
    2: {
      title: 'Kuis Kilat: Latihan Alif Lam Qamariyyah & Syamsiyyah',
      questions: [
        {
          prompt: 'Manakah contoh bacaan Alif Lam Syamsiyyah?',
          options: [
            { arabic: 'اَلسَّبِيْلُ', latin: 'As-Sabiil (Syamsiyyah)', isCorrect: true },
            { arabic: 'اَلْأَبْـرَارُ', latin: 'Al-Abraar (Qamariyyah)', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 9: Tarqiq dan Tafhim ───────────────────────────────────────────
  9: {
    1: {
      title: 'Kuis Kilat: Kaidah Tarqiq dan Tafhim',
      questions: [
        {
          prompt: 'Lafazh Allah (اللّٰهِ) dibaca Tarqīq (tipis) apabila didahului harakat:',
          options: [
            { arabic: 'بِسْمِ اللّٰهِ', latin: 'Kasrah (i)', isCorrect: true },
            { arabic: 'نَصْرُ اللّٰهِ', latin: 'Ḍammah (u)', isCorrect: false },
            { arabic: 'شَهِدَ اللّٰهُ', latin: 'Fathah (a)', isCorrect: false },
          ],
        },
        {
          prompt: 'Lafazh Allah (اللّٰهُ) dibaca Tafhīm (tebal) apabila didahului harakat:',
          options: [
            { arabic: 'قَالَ اللّٰهُ', latin: 'Fathah atau Ḍammah', isCorrect: true },
            { arabic: 'فِي دِينِ اللّٰهِ', latin: 'Kasrah', isCorrect: false },
          ],
        },
      ],
    },
    2: {
      title: 'Kuis Kilat: Latihan Ayat Tarqiq & Tafhim',
      questions: [
        {
          prompt: 'Pada kalimat بِسْمِ اللّٰهِ , lafazh jalalah dibaca secara:',
          options: [
            { arabic: 'بِسْمِ اللّٰهِ', latin: 'Tarqīq (tipis: Bismillaah)', isCorrect: true },
            { arabic: 'قُلْ هُوَ اللّٰهُ', latin: 'Tafhīm (tebal: Bismillāh)', isCorrect: false },
          ],
        },
      ],
    },
  },

  // ── LANGKAH 10: Hamzah Washal & Evaluasi Akhir ─────────────────────────────
  10: {
    1: {
      title: 'Kuis Kilat: Hamzah Washal',
      questions: [
        {
          prompt: 'Huruf Alif Washal (ا) di tengah kalimat dibaca:',
          options: [
            { arabic: 'وَارْزُقْ', latin: 'Langsung bersambung (alif tidak dibaca)', isCorrect: true },
            { arabic: 'وَ اَرْزُقْ', latin: 'Dibaca terputus', isCorrect: false },
          ],
        },
      ],
    },
    2: {
      title: 'Kuis Kilat: Tanwin Bertemu Washal',
      questions: [
        {
          prompt: 'Pada kata نُوحٌنِ ابْنَهُ , tanwin dibaca dengan tambahan bunyi:',
          options: [
            { arabic: 'نُوحٌنِ ابْنَهُ', latin: 'Bunyi "ni" kasrah', isCorrect: true },
            { arabic: 'نُوحُنْ بْنَهُ', latin: 'Tanpa perubahan', isCorrect: false },
          ],
        },
      ],
    },
  },
};

// ── 2. Helper Generator Soal Otomatis Berdasarkan Huruf Materi ─────────────────

function generateFallbackQuiz(stageOrder: number, materialOrder: number, materialTitle: string, lines: string[]): QuizDef {
  // Ekstrak huruf Arab yang muncul di baris-baris tabel
  const letters: string[] = [];
  for (const line of lines) {
    if (line.includes('|')) {
      const parts = line.split('|').map((s) => s.replace(/<[^>]+>/g, '').trim()).filter((s) => s.length > 0 && s !== '-');
      for (const p of parts) {
        if (!letters.includes(p) && p.length <= 15) {
          letters.push(p);
        }
      }
    }
  }

  if (letters.length >= 3) {
    const q1Correct = letters[0];
    const q1Distractors = letters.slice(1, 4);
    const q2Correct = letters[1] ?? letters[0];
    const q2Distractors = [letters[0], ...letters.slice(2, 4)];

    return {
      title: `Kuis Pemahaman: Langkah ${stageOrder} Materi ${materialOrder}`,
      questions: [
        {
          prompt: `Pilihlah huruf/kata yang sama dengan bacaan berikut: ${q1Correct}`,
          options: [
            { arabic: q1Correct, latin: '', isCorrect: true },
            ...q1Distractors.map((d) => ({ arabic: d, latin: '', isCorrect: false })),
          ],
        },
        {
          prompt: `Perhatikan bacaan berikut: ${q2Correct}. Manakah huruf/kata yang sesuai?`,
          options: [
            { arabic: q2Correct, latin: '', isCorrect: true },
            ...q2Distractors.map((d) => ({ arabic: d, latin: '', isCorrect: false })),
          ],
        },
      ],
    };
  }

  return {
    title: `Kuis Pemahaman: Langkah ${stageOrder} Materi ${materialOrder}`,
    questions: [
      {
        prompt: `Perhatikan materi Langkah ${stageOrder} Materi ${materialOrder}. Apakah bacaan sudah dipahami dengan baik?`,
        options: [
          { arabic: 'نَعَمْ', latin: 'Ya, sudah paham', isCorrect: true },
          { arabic: 'لاَ', latin: 'Perlu latihan lagi', isCorrect: false },
        ],
      },
    ],
  };
}

// ── 3. Salin & Daftarkan Audio BRIN ─────────────────────────────────────────────

async function copyAndRegisterAudio(prisma: PrismaClient): Promise<Map<string, string>> {
  const audioMap = new Map<string, string>(); // filename -> audioAsset.id
  const candidateDirs = [
    path.resolve(__dirname, '../../../ml-service/dataset/REKAMAN BRIN'),
    path.resolve(process.cwd(), '../ml-service/dataset/REKAMAN BRIN'),
    path.resolve(process.cwd(), 'ml-service/dataset/REKAMAN BRIN'),
  ];
  const brinBaseDir = candidateDirs.find((dir) => fs.existsSync(dir));
  const uploadsRefDir = path.resolve(process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'uploads'), 'references');

  if (!brinBaseDir) {
    console.warn(`[seed-tasks] Direktori audio BRIN tidak ditemukan di: ${candidateDirs.join(', ')}`);
    return audioMap;
  }

  fs.mkdirSync(uploadsRefDir, { recursive: true });

  const filesToScan: string[] = [];
  function scanDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scanDir(full);
      else if (entry.isFile() && entry.name.endsWith('.mp3')) filesToScan.push(full);
    }
  }
  scanDir(brinBaseDir);

  console.log(`[seed-tasks] Memproses ${filesToScan.length} file audio BRIN...`);

  for (const srcPath of filesToScan) {
    const filename = path.basename(srcPath);
    const destPath = path.join(uploadsRefDir, filename);

    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }

    const stat = fs.statSync(destPath);
    const objectKey = `references/${filename}`;

    const existing = await prisma.audioAsset.findUnique({ where: { objectKey } });
    if (existing) {
      audioMap.set(filename, existing.id);
    } else {
      const created = await prisma.audioAsset.create({
        data: {
          type: AudioType.REFERENCE,
          status: AudioStatus.ACTIVE,
          originalName: filename,
          objectKey,
          mimeType: 'audio/mpeg',
          sizeBytes: stat.size,
          durationSeconds: 3,
          durationMs: 3000,
          allowLegacyResample: true,
        },
      });
      audioMap.set(filename, created.id);
    }
  }

  console.log(`[seed-tasks] ${audioMap.size} AudioAsset siap digunakan.`);
  return audioMap;
}

// ── 4. Main Seeder ─────────────────────────────────────────────────────────────

export async function seedCurriculumTasks(prisma: PrismaClient): Promise<void> {
  console.log('[seed-tasks] Memulai seeding kuis & tugas kurikulum...');

  const audioMap = await copyAndRegisterAudio(prisma);

  // Ambil semua stage dan material
  const stages = await prisma.stage.findMany({
    where: { status: ContentStatus.ACTIVE },
    orderBy: { order: 'asc' },
    include: {
      materials: {
        where: { status: ContentStatus.ACTIVE },
        orderBy: { order: 'asc' },
      },
    },
  });

  let totalQuizzes = 0;
  let totalImitations = 0;

  for (const stage of stages) {
    const stageNum = stage.order;
    const stageMaterials = stage.materials;
    const maxOrderTask = await prisma.task.findFirst({
      where: { stageId: stage.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let nextTaskOrder = (maxOrderTask?.order ?? 0) + 1;

    for (const material of stageMaterials) {
      const matNum = material.order;
      const isLastMaterialInStage = matNum === stageMaterials.length;

      // Ambil definisi kuis
      let quizDef = STAGE_QUIZ_TEMPLATES[stageNum]?.[matNum];
      if (!quizDef) {
        let lines: string[] = [];
        try {
          const blocks = JSON.parse(material.contentText || '[]');
          lines = blocks.map((b: any) => b.arabicContent || b.textContent || '');
        } catch {
          // ignore
        }
        quizDef = generateFallbackQuiz(stageNum, matNum, material.title, lines);
      }

      // Upsert Task QUIZ untuk material ini
      const existingQuiz = await prisma.task.findFirst({
        where: {
          materialId: material.id,
          type: TaskType.QUIZ,
        },
      });

      let targetTaskId: string;

      if (!existingQuiz) {
        const createdTask = await prisma.task.create({
          data: {
            stageId: stage.id,
            materialId: material.id,
            title: quizDef.title,
            type: TaskType.QUIZ,
            status: ContentStatus.ACTIVE,
            order: nextTaskOrder++,
          },
        });
        targetTaskId = createdTask.id;
        totalQuizzes++;
      } else {
        targetTaskId = existingQuiz.id;
        await prisma.task.update({
          where: { id: existingQuiz.id },
          data: { title: quizDef.title },
        });
      }

      // Buat atau sinkronkan soal-soal
      for (let qIdx = 0; qIdx < quizDef.questions.length; qIdx++) {
        const qDef = quizDef.questions[qIdx];
        const audioId = qDef.audioFilename ? (audioMap.get(qDef.audioFilename) ?? null) : null;

        const existingQ = await prisma.question.findUnique({
          where: { taskId_order: { taskId: targetTaskId, order: qIdx + 1 } },
          include: { options: true },
        });

        if (existingQ) {
          await prisma.question.update({
            where: { id: existingQ.id },
            data: {
              prompt: qDef.prompt,
              audioId,
            },
          });

          // Sinkronkan teks opsi jawaban agar rapi tanpa menghapus ID
          for (let optIdx = 0; optIdx < qDef.options.length; optIdx++) {
            const opt = qDef.options[optIdx];
            const cleanText = opt.latin ? `${opt.arabic} | ${opt.latin}` : opt.arabic;
            if (existingQ.options[optIdx]) {
              await prisma.answerOption.update({
                where: { id: existingQ.options[optIdx].id },
                data: {
                  text: cleanText,
                  isCorrect: opt.isCorrect,
                },
              });
            } else {
              await prisma.answerOption.create({
                data: {
                  questionId: existingQ.id,
                  text: cleanText,
                  isCorrect: opt.isCorrect,
                },
              });
            }
          }
        } else {
          await prisma.question.create({
            data: {
              taskId: targetTaskId,
              prompt: qDef.prompt,
              order: qIdx + 1,
              audioId,
              options: {
                create: qDef.options.map((opt) => ({
                  text: opt.latin ? `${opt.arabic} | ${opt.latin}` : opt.arabic,
                  isCorrect: opt.isCorrect,
                })),
              },
            },
          });
        }
      }

      // Jika materi terakhir di tahapan ini, tambahkan UJIAN LANGKAH (IMITATION / DENGAR-TIRUKAN)
      if (isLastMaterialInStage) {
        const existingImitation = await prisma.task.findFirst({
          where: {
            materialId: material.id,
            type: TaskType.IMITATION,
          },
        });

        if (!existingImitation) {
          // Cari audio reference yang sesuai untuk stage ini
          let refAudioId: string | null = null;
          // Coba cari audio l001m001c001 dll.
          const candidateKeys = Array.from(audioMap.keys());
          const stageAudio = candidateKeys.find((k) => k.includes(`l${String(stageNum).padStart(3, '0')}`)) ?? candidateKeys[0];
          if (stageAudio) {
            refAudioId = audioMap.get(stageAudio) ?? null;
          }

          if (refAudioId) {
            await prisma.task.create({
              data: {
                stageId: stage.id,
                materialId: material.id,
                title: `Ujian Langkah ${stageNum}: Evaluasi Bacaan & Pelafalan`,
                type: TaskType.IMITATION,
                status: ContentStatus.ACTIVE,
                order: nextTaskOrder++,
                referenceAudioId: refAudioId,
              },
            });
            totalImitations++;
          }
        }
      }
    }
  }

  console.log(`[seed-tasks] Sukses! Dibuat ${totalQuizzes} Kuis Kilat & ${totalImitations} Ujian Langkah (Imitasi).`);
}
