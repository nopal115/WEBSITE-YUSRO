import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pill, type PillStatus } from '../../components/ui/Pill';
import { ProgressBar } from '../../components/ui/ProgressBar';

const dummyDashboardData = {
  name: 'Budi',
  idSantri: 'YSR000123',
  activeStage: 'Tahap 2: Tartil',
  continue: { title: 'Surah Al-Fatihah', description: 'Latihan kelancaran membaca', arabic: 'الفاتحة' },
  unfinished: [
    { title: 'Makharijul Huruf', subtitle: 'Latihan pengucapan huruf', status: 'diproses' as PillStatus, label: 'Diproses' },
    { title: 'Hukum Nun Sukun', subtitle: 'Belajar hukum bacaan', status: 'belum' as PillStatus, label: 'Belum' },
  ],
  recentActivities: [
    { title: 'Surah Al-Ikhlas', date: 'Hari ini, 09:42', score: '92' },
    { title: 'Evaluasi Tahap 1', date: 'Kemarin, 16:20', score: '88' },
    { title: 'Surah An-Nas', date: '12 Mei 2024', score: '' },
  ],
  progress: { value: 80, description: '8 dari 10 materi selesai' },
  latestScore: { value: '92', status: 'Baik', description: 'Evaluasi terakhir' },
  summary: [
    ['Materi selesai', '8'],
    ['Tugas selesai', '24'],
    ['Nilai rata-rata', '87'],
    ['Nilai terbaik', '96'],
  ],
};

export function DashboardPage(): JSX.Element {
  return (
    <div className="mx-auto grid max-w-[1168px] grid-cols-[minmax(0,660px)_320px] gap-10 px-12 py-12">
      <div className="space-y-8">
        <header>
          <h1 className="text-display">Assalamu&apos;alaikum, {dummyDashboardData.name}</h1>
          <p className="mt-2 text-body-l text-text-secondary">{dummyDashboardData.idSantri} · {dummyDashboardData.activeStage}</p>
        </header>

        <section className="rounded-lg bg-brand-primary p-8 text-white shadow-[0_6px_0_theme(colors.brand.primary-hover)]">
          <p className="text-label text-brand-accent">LANJUTKAN</p>
          <div className="mt-6 flex items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white text-arabic-m text-brand-primary" lang="ar" dir="rtl">{dummyDashboardData.continue.arabic}</div>
            <div>
              <h2 className="text-h2">{dummyDashboardData.continue.title}</h2>
              <p className="mt-1 text-body text-white/75">{dummyDashboardData.continue.description}</p>
            </div>
          </div>
          <Button className="mt-8 w-full shadow-[0_4px_0_#d99b02]" variant="accent">MULAI LATIHAN</Button>
        </section>

        <Card>
          <p className="text-label text-text-muted">BELUM SELESAI</p>
          <div className="mt-5 space-y-3">
            {dummyDashboardData.unfinished.map((item) => (
              <div key={item.title} className="flex items-center justify-between gap-4 rounded-md bg-neutral-surface-alt p-5">
                <div>
                  <h3 className="text-h3">{item.title}</h3>
                  <p className="mt-1 text-body-s text-text-secondary">{item.subtitle}</p>
                </div>
                <Pill status={item.status}>{item.label}</Pill>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-label text-text-muted">AKTIVITAS TERAKHIR</p>
          <div className="mt-3 divide-y divide-neutral-border">
            {dummyDashboardData.recentActivities.map((activity) => (
              <div key={activity.title} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-body-l">{activity.title}</p>
                  <p className="text-body-s text-text-muted">{activity.date}</p>
                </div>
                <span className={`text-h2 ${activity.score ? 'text-feedback-benar' : 'text-text-muted'}`}>{activity.score || '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6 pt-[76px]">
        <Card>
          <p className="text-label text-text-muted">PROGRESS</p>
          <p className="mt-2 text-score text-brand-primary">{dummyDashboardData.progress.value}%</p>
          <ProgressBar className="mt-4" value={dummyDashboardData.progress.value} max={100} />
          <p className="mt-3 text-body-s text-text-secondary">{dummyDashboardData.progress.description}</p>
        </Card>

        <Card>
          <p className="text-label text-text-muted">NILAI TERAKHIR</p>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-score text-feedback-benar">{dummyDashboardData.latestScore.value}</span>
            <Pill status="selesai">{dummyDashboardData.latestScore.status}</Pill>
          </div>
          <p className="mt-2 text-body-s text-text-secondary">{dummyDashboardData.latestScore.description}</p>
        </Card>

        <Card>
          <p className="text-label text-text-muted">RINGKASAN</p>
          <div className="mt-5 space-y-4">
            {dummyDashboardData.summary.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-body text-text-secondary">{label}</span>
                <span className="text-h3">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}