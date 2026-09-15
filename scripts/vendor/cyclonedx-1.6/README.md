# CycloneDX 1.6 validation schemas

Retrieved on 2026-09-14 from the official CycloneDX schema service:

- https://cyclonedx.org/schema/bom-1.6.schema.json
- https://cyclonedx.org/schema/spdx.schema.json
- https://cyclonedx.org/schema/jsf-0.82.schema.json

These are local, JSON-format-normalized copies; schema content is unchanged.
They are distributed under the Apache License 2.0 (see LICENSE and the upstream
https://github.com/CycloneDX/specification/blob/master/LICENSE).
The JSF schema retains its OpenKeyStore/Anders Rundgren attribution.
The SPDX schema identifies its upstream data version in its original comment.

The validator pins the serialized JSON identities and never resolves network
references. Refreshing these copies requires updating their pins and rerunning
the malformed-document and real-export tests. Validation of the selected Rust
SBOM is not an advisory audit, whole-repository inventory or release approval.
