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
