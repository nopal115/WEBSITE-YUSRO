/**
 * import-yusro-materials.ts
 *
 * Parser dan seeder kurikulum Metode Yusro dari file kurikulum_yusro.txt.
 * Struktur file:
 *   "Langkah N" + baris deskripsi  → Stage (order = N)
 *   "Langkah N Materi M" + baris-baris konten → Material (order = M di dalam Stage N)
 *   Seluruh baris konten materi disimpan sebagai JSON array blocks di contentText.
 *
 * Setiap block:
 *   { type: 'TEXT'; arabicContent: string; latinContent?: string }
 *
 * Blocks terakhir "Terampil Mengaji" dan "Doa" dimasukkan ke Materi terakhir Langkah 10.
 */

import { PrismaClient, ContentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

interface TextBlock {
  type: 'TEXT';
  textContent?: string;
  arabicContent?: string;
  latinContent?: string;
}

interface ParsedMaterial {
  langkah: number;
  materi: number;
  lines: string[];
}

interface ParsedStage {
  langkah: number;
  descLines: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isLangkahHeader(line: string): number | null {
  const m = line.match(/^Langkah\s+(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

function isMateriHeader(line: string): { langkah: number; materi: number } | null {
  const m = line.match(/^Langkah\s+(\d+)\s+Materi\s+(\d+)\s*$/);
  return m ? { langkah: parseInt(m[1], 10), materi: parseInt(m[2], 10) } : null;
}


function buildBlocks(lines: string[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes('|') || ARABIC_CHAR_REGEX.test(trimmed)) {
      blocks.push({ type: 'TEXT', arabicContent: trimmed });
    } else {
      blocks.push({ type: 'TEXT', textContent: trimmed });
    }
  }
  return blocks;
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseKurikulum(rawText: string): {
  stages: ParsedStage[];
  materials: ParsedMaterial[];
} {
  const lines = rawText.split(/\r?\n/);

  const stages: ParsedStage[] = [];
  const materials: ParsedMaterial[] = [];

  let currentStage: ParsedStage | null = null;
  let currentMaterial: ParsedMaterial | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();

    // Check "Langkah N Materi M" first (more specific)
    const materiMatch = isMateriHeader(stripped);
    if (materiMatch) {
      if (currentMaterial) materials.push(currentMaterial);
      currentMaterial = {
        langkah: materiMatch.langkah,
        materi: materiMatch.materi,
        lines: [],
      };
      continue;
    }

    // Check "Langkah N" (stage header)
    const stageNum = isLangkahHeader(stripped);
    if (stageNum !== null) {
      if (currentMaterial) {
        materials.push(currentMaterial);
        currentMaterial = null;
      }
      if (currentStage) stages.push(currentStage);
      currentStage = { langkah: stageNum, descLines: [] };
      continue;
    }

    // Collect lines
    if (currentMaterial) {
      currentMaterial.lines.push(stripped);
    } else if (currentStage) {
      if (stripped) currentStage.descLines.push(stripped);
    }
  }

  // Flush last
  if (currentMaterial) materials.push(currentMaterial);
  if (currentStage) stages.push(currentStage);

  return { stages, materials };
}

// ── Stage title builder ────────────────────────────────────────────────────────

function buildStageTitle(langkah: number, descLines: string[]): string {
  const desc = descLines.join(' ').trim();
  if (desc) return `Langkah ${langkah} – ${desc}`;
  return `Langkah ${langkah}`;
}

function buildMaterialTitle(langkah: number, materi: number, firstContentLine: string): string {
  const preview = firstContentLine ? ` – ${firstContentLine.substring(0, 60)}` : '';
  return `Langkah ${langkah} Materi ${materi}${preview}`;
}

// ── Main seeder ────────────────────────────────────────────────────────────────

export async function importYusroMaterials(prisma: PrismaClient): Promise<void> {
  const dataPath = path.join(__dirname, 'data', 'kurikulum_yusro.txt');

  if (!fs.existsSync(dataPath)) {
    console.warn(`[import-yusro] File kurikulum tidak ditemukan: ${dataPath}`);
    return;
  }

  const rawText = fs.readFileSync(dataPath, 'utf-8');
  const { stages: parsedStages, materials: parsedMaterials } = parseKurikulum(rawText);

  console.log(
    `[import-yusro] Ditemukan ${parsedStages.length} langkah, ${parsedMaterials.length} materi`,
  );

  // Upsert stages
  const stageIdMap = new Map<number, string>(); // langkah → stage.id

  for (const ps of parsedStages) {
    const title = buildStageTitle(ps.langkah, ps.descLines);
    const description = ps.descLines.join(' ').trim() || null;

    const existing = await prisma.stage.findFirst({
      where: { order: ps.langkah },
    });

    let stageId: string;
    if (existing) {
      await prisma.stage.update({
        where: { id: existing.id },
        data: { title, description, status: ContentStatus.ACTIVE },
      });
      stageId = existing.id;
      console.log(`[import-yusro]   ✓ Stage update: Langkah ${ps.langkah} – "${title}"`);
    } else {
      const created = await prisma.stage.create({
        data: {
          title,
          description,
          order: ps.langkah,
          status: ContentStatus.ACTIVE,
        },
      });
      stageId = created.id;
      console.log(`[import-yusro]   + Stage baru:   Langkah ${ps.langkah} – "${title}"`);
    }

    stageIdMap.set(ps.langkah, stageId);
  }

  // Group materials by langkah
  const byLangkah = new Map<number, ParsedMaterial[]>();
  for (const pm of parsedMaterials) {
    if (!byLangkah.has(pm.langkah)) byLangkah.set(pm.langkah, []);
    byLangkah.get(pm.langkah)!.push(pm);
  }

  // Upsert materials per stage
  for (const [langkah, mats] of byLangkah.entries()) {
    const stageId = stageIdMap.get(langkah);
    if (!stageId) {
      console.warn(
        `[import-yusro] Stage untuk Langkah ${langkah} tidak ditemukan, skip materi.`,
      );
      continue;
    }

    // Sort by materi order
    mats.sort((a, b) => a.materi - b.materi);

    for (const pm of mats) {
      const nonEmptyLines = pm.lines.filter((l) => l.trim().length > 0);
      const firstLine = nonEmptyLines[0] ?? '';
      const title = buildMaterialTitle(pm.langkah, pm.materi, firstLine);

      const blocks = buildBlocks(pm.lines);
      const contentText = JSON.stringify(blocks);

      const existing = await prisma.material.findFirst({
        where: { stageId, order: pm.materi },
      });

      if (existing) {
        await prisma.material.update({
          where: { id: existing.id },
          data: {
            title,
            contentText,
            isRequired: true,
            status: ContentStatus.ACTIVE,
          },
        });
        console.log(
          `[import-yusro]     ✓ Material update: Langkah ${langkah} Materi ${pm.materi} (${blocks.length} blocks)`,
        );
      } else {
        await prisma.material.create({
          data: {
            stageId,
            title,
            contentText,
            order: pm.materi,
            isRequired: true,
            status: ContentStatus.ACTIVE,
          },
        });
        console.log(
          `[import-yusro]     + Material baru:   Langkah ${langkah} Materi ${pm.materi} (${blocks.length} blocks)`,
        );
      }
    }
  }

  // Summary
  const stageCount = await prisma.stage.count({ where: { status: ContentStatus.ACTIVE } });
  const materialCount = await prisma.material.count({ where: { status: ContentStatus.ACTIVE } });
  console.log(
    `[import-yusro] Selesai. Total: ${stageCount} stage aktif, ${materialCount} material aktif.`,
  );
}
