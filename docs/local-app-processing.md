# Local app processing

An app can own deterministic text extraction and interpretation of model results by declaring
`"x-openchat-local-processor": { "version": 1 }` on its response schema. OpenChat runs the
registered card surface with `oc-app-process=1` and communicates through a short-lived iframe.
The app document supplies the implementation. No app module is imported into OpenChat.

For text, the app receives an `extract` request. OCR-only mode also sends `extract`, with
independent `ocrTranscripts` collected using the app-selected profiles, without loading a model.
For model output, the app receives `normalize` with generic candidate objects. In verified mode,
each independent reading is normalized separately before the generic field comparison. Audio continues through the
selected model before normalization. The app owns the field names, meanings, labels, calendar
interpretation and any other domain rules.

The model response schema must accept the raw values the app needs to interpret. For example,
if an app wants to interpret a visible timestamp itself, its raw field can be a bounded string.
OpenChat's ordinary schema validation runs before the processor and again on its returned
candidates. Final application constraints also belong in the app's backend verifier.

## Protocol

Every envelope carries `version: 1`, a random `frameNonce`, and a random `requestNonce`.

| Message | Direction | Additional data |
| --- | --- | --- |
| `oc:app-process:bootstrap` | Host → app | None |
| `oc:app-process:ready` | App → host | None |
| `oc:app-process:request` | Host → app | `actionId`, `input` |
| `oc:app-process:result` | App → host | `kind`, and `candidates` when successful |

`input` has an `operation` (`extract`, `normalize`, or the opt-in `normalize_raw` below), `modality` (`text`, `image`, or `audio`),
and optional `text`, `ocrTranscripts` (objects with `profile` and `text`),
`sourceTimestamp` (epoch milliseconds), and `candidates`. Source text is
limited to 32 KiB; the complete request and result are each limited to 64 KiB. A successful
response contains 1–32 candidate objects; an app may impose a smaller bound. Other results are `none`, `ambiguous`, or `error`.

## Isolation and lifecycle

The host resolves the card URL from the selected registered app before creating the frame.
The iframe uses `sandbox="allow-scripts"`, credentialless storage, and no referrer. It receives
no account credentials, consumer keys, chat identifiers or private-context capabilities. The
app still receives the supplied source text or candidate data, so its processor must follow
the app's own privacy contract. The protocol does not grant backend access.

OpenChat accepts messages only from the exact iframe window with its opaque `null` origin
and both matching nonces. It validates envelope keys, bounded JSON, candidate count and schema.
Attempts time out after 30 seconds; at most two run concurrently. Account/context changes
cancel delivery. Completion removes the iframe and listeners. Existing provenance attestation,
review, and final confirmation still run after processing.

Generic host tests use independent measurement and specimen schemas. App integration examples
and app-specific parser tests belong in the corresponding app repository.

## App-owned image prompts per model

An app may register an optional `x-openchat-image-prompt-by-model` sibling in its response
schema. Model IDs are opaque, exact, case-sensitive identifiers; OpenChat does not select
domain rules or construct different app prompts for particular model families.

```json
{
  "x-openchat-image-prompt-template": {
    "version": 1,
    "template": "Read the visible measurement.",
    "includeRuleGuidance": false
  },
  "x-openchat-image-prompt-by-model": {
    "version": 1,
    "templates": {
      "vendor/vision-A:q4": {
        "template": "Copy the visible measurement as JSON.",
        "includeRuleGuidance": false
      },
      "vision-B": {
        "template": "Return the reading shown in the image as JSON.",
        "includeRuleGuidance": true
      }
    }
  }
}
```

The selected model ID already supplied to inference chooses only its registered primary
image template and whether to append model-facing rule guidance. Executable post-rules,
schema validation, app normalization, card verification and confirmation remain mandatory.
Image captions are appended once. This extension neither selects/switches a model nor changes
generation settings, downloads, retries, cropping or the number of inference requests.

Limits: 1–8 entries; 1–128-character ASCII IDs beginning with an alphanumeric character and
otherwise containing only alphanumerics or `._:/@+-`; 4,096 UTF-8 bytes per template; and
16,384 UTF-8 bytes for the serialized extension including keys and JSON escapes. Templates
must be nonblank and use the existing prompt character-safety rules. The existing overall
registered response-schema limit also applies: 16,384 Unicode scalar characters for the
whole JSON string, with the existing schema depth/node/property checks. The extension's
byte limit does not reserve that entire allowance for prompts. All entries must be valid; unknown
versions, extra fields or one malformed entry cause the entire optional extension to be ignored.

Absent/unknown model IDs and invalid maps retain the unchanged v1 image template, or the
original action prompt if v1 is absent. Keep v1 for older clients. A valid per-model map can
operate without v1 on a new client, but cannot by itself activate focused passes: those still
require their existing app-declared focused-pass extension and valid v1 primary configuration.
Where focused passes are already declared, only the primary template changes; their explicit
prompts, field ownership and budgets do not. `singleImagePass` still disables those passes.

Selection applies only to image-byte requests. Text, OCR-only processing and private-image
evidence verification use their existing contracts unchanged. Register a model-specific prompt
only after the app has tested its actual outputs against source evidence; passing the generic
host parser tests does not establish model accuracy.

### Version 2: app normalization before canonical validation

Version 1 prompts must return canonical schema fields. An app that needs a different model
output format must use the **atomic version 2** map, with `output` declared on every entry:

```json
{
  "x-openchat-image-prompt-by-model": {
    "version": 2,
    "templates": {
      "vendor/vision-A:q4": {
        "template": "Copy the displayed reading into reading_text as a string.",
        "includeRuleGuidance": false,
        "output": "app"
      },
      "vision-B": {
        "template": "Return the canonical reading as a JSON number.",
        "includeRuleGuidance": false,
        "output": "canonical"
      }
    }
  }
}
```

The existing template, model-ID and aggregate limits still apply. Keep the legacy v1 image
template for older clients: a client that does not understand version 2 rejects the entire
map and uses that canonical template. Never hide raw-output templates in a version 1 map
with a separate flag that an older client can ignore. Malformed/unknown maps and unknown
model IDs retain the existing fallback behavior. A recognized `output: "app"` requires a
host-provided local-processor capability; a missing capability fails **before inference**.
It cannot be combined with active focused model passes; that conflict also fails before
inference. Neither this extension nor its failure changes model selection or invokes OCR.

For `output: "app"`, the host accepts one **complete** JSON object or array of objects,
optionally enclosed in one complete JSON fence. No prose, truncated-object recovery, entry
unwrapping, duplicate keys, dropped non-object array elements or partial batch is accepted.
Raw JSON is bounded to 64 KiB; candidate lists contain 1–32 plain objects. The copied JSON
tree has depth at most 8, arrays at most 256 elements and objects at most 128 properties.
Nonfinite values, accessors, custom prototypes, symbol properties, sparse arrays and dangerous
property names are rejected. These bounds do not guarantee that an app's stricter request
limit will accept every host-valid candidate.

The host sends the registered isolated processor one request:

```json
{
  "operation": "normalize_raw",
  "modality": "image",
  "candidates": [{"reading_text": "42"}]
}
```

The successful result must contain canonical candidates and explicit source-row bindings:

```json
{
  "kind": "candidates",
  "candidates": [{"reading": 42}],
  "sourceIndexes": [0]
}
```

`sourceIndexes` must equal `0..N-1` in the original candidate order, and the output count
must equal the input count. This checks the declared row correspondence, not the truth of
the app's interpretation. The metadata is not a candidate field and never enters the card.
The ordinary nonce-bound protocol envelope remains version 1. `sourceIndexes` is mandatory
only for successful `normalize_raw` responses and is rejected on the older operations.
This image-only operation does not accept private-reader transcripts. Optional source text
and timestamps have the same bounds and privacy rules as existing operations.

Only after normalization does the host run canonical post-rules, aliases, schema conformance,
defaults and required-field validation, then build the card and its exact confirmation
payload. Do **not** weaken the canonical schema or add raw model fields to it. The app handles
the raw fields; OpenChat does not recognize domain field names, labels or model families.
The browser runner skips its later legacy normalizer for this request, so normalization is
not performed twice. `none`/`ambiguous` become no extraction; errors, timeout, invalid output,
changed context or changed row bindings prepare no card. No second image inference follows.
Text, audio, legacy image normalization and private-reader flows remain unchanged.
