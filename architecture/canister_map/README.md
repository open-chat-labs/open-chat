# OpenChat canister map

An interactive map of every canister type OpenChat runs, shown on the website's Architecture page
([oc.app/architecture](https://oc.app/architecture)), which frames the page itself (served beside
the app as `/canister-map-<website version>.html`). Each canister is a node; click one to zoom in on its
endpoints, state, background jobs, metrics, and the calls it makes and receives. Search finds
canisters, endpoints and state fields. When framed, the page takes the site's theme from the frame
and reports the selected canister back so the Architecture page's url can be shared.

The page is a single self-contained file which the website build regenerates from the backend
source on every deploy (`frontend/app/rollup.config.mjs` runs `extract.py --out
build/canister-map-<version>.html`, and tells the app the path), so it always describes the code
of the release it ships with and can be cached as immutable. To
look at it locally, run `extract.py` as below and open the `index.html` it writes beside it; that
copy is not committed.

Everything on the map except the one-paragraph descriptions is read from the source code by
[extract.py](extract.py):

- endpoints from the `#[query]`, `#[update]` and `#[proposal]` functions in each `impl` crate,
  with their guards, encodings, and the `Args` / `Response` types from the `api` crate; which of
  them the web app calls comes from `generate_ts_method!` in the api crate's `main.rs`
- state from the `Data` struct in `impl/src/lib.rs`, metrics from `Metrics`, scheduled work from
  the `TimerJob` enum and the `jobs` module, stable memory regions from `memory.rs`
- calls between canisters from the `<x>_canister_c2c_client::<method>` uses in the impl crate and
  in the shared libraries it depends on
- init args from the api crate's `lifecycle/init.rs`, the released version from the `CHANGELOG.md`
  and prod canister ids from `canister_ids.json`

## Regenerating

From the repo root:

```
python3 architecture/canister_map/extract.py          # writes architecture/canister_map/index.html
python3 architecture/canister_map/extract.py --live   # also refreshes the prod counts in live.json from /metrics
```

`live.json` holds the prod counts shown on the overview tab (users, groups, files, ...) for a
build without `--live`; the prod and prod test website builds fetch them afresh (not in CI), falling
back to the file for any canister whose metrics can't be read. The native app builds skip the page:
the shells open oc.app/canisters in a browser. A CI job (`.github/workflows/canister_map.yaml`)
runs the generator on backend changes so a change that breaks it is caught before a release.

`index.html` is `template.html` with the extracted data spliced in, so edit the template for changes to
the page and `extract.py` (the `DESCRIPTIONS` table) for the canister descriptions. A canister
without an entry in `DESCRIPTIONS` is skipped, with a note on stderr, so adding a canister means
adding its description and a position in `NODE_POS` in the template.
