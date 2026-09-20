# Crux Studio

🤖 Nhà máy nghiên cứu, sản xuất và vận hành kênh YouTube faceless dựa trên phân tích định lượng.

Mọi luật của dự án nằm ở **[`CHARTER.md`](CHARTER.md)** — đọc file đó trước.
Luật làm việc của agent ở **[`CLAUDE.md`](CLAUDE.md)**. Spec tham chiếu nghiệp vụ ở [`docs/spec/CRUX-REFERENCE-SPEC.md`](docs/spec/CRUX-REFERENCE-SPEC.md).

```
kernel/            phong bì artifact và contract v0 — trung tính thể loại và kênh
workshops/         sáu xưởng: topic, editorial, visual, audio, assembly, release
packs/             cấu hình theo thể loại (genres) và theo kênh (channels)
ops/               lanes, logs, workflows (staging), scripts, golden, metrics
episodes/          artifact văn bản của từng tập
docs/              spec, decisions, assumptions
```

## Bắt đầu

```bash
pnpm install --frozen-lockfile
pnpm check                                    # cổng chất lượng: contracts, lint:deps, typecheck, test, replay
pnpm run:episode -- --episode ep-0001-stub    # chạy trọn một tập stub
```

Yêu cầu: Node ≥ 22.18, pnpm ≥ 10.

Trạng thái và việc tiếp theo: `ops/lanes/<lane>/backlog.md`, thứ tự ưu tiên ở `ops/lanes/priority.md`.
