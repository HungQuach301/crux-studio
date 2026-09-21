#!/usr/bin/env node
/**
 * Đóng PR nháp đã bỏ — cơ chế của mục `I-001`
 * (`ops/lanes/integration/backlog.md`), dùng bởi routine `crux-integrator`
 * (CHARTER Phụ lục P3 bước 2).
 *
 * "Bỏ" nghĩa là: PR còn ở trạng thái nháp VÀ không có commit mới trong hơn
 * 72 giờ (ngưỡng khai ở `ABANDON_THRESHOLD_HOURS`, khác ngưỡng 24 giờ dùng
 * để cho phép worker khác *nhận lại* mục — CHARTER 2.1). 72 giờ là ngưỡng
 * dọn dẹp thật sự: đóng PR và trả mục về hàng đợi, không chỉ cho phép nhận
 * lại trong khi PR cũ vẫn treo đó.
 *
 * Logic quyết định (`selectAbandoned`, `revertClaimedToReady`,
 * `planReap`) là hàm thuần, kiểm bằng dữ liệu giả lập, không gọi mạng —
 * cùng triết lý với `integrator-resolve.ts`: quyết định nằm ở chỗ kiểm
 * được, phần gọi `gh` chỉ là lớp vỏ mỏng ở `main()`.
 *
 * Nhận việc ghi `status: claimed` NGAY TRONG PR nháp (`ops/lanes/README.md`),
 * nên bản trên `main` không bao giờ thực sự thấy `claimed` — mục đó chỉ tồn
 * tại trên nhánh sắp bị đóng. `revertClaimedToReady` vẫn được áp dụng lên
 * bản trên `main` như một lưới an toàn: nếu vì lý do nào đó nó thấy
 * `claimed`, nó trả về `ready`; thấy `ready` sẵn thì không đổi gì (idempotent).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const ABANDON_THRESHOLD_HOURS = 72;

export interface DraftPrCandidate {
  number: number;
  headRefName: string;
  isDraft: boolean;
  /** ISO 8601 — ngày giờ của commit cuối cùng trên nhánh. */
  lastCommitAt: string;
}

/** `claude/<lane>/<id>` → `{ lane, id }`. Không khớp thì `null` — không đoán. */
export function parseLaneAndId(branch: string): { lane: string; id: string } | null {
  const match = /^claude\/([a-z]+)\/([A-Za-z0-9.-]+)$/.exec(branch);
  if (!match) return null;
  const [, lane, id] = match;
  return { lane: lane!, id: id! };
}

function hoursSince(iso: string, now: Date): number | null {
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return null;
  return (now.getTime() - last) / (1000 * 60 * 60);
}

/** Nháp, và không có commit mới quá `thresholdHours`. */
export function isAbandoned(
  pr: Pick<DraftPrCandidate, 'isDraft' | 'lastCommitAt'>,
  now: Date,
  thresholdHours: number = ABANDON_THRESHOLD_HOURS,
): boolean {
  if (!pr.isDraft) return false;
  const hours = hoursSince(pr.lastCommitAt, now);
  if (hours === null) return false;
  return hours > thresholdHours;
}

export function selectAbandoned(
  prs: DraftPrCandidate[],
  now: Date,
  thresholdHours: number = ABANDON_THRESHOLD_HOURS,
): DraftPrCandidate[] {
  return prs.filter((pr) => isAbandoned(pr, now, thresholdHours));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Khoảng dòng `[start, end)` của mục `### <id> …` trong nội dung backlog, hoặc `null`. */
function findSection(lines: string[], id: string): { start: number; end: number } | null {
  const heading = new RegExp(`^###\\s+${escapeRegExp(id)}(?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

/**
 * Đổi `- status: claimed` thành `- status: ready` trong đúng mục `id` của
 * nội dung backlog. Không thấy mục, hoặc mục không ở `claimed`, thì trả về
 * nguyên văn với `changed: false` — không phải lỗi, chỉ là không có gì để làm.
 */
export function revertClaimedToReady(
  backlogContent: string,
  id: string,
): { content: string; changed: boolean } {
  const lines = backlogContent.split('\n');
  const section = findSection(lines, id);
  if (!section) return { content: backlogContent, changed: false };

  const statusLine = /^-\s*status:\s*claimed\s*$/;
  for (let i = section.start; i < section.end; i++) {
    if (statusLine.test(lines[i]!)) {
      lines[i] = '- status: ready';
      return { content: lines.join('\n'), changed: true };
    }
  }
  return { content: backlogContent, changed: false };
}

export function abandonNote(lane: string, id: string, hours: number): string {
  return (
    `🤖 PR nháp không có commit mới quá ${ABANDON_THRESHOLD_HOURS} giờ ` +
    `(khoảng ${Math.floor(hours)} giờ) — coi như đã bỏ (CHARTER 2.1, ` +
    `\`ops/lanes/README.md\`). Mục \`${lane}/${id}\` quay lại hàng đợi với ` +
    `\`status: ready\`; worker khác nhận lại được.`
  );
}

export interface ReapAction {
  pr: DraftPrCandidate;
  lane: string;
  id: string;
  hours: number;
  note: string;
  backlogChanged: boolean;
}

export interface ReapPlan {
  actions: ReapAction[];
  /** Nội dung backlog nếu MỌI action đều thành công — chỉ để xem trước; xem ghi chú ở `applyBacklogUpdates`. */
  updatedBacklogs: Map<string, string>;
  /** Nhánh không khớp `claude/<lane>/<id>` — bỏ qua, không đoán lane/id. */
  unparsed: DraftPrCandidate[];
}

/**
 * Áp `revertClaimedToReady` tuần tự cho đúng danh sách `actions` được truyền
 * vào — KHÔNG suy ra "mọi PR đã chọn ở bước quyết định". Tách riêng khỏi
 * `planReap` vì lý do một lỗi review đã chỉ ra ở PR `I-001`: nếu ta luôn ghi
 * đè bằng bản backlog tính sẵn cho *toàn bộ* danh sách đã chọn, một PR đóng
 * thất bại giữa chừng (mạng, quyền) vẫn khiến mục của nó bị đổi thành
 * `ready` dù PR chưa hề được đóng — và một PR đóng thất bại còn có thể chặn
 * luôn việc ghi backlog của các PR đã đóng thành công *trước* nó. `main()`
 * gọi hàm này CHỈ với các action đã đóng PR thành công, để hai lỗi trên
 * không xảy ra: mỗi mục backlog chỉ về `ready` khi PR của nó thật sự đã đóng,
 * và một PR lỗi không kéo theo các PR khác.
 */
export function applyBacklogUpdates(
  backlogByLane: Map<string, string>,
  actions: Array<{ lane: string; id: string }>,
): Map<string, string> {
  const updated = new Map<string, string>();
  for (const { lane, id } of actions) {
    const current = updated.get(lane) ?? backlogByLane.get(lane);
    if (current === undefined) continue;
    const result = revertClaimedToReady(current, id);
    if (result.changed) updated.set(lane, result.content);
  }
  return updated;
}

/**
 * Hàm thuần: từ danh sách PR mở và nội dung backlog hiện tại (theo làn),
 * tính ra việc CÓ THỂ cần làm — dùng để in bản xem trước và để lấy `note`
 * cho từng PR. Không gọi `gh`, không ghi đĩa. `main()` không dùng thẳng
 * `updatedBacklogs` ở đây để ghi đĩa — xem `applyBacklogUpdates`.
 */
export function planReap(
  prs: DraftPrCandidate[],
  now: Date,
  backlogByLane: Map<string, string>,
  thresholdHours: number = ABANDON_THRESHOLD_HOURS,
): ReapPlan {
  const abandoned = selectAbandoned(prs, now, thresholdHours);
  const actions: ReapAction[] = [];
  const unparsed: DraftPrCandidate[] = [];

  for (const pr of abandoned) {
    const parsed = parseLaneAndId(pr.headRefName);
    if (!parsed) {
      unparsed.push(pr);
      continue;
    }
    const { lane, id } = parsed;
    const hours = hoursSince(pr.lastCommitAt, now) ?? Number.POSITIVE_INFINITY;
    actions.push({ pr, lane, id, hours, note: abandonNote(lane, id, hours), backlogChanged: false });
  }

  const updatedBacklogs = applyBacklogUpdates(
    backlogByLane,
    actions.map((a) => ({ lane: a.lane, id: a.id })),
  );
  for (const action of actions) {
    const laneContent = updatedBacklogs.get(action.lane);
    if (laneContent === undefined) continue;
    // Mục của action này thật sự đổi khi và chỉ khi làm lại riêng một mình
    // nó cũng đổi — tránh việc một action SAU trong cùng làn "mượn" cờ
    // `backlogChanged` của action này.
    action.backlogChanged = revertClaimedToReady(
      backlogByLane.get(action.lane) ?? '',
      action.id,
    ).changed;
  }

  return { actions, updatedBacklogs, unparsed };
}

// --- Lớp vỏ gọi `gh`, không kiểm bằng test đơn vị — xem PR I-001 để biết vì
// sao (không có PR thật để đóng khi kiểm). Giữ càng mỏng càng tốt: mọi
// quyết định đã nằm ở các hàm thuần phía trên. ---

interface GhPrListItem {
  number: number;
  headRefName: string;
  isDraft: boolean;
}

function runGh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function fetchOpenDraftPrs(): DraftPrCandidate[] {
  const raw = runGh(['pr', 'list', '--state', 'open', '--json', 'number,headRefName,isDraft', '--limit', '200']);
  const items = JSON.parse(raw) as GhPrListItem[];
  const drafts = items.filter((item) => item.isDraft);
  return drafts.map((item) => {
    const commitsRaw = runGh([
      'pr',
      'view',
      String(item.number),
      '--json',
      'commits',
      '--jq',
      '.commits[-1].committedDate // .commits[-1].authoredDate',
    ]).trim();
    return {
      number: item.number,
      headRefName: item.headRefName,
      isDraft: item.isDraft,
      lastCommitAt: commitsRaw,
    };
  });
}

function readLaneBacklogs(lanes: string[]): Map<string, string> {
  const root = process.cwd();
  const map = new Map<string, string>();
  for (const lane of lanes) {
    const path = join(root, 'ops', 'lanes', lane, 'backlog.md');
    if (existsSync(path)) map.set(lane, readFileSync(path, 'utf8'));
  }
  return map;
}

function main(): void {
  const thresholdArg = process.argv[2];
  const thresholdHours = thresholdArg ? Number(thresholdArg) : ABANDON_THRESHOLD_HOURS;
  if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) {
    process.stderr.write('cách dùng: node ops/scripts/reap-abandoned-drafts.ts [thresholdHours]\n');
    process.exit(1);
  }

  const openPrs = fetchOpenDraftPrs();
  const candidateLanes = [
    ...new Set(
      openPrs
        .map((pr) => parseLaneAndId(pr.headRefName)?.lane)
        .filter((lane): lane is string => Boolean(lane)),
    ),
  ];
  const backlogByLane = readLaneBacklogs(candidateLanes);
  const plan = planReap(openPrs, new Date(), backlogByLane, thresholdHours);

  // Đóng từng PR độc lập: một PR lỗi (mạng, quyền) không được chặn các PR
  // khác, và backlog chỉ được cập nhật cho PR THẬT SỰ đã đóng — xem
  // `applyBacklogUpdates` để biết vì sao (lỗi review PR I-001).
  const closed: ReapAction[] = [];
  const failed: Array<{ action: ReapAction; error: string }> = [];
  for (const action of plan.actions) {
    try {
      runGh(['pr', 'close', String(action.pr.number), '--comment', action.note]);
      closed.push(action);
    } catch (error) {
      failed.push({ action, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const updatedBacklogs = applyBacklogUpdates(
    backlogByLane,
    closed.map((a) => ({ lane: a.lane, id: a.id })),
  );
  for (const [lane, content] of updatedBacklogs) {
    writeFileSync(join(process.cwd(), 'ops', 'lanes', lane, 'backlog.md'), content, 'utf8');
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        closed: closed.map((a) => ({ number: a.pr.number, lane: a.lane, id: a.id, hours: Math.floor(a.hours) })),
        failed: failed.map((f) => ({ number: f.action.pr.number, lane: f.action.lane, id: f.action.id, error: f.error })),
        backlogUpdated: [...updatedBacklogs.keys()],
        unparsed: plan.unparsed.map((pr) => pr.headRefName),
      },
      null,
      2,
    )}\n`,
  );

  // Có PR lỗi thì thoát khác 0: routine gọi tool này cần biết để đưa vào
  // ghi chú của lần chạy (CHARTER 2.2), không được nuốt lỗi im lặng.
  if (failed.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
