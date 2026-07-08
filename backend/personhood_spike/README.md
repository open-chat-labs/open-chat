# Personhood verification feasibility spike

Phase 0 hard gate for [#9072](https://github.com/open-chat-labs/open-chat/issues/9072):
can the proposed face-verification pipeline (JPEG decode → face detect →
landmarks/pose → 512-dim face embedding → uniqueness scan) run **on-chain**
under `tract-onnx` within the IC's instruction limits?

## Verdict: PASS

Exit criteria were: every single inference < 40B instructions (the DTS
per-message ceiling — one `model.run()` cannot be split), full verification
< ~120B. Measured (canbench 0.4.1, wasm32-unknown-unknown, opt-level 3 for
tract crates):

| Benchmark | Scalar | SIMD (`+simd128`) |
|---|---:|---:|
| `jpeg_decode_960x720` | 315M | 193M |
| `detect_rfb320` (320×240) | 1.67B | 949M |
| `detect_scrfd500m` (640×640) | 10.62B | 5.47B |
| `landmarks_2d106` (192×192) | 1.71B | 853M |
| `embed_w600k_mbf` (112×112) | 6.06B | 2.61B |
| `full_verification_8_frames`¹ | 51.28B | 24.84B |
| `uniqueness_scan_100k` (i8 dot, 512-dim) | 694M | 247M |
| `build_detector_rfb320`² | 1.03B | 993M |
| `build_detector_scrfd500m`² | 803M | 783M |
| `build_landmarks_2d106`² | 781M | 853M |
| `build_embedder_w600k_mbf`² | 935M | 917M |

¹ 8× (RFB-320 detect + 2d106 landmarks) + 4× w600k_mbf embed, models pre-built.
² One-time model parse/optimize/plan cost (init, post_upgrade or lazy first use).

- Largest single inference (SCRFD-500M @ 640×640) is 5.5B with SIMD — 7x
  headroom under the ceiling, and RFB-320 makes detection ~6x cheaper still.
- A whole verification with SIMD (decode ×8 + detect ×8 + landmarks ×8 +
  embed ×4 + 1M-user scan ≈ 2.5B) is ~30B — inside even a *single* message
  budget, so the one-inference-per-timer-execution design has enormous slack.
- Cycle cost at ~30B instructions is roughly $0.04-0.06 per verification —
  consistent with the "few cents" estimate that keeps the feature free-to-user.
- tract-onnx 0.21 loads and runs all four candidate models (op coverage OK).
- `canbench_results.yml` in this directory persists the SIMD numbers (the
  production build would enable `+simd128`).

## Still open in Phase 0

Threshold calibration (false-match / false-non-match rates at ~1M distractors
using LFW/CFP/AgeDB) is an offline exercise, not an on-chain one — it decides
the `T_dup` / `T_clear` similarity bands, not feasibility of this design.

## Running

```bash
./scripts/download-personhood-spike-models.sh   # models are not committed
cd backend/personhood_spike
canbench                                        # scalar
PERSONHOOD_SPIKE_RUSTFLAGS="-C target-feature=+simd128" canbench   # SIMD
```

Models: UltraFace RFB-320 (detection), insightface SCRFD-500M (detection
alternative), insightface 2d106det (landmarks → head pose), insightface
w600k_mbf / MobileFaceNet-ArcFace (embedding).
