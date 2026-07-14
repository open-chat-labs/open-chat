# threshold_calibration

Offline calibration of the personhood verifier's uniqueness thresholds
(`T_dup` / `T_clear`), issue #9072.

It runs the **exact** production face pipeline — the shared `face_pipeline`
library, the same code the `personhood_verifier` canister runs on-chain — over
a labelled face dataset, builds the genuine (same-person) and impostor
(different-person) similarity distributions, and prints the ROC so the SNS can
choose the on-chain bands with real false-match / false-non-match numbers
rather than the current indicative guesses (0.55 / 0.85).

## Why our semantics are inverted vs normal face recognition

We are not matching a claimed identity — we are enforcing *uniqueness*:

- A **genuine** pair (same person) must be caught as a duplicate
  (similarity ≥ `T_dup`). A genuine pair *below* `T_dup` is a **missed
  duplicate** — a sybil slipping through.
- An **impostor** pair (different people) must *not* be flagged
  (similarity < `T_dup`). An impostor pair *at/above* `T_dup` is a **false
  match** — an innocent user wrongly rejected as "not unique".

Crucially, at enrolment scale N every new user is compared against all N
stored embeddings, so a per-comparison false-match rate that looks tiny
compounds. The tool reports the scale-adjusted probability that an honest user
collides with *someone* at N = 100k / 1M — the number that actually gates
turning enforcement on.

Similarity uses the production i8-quantized cosine (the exact on-chain scan
metric); the f32 cosine is reported alongside so the quantization gap is
visible.

## Usage

```bash
./scripts/download-personhood-models.sh          # models (gitignored)

cargo run -p threshold_calibration --release -- \
  --models-dir ./backend/personhood_bench/models \
  --images-dir /path/to/dataset \
  --pairs /path/to/pairs.txt \
  --scales 100000,1000000
```

## Dataset / pairs format

One pair per line, whitespace-separated, paths relative to `--images-dir`:

```
same  Aaron_Peirsol/Aaron_Peirsol_0001.jpg  Aaron_Peirsol/Aaron_Peirsol_0002.jpg
diff  Aaron_Peirsol/Aaron_Peirsol_0001.jpg  Abba_Eban/Abba_Eban_0001.jpg
```

Label is `same`/`genuine`/`1` or `diff`/`impostor`/`0`. LFW's `pairs.txt`
converts directly (its 3-column lines are genuine, 4-column lines impostor).
Use LFW / CFP-FP / AgeDB for real calibration; more impostor pairs is better,
since the tail of the impostor distribution is what sets a safe `T_dup`.

Images that yield no detectable face are skipped and counted; that skip rate
is itself a useful signal (dataset quality / detector recall).
