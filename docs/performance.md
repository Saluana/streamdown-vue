# Performance Benchmark

The streaming renderer was benchmarked using a 1,500-word markdown fixture containing tables, math, and a mermaid diagram.

- **Environment:** Bun v1.2.14
- **Benchmark:** render of `__tests__/fixtures/complex.md`
- **Result:** ~56 ms per render

Run with:

```
bun test
```

The benchmark is tracked in `__tests__/streaming.test.ts`.

## Streaming parse cache

Run the checked-in Chromium profile from the repository root:

```bash
bun install --frozen-lockfile
bunx playwright install chromium
bun run profile:cache
```

`examples/performance/main.ts` owns the deterministic fixtures and browser page. `scripts/profile-parse-cache.mjs` starts Vite, alternates cache and custom-plugin bypass order across three runs, streams 64-character chunks at a 16 ms cadence in a persistent 1280×800 page, and prints JSON. An update is slow when its synchronous Vue render/patch work exceeds 16.67 ms; a slow frame is mutation-to-next-animation-frame latency above the same budget. Chromium Long Tasks (>50 ms) are recorded separately. The script uses CDP forced GC to sample heap before mount, with the completed document mounted, and after disposal.

### Paired timing results

Recorded 2026-09-12 on Chromium 149.0.7827.55. Values are milliseconds; update work is the sum across all streamed chunks.

| Fixture | Size / chunks | Cache runs (mean) | Bypass runs (mean) | Change | Update p95 cache / bypass | Frame p95 cache / bypass | Slow updates cache / bypass | Slow frames cache / bypass | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Prose | 7,381 / 116 | 357.2, 312.7, 307.9 (325.9) | 641.7, 615.0, 647.6 (634.8) | −48.7% | 4.4 / 8.8 | 10.5 / 14.9 | 0 / 0 | 0 / 4 | 0 |
| Math | 3,692 / 58 | 228.7, 198.4, 200.1 (209.1) | 563.4, 526.3, 524.5 (538.1) | −61.1% | 5.2 / 16.5 | 10.4 / 21.3 | 0 / 7 | 1 / 21 | 0 |
| Mixed | 5,049 / 79 | 278.8, 256.5, 258.2 (264.5) | 752.3, 689.6, 703.5 (715.1) | −63.0% | 5.2 / 16.3 | 10.0 / 19.4 | 0 / 5 | 0 / 26 | 0 |
| References fallback | 6,703 / 105 | 610.4, 530.7, 559.4 (566.8) | 548.8, 540.0, 538.4 (542.4) | +4.5% | 8.2 / 8.0 | 14.0 / 14.3 | 0 / 0 | 3 / 1 | 0 |

The eligible fixtures improve well beyond their run-to-run ranges. The reference-definition fixture intentionally disables reuse; its cache and bypass ranges overlap, so the small mean difference is treated as variation rather than a demonstrated regression.

### Retained heap

Heap values are forced-GC deltas from the immediately preceding disposed baseline. MiB values are rounded to two decimals.

| Fixture | Cache mounted | Bypass mounted | Cache after disposal | Bypass after disposal |
| --- | ---: | ---: | ---: | ---: |
| Prose, 1 instance | 1.11 MiB | 0.93 MiB | 0.01 MiB | 0.02 MiB |
| Math, 1 instance | 2.90 MiB | 1.88 MiB | <0.01 MiB | <0.01 MiB |
| Mixed, 1 instance | 2.93 MiB | 2.19 MiB | <0.01 MiB | −0.01 MiB |
| References, 1 instance | 0.28 MiB | 0.26 MiB | 0.01 MiB | −0.004 MiB |
| Mixed, 4 instances | 11.48 MiB | 8.51 MiB | 0.07 MiB | −0.01 MiB |

The cache trades mounted memory for lower update work: four mixed instances retain about 2.97 MiB more than bypass while mounted. After disposal, the cache sample was within 0.07 MiB of its baseline, establishing that the retained HAST does not survive component teardown in this run. Small negative post-disposal deltas are normal forced-GC sampling noise.

Regression coverage lives in `__tests__/parse-cache.test.ts` (differential cached-vs-bypassed output at every chunk, parse-call counting, frozen-tree mutation detection, instance isolation, and fallback rules). Package qualification still requires testing the exact artifact that chat will pin; publication and chat integration are tracked separately.
