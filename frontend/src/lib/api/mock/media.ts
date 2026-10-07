// Media tiruan yang dibuat di runtime: tidak ada berkas audio atau PDF di repo.

const urlCache = new Map<string, string>();

function frequencyFor(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 220 + (hash % 12) * 30;
}

/** WAV PCM 16-bit mono 16 kHz berisi nada sinus. Bukan pelafalan asli. */
export function synthWav(key: string, durationMs: number): Blob {
  const sampleRate = 16000;
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples * 2, true);
  const frequency = frequencyFor(key);
  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, i / 800, (samples - i) / 800);
    view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3 * fade * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** URL blob untuk audio tiruan; dibuat sekali per kunci. */
export function mockAudioUrl(key: string, durationMs: number): string {
  const cached = urlCache.get(key);
  if (cached) return cached;
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(synthWav(key, durationMs)) : `mock-audio:${key}`;
  urlCache.set(key, url);
  return url;
}

/** PDF satu halaman yang valid, berisi satu baris teks. */
export function mockPdf(text: string): Blob {
  const content = `BT /F1 14 Tf 72 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
