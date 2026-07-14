use crate::pseudo_random_bytes;
use canbench_rs::{BenchResult, bench, bench_fn};

// Uniqueness scan: i8 dot product of a probe against 100k stored 512-dim embeddings
// (one chunk of the chunked timer scan). Production stores i8-quantized L2-normalized
// vectors; similarity = dot(a, b) / (|a| * |b|) with norms precomputed.

const DIM: usize = 512;
const VECTORS: usize = 100_000;

#[bench(raw)]
fn uniqueness_scan_100k() -> BenchResult {
    let store: Vec<i8> = pseudo_random_bytes(11, VECTORS * DIM).into_iter().map(|b| b as i8).collect();
    let probe: Vec<i8> = pseudo_random_bytes(13, DIM).into_iter().map(|b| b as i8).collect();
    bench_fn(|| {
        let mut best = i32::MIN;
        for chunk in store.chunks_exact(DIM) {
            let mut dot = 0i32;
            for i in 0..DIM {
                dot += (chunk[i] as i32) * (probe[i] as i32);
            }
            if dot > best {
                best = dot;
            }
        }
        std::hint::black_box(best);
    })
}
