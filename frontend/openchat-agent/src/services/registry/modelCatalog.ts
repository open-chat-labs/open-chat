import { Type, type Static } from "@sinclair/typebox";
import type { ModelCatalog, ModelCatalogEntry, ModelModality, ModelRuntime } from "openchat-shared";

// HAND-WRITTEN msgpack wire schema + mapper for the registry `model_catalog` query.
//
// The backend types (types/src/model_catalog.rs) are intentionally NOT `#[ts_export]`ed — they would
// collide with the hand-written `ModelCatalog` domain type in openchat-shared — so the wire schema and
// the wire->domain mapper live here instead of in the generated typebox.ts. Encoding rules followed:
// structs serialise as snake_case field-name maps (`.with_struct_map()`), `u64` fields decode as
// BigInt, and unit enum variants decode as their variant-name string literal.
//
// UPSTREAM follow-up: converge on `#[ts_export]`-generated typebox + drop this file.

const ModelFileWire = Type.Object({
    url: Type.String(),
    sha256: Type.String(),
    bytes: Type.BigInt(),
});

const ModelCatalogEntryWire = Type.Object({
    id: Type.String(),
    name: Type.String(),
    description: Type.String(),
    modalities: Type.Array(Type.Union([Type.Literal("Text"), Type.Literal("Image")])),
    runtime: Type.Literal("LlamaCpp"),
    files: Type.Array(ModelFileWire),
    license: Type.String(),
    license_url: Type.String(),
    size_bytes: Type.BigInt(),
});

const ModelCatalogWire = Type.Object({
    catalog_version: Type.Number(),
    models: Type.Array(ModelCatalogEntryWire),
});

export const RegistryModelCatalogArgs = Type.Object({});
export const RegistryModelCatalogResponse = Type.Object({ Success: ModelCatalogWire });

export function modelCatalogResponse(value: Static<typeof RegistryModelCatalogResponse>): ModelCatalog {
    const c = value.Success;
    return {
        version: c.catalog_version,
        models: c.models.map(mapEntry),
    };
}

function mapEntry(e: Static<typeof ModelCatalogEntryWire>): ModelCatalogEntry {
    return {
        id: e.id,
        name: e.name,
        description: e.description.length > 0 ? e.description : undefined,
        modalities: e.modalities.map((m): ModelModality => (m === "Image" ? "image" : "text")),
        runtime: mapRuntime(e.runtime),
        files: e.files.map((f) => ({ url: f.url, sha256: f.sha256, bytes: Number(f.bytes) })),
        license: e.license,
        licenseUrl: e.license_url.length > 0 ? e.license_url : undefined,
        sizeBytes: Number(e.size_bytes),
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mapRuntime(_r: "LlamaCpp"): ModelRuntime {
    return "llama-cpp";
}
