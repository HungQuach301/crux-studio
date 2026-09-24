#!/usr/bin/env node
/**
 * Cổng eval cho prompt (mục `editorial/E-003`, CHARTER 6.3 mục 3).
 *
 * Việc file này làm, theo đúng tiêu chí xong của E-003:
 *
 *   1. Chạy MỖI tập mẫu trong `ops/eval/editorial/<id>/brief.json` qua xưởng
 *      `editorial` (bản `impl: stub`, không gọi API — Đợt 0), đo bộ chỉ số
 *      máy của spec tham chiếu §3.
 *   2. So bộ chỉ số với baseline đã ghi (`expected-metrics.json`) theo dung
 *      sai khai trong genre pack `limits.promptEval` — "ngưỡng nằm trong cấu
 *      hình". Chỉ số nào tụt/vọt quá dung sai thì CHẶN.
 *   3. Đòi ít nhất `minSampleSets` tập (mặc định 3) — quy tắc ba tập của spec
 *      §2: đổi prompt phải chứng minh trên ba tập, không phải một.
 *
 * Nối vào `pnpm check` (script `eval:prompt`), nên nó chạy trong job status
 * check `check` của `ci.yml` — KHÔNG thêm job CI mới (đổi tên/thêm job là
 * `irreversible` nhóm 8, CHARTER 2.3; `ops/scripts/required-checks.ts`).
 *
 * `--update`: ghi lại `expected-metrics.json` từ output hiện tại. Chỉ dùng
 * trong PR có chủ đích đổi baseline (ví dụ khi `editorial` lên `v1`), giải
 * thích vì sao chỉ số đổi — cùng tinh thần `pnpm replay -- --update` (CHARTER
 * 6.1). Baseline eval để NGOÀI `ops/golden/**` nên không vướng luật
 * golden-solo, và đổi baseline không phải đổi snapshot tập vàng.
 *
 * Vì sao đọc được ở `impl: stub` mà vẫn có nghĩa: stub sinh output TẤT ĐỊNH
 * theo brief, nên baseline = output stub đã ghi, và eval bắt mọi hồi quy chỉ
 * số. Prompt hôm nay chưa lái output (stub dựng từ genre pack), nên đổi phiên
 * bản prompt CHƯA làm chỉ số đổi — đó là sự thật về Đợt 0, ghi thẳng ở đây
 * chứ không giả vờ. Khi `E-005` nối prompt thật, cùng cổng này thành cổng
 * chặn thật, không ai phải viết lại.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ARTIFACT_KIND,
  ENVELOPE_SCHEMA_VERSION,
  Cassette,
  fixedClock,
  loadChannelPack,
  loadGenrePack,
  runWorkshop,
  type Envelope,
} from '@crux/kernel';

import { definitionFor } from './pipeline.ts';
import {
  editorialMetrics,
  metricProblems,
  sampleSetCountProblems,
  formatMetricProblem,
  METRIC_NAMES,
  type EditorialEvalPayload,
  type MetricName,
  type PromptEvalConfig,
} from './prompt-eval.ts';

/** Mốc thời gian cố định cho mọi lượt eval — output phải tất định. */
const EVAL_CLOCK_AT = '2020-01-01T00:00:00.000Z';

/** Quy tắc ba tập (spec §2) khi genre pack không khai `minSampleSets`. */
const DEFAULT_MIN_SAMPLE_SETS = 3;

interface TopicBrief {
  selected: { question: string };
  claims: { id: string; statement: string }[];
  targetDurationMs: number;
}

interface SampleSet {
  id: string;
  brief: TopicBrief;
  /** `expected-metrics.json`, hoặc `undefined` nếu chưa ghi. */
  baseline?: Partial<Record<MetricName, number>>;
}

/** Đọc cấu hình eval từ genre pack `limits.promptEval` (trung tính thể loại). */
export function promptEvalConfig(genreLimits: Record<string, unknown>): PromptEvalConfig {
  const raw = (genreLimits['promptEval'] ?? {}) as {
    minSampleSets?: number;
    tolerances?: PromptEvalConfig['tolerances'];
  };
  return {
    minSampleSets: typeof raw.minSampleSets === 'number' ? raw.minSampleSets : DEFAULT_MIN_SAMPLE_SETS,
    tolerances: raw.tolerances ?? {},
  };
}

/** Liệt kê các tập mẫu trong `ops/eval/editorial/`. */
export function loadSampleSets(root: string): SampleSet[] {
  const dir = join(root, 'ops', 'eval', 'editorial');
  if (!existsSync(dir)) return [];
  const sets: SampleSet[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const setDir = join(dir, entry);
    if (!statSync(setDir).isDirectory()) continue;
    const briefPath = join(setDir, 'brief.json');
    if (!existsSync(briefPath)) continue;
    const brief = JSON.parse(readFileSync(briefPath, 'utf8')) as TopicBrief;
    const baselinePath = join(setDir, 'expected-metrics.json');
    const baseline = existsSync(baselinePath)
      ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as Partial<Record<MetricName, number>>)
      : undefined;
    sets.push({ id: entry, brief });
    if (baseline) sets[sets.length - 1]!.baseline = baseline;
  }
  return sets;
}

/** Dựng phong bì `topic` tối thiểu để làm đầu vào cho xưởng `editorial`. */
function topicEnvelope(
  brief: TopicBrief,
  ctx: { episodeId: string; channel: string; genre: string; locale: string; createdAt: string },
): Envelope<TopicBrief> {
  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    kind: ARTIFACT_KIND.topic,
    producer: { workshop: 'topic', version: '0.0.0-stub', impl: 'stub' },
    episodeId: ctx.episodeId,
    channel: ctx.channel,
    genre: ctx.genre,
    locale: ctx.locale,
    inputsHash: '',
    inputs: [],
    createdAt: ctx.createdAt,
    costUsd: 0,
    status: 'ok',
    payload: brief,
  };
}

/** Chạy xưởng `editorial` trên một brief, trả bộ chỉ số. Tất định (clock cố định, băng rỗng). */
export async function metricsForBrief(
  root: string,
  brief: TopicBrief,
): Promise<Record<MetricName, number>> {
  const channelPack = loadChannelPack(root, defaultChannel(root));
  const genrePack = loadGenrePack(root, channelPack.genre);
  const episode = {
    episodeId: 'eval',
    channel: channelPack.slug,
    genre: channelPack.genre,
    locale: channelPack.locale,
  };
  const clock = fixedClock(EVAL_CLOCK_AT);
  const topic = topicEnvelope(brief, { ...episode, createdAt: clock.now() });
  const artifact = await runWorkshop(
    definitionFor('editorial'),
    { upstream: { topic }, packs: { channel: channelPack, genre: genrePack } },
    { ...episode, clock, cassette: new Cassette('replay'), impl: 'stub' },
  );
  return editorialMetrics(artifact.payload as unknown as EditorialEvalPayload);
}

/** Kênh mặc định của repo tham chiếu (CHARTER 1.1). Một kênh trong Đợt 0. */
function defaultChannel(root: string): string {
  const channelsDir = join(root, 'packs', 'channels');
  const entries = readdirSync(channelsDir)
    .filter((e) => statSync(join(channelsDir, e)).isDirectory())
    .sort();
  const first = entries[0];
  if (!first) throw new Error('Không tìm thấy channel pack nào trong packs/channels/.');
  return first;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const update = process.argv.includes('--update');

  const channelPack = loadChannelPack(root, defaultChannel(root));
  const genrePack = loadGenrePack(root, channelPack.genre);
  const config = promptEvalConfig(genrePack.limits);
  const sets = loadSampleSets(root);

  const problems: string[] = [];

  // Quy tắc ba tập ở mức số lượng (spec §2) — kiểm cả khi --update.
  problems.push(...sampleSetCountProblems(sets.map((s) => s.id), config));

  if (update) {
    for (const set of sets) {
      const metrics = await metricsForBrief(root, set.brief);
      const ordered: Record<string, number> = {};
      for (const m of METRIC_NAMES) ordered[m] = metrics[m];
      writeFileSync(
        join(root, 'ops', 'eval', 'editorial', set.id, 'expected-metrics.json'),
        `${JSON.stringify(ordered, null, 2)}\n`,
        'utf8',
      );
      process.stdout.write(`eval:prompt --update: ghi baseline cho tập ${set.id}\n`);
    }
    if (problems.length > 0) {
      process.stderr.write(`eval:prompt (--update) VẪN đỏ:\n- ${problems.join('\n- ')}\n`);
      process.exit(1);
    }
    return;
  }

  for (const set of sets) {
    if (!set.baseline) {
      problems.push(`Tập ${set.id} thiếu expected-metrics.json — chạy \`pnpm eval:prompt -- --update\` trong PR đổi baseline.`);
      continue;
    }
    const metrics = await metricsForBrief(root, set.brief);
    problems.push(...metricProblems(set.id, metrics, set.baseline, config).map(formatMetricProblem));
  }

  if (problems.length > 0) {
    process.stderr.write(
      `Eval prompt (editorial/E-003) ĐỎ — ${problems.length} vấn đề:\n- ${problems.join('\n- ')}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `Eval prompt ok: ${sets.length} tập mẫu (≥ ${config.minSampleSets}), ` +
      `bộ chỉ số ${METRIC_NAMES.length} máy khớp baseline trong dung sai genre pack.\n`,
  );
}

const isMain = process.argv[1]?.endsWith('check-prompt-eval.ts') === true;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}
