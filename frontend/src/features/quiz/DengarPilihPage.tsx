import { Play, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FeedbackBar } from '../../components/ui/FeedbackBar';
import { LetterCard } from '../../components/ui/LetterCard';
import { ProgressBar } from '../../components/ui/ProgressBar';

interface AnswerOption {
  label: string;
  letter: string;
}

const answerOptions: AnswerOption[] = [
  { label: 'Dza', letter: 'ذَ' },
  { label: 'Zha', letter: 'ظَ' },
  { label: 'Tsa', letter: 'ثَ' },
  { label: 'Da', letter: 'دَ' },
];

const waveform = [18, 30, 12, 24, 38, 22, 14, 32, 44, 25, 16, 36, 28, 20, 40, 26, 12, 30, 22, 16, 34, 24, 14, 28];

export function DengarPilihPage(): JSX.Element {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const navigate = useNavigate();

  // [REKOMENDASI] Tombol X: kembali ke halaman sebelumnya, atau ke /belajar bila tidak ada riwayat.
  // TODO: tampilkan dialog konfirmasi (jawaban belum dikirim akan hilang) saat quiz tersambung API.
  const exitQuiz = (): void => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/belajar');
  };

  const checkAnswer = (): void => {
    if (selectedOption === 'Zha') {
      setIsAnswered(true);
    }
  };

  // pb-40 (mobile, FeedbackBar ~145 px karena teks terbungkus) dan md:pb-32: Pengecualian skala jarak SDD 7.2.2:
  // offset kompensasi tinggi elemen fixed/perataan, bukan jarak antarelemen.
  return (
    <div className="min-h-screen bg-neutral-surface-alt pb-40 font-sans md:pb-32 text-text-primary">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-neutral-border bg-neutral-surface pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[960px] items-center gap-5">
          <button type="button" onClick={exitQuiz} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-surface-alt" aria-label="Keluar dari quiz">
            <X size={22} strokeWidth={2.5} />
          </button>
          <ProgressBar value={3} max={10} className="flex-1" />
          <span className="min-w-[48px] text-right text-body-s font-bold text-text-secondary">3 / 10</span>
        </div>
      </header>

      {/* pt-32: Pengecualian skala jarak SDD 7.2.2: offset kompensasi tinggi elemen fixed/perataan, bukan jarak antarelemen. */}
      <main className="mx-auto flex max-w-[760px] flex-col px-5 pb-12 pt-32">
        <p className="text-label uppercase text-brand-primary">Dengar-Pilih · Tahapan 2 Materi 3</p>
        <h1 className="mt-3 text-h2 text-text-primary">Huruf apakah yang dibaca?</h1>

        <section className="mt-8 rounded-md border border-neutral-border bg-neutral-surface p-5 shadow-card" aria-label="Pemutar audio contoh">
          <div className="flex items-center gap-4">
            <button type="button" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-text-on-brand shadow-md active:translate-y-0.5 active:shadow-none" aria-label="Putar audio">
              <Play size={23} fill="currentColor" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              {/* Batang yang tidak muat di layar sempit terpotong, tidak melebarkan halaman. */}
              <div className="flex h-12 min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-hidden="true">
                {waveform.map((height, index) => <span key={`${height}-${index}`} className="w-1 shrink-0 rounded-full bg-brand-primary" style={{ height }} />)}
              </div>
              <span className="whitespace-nowrap text-caption text-text-secondary">0:03 / 0:07</span>
            </div>
          </div>
        </section>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {answerOptions.map((option) => (
            <LetterCard
              key={option.label}
              letter={option.letter}
              label={option.label}
              selected={selectedOption === option.label}
              onClick={() => !isAnswered && setSelectedOption(option.label)}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-body-s text-text-secondary">Pilih satu jawaban, lalu tekan Periksa</p>
        {!isAnswered && <Button className="mx-auto mt-5 min-w-40" variant="accent" disabled={!selectedOption} onClick={checkAnswer}>PERIKSA</Button>}
      </main>

      {isAnswered && <FeedbackBar state="benar" title="Tepat sekali!" detail={<>Zha — <span className="font-arabic" lang="ar" dir="rtl">ظَ</span></>} actionLabel="LANJUT" />}
    </div>
  );
}
