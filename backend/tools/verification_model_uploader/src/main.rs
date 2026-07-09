use candid::{Decode, Encode};
use canister_agent_utils::{build_ic_agent, get_dfx_identity};
use clap::Parser;
use personhood_verifier_canister::{ModelKind, commit_model, upload_model_chunk};
use serde_bytes::ByteBuf;
use std::path::PathBuf;
use types::CanisterId;

const CHUNK_BYTES: usize = 1_000_000;

// Uploads the personhood verification ONNX models (the insightface
// buffalo_sc pairing) to the personhood_verifier canister and commits them
// with their sha256 hashes. In production this is done via SNS proposals;
// this tool covers local/test environments.
#[derive(Parser)]
struct Opts {
    #[arg(long)]
    url: String,

    #[arg(long)]
    controller: String,

    #[arg(long)]
    personhood_verifier: CanisterId,

    // Directory containing version-RFB-320.onnx, 2d106det.onnx and w600k_r50.onnx
    #[arg(long)]
    models_dir: PathBuf,

    #[arg(long, default_value_t = 1)]
    embedding_version: u16,
}

#[tokio::main]
async fn main() {
    let opts = Opts::parse();
    let identity = get_dfx_identity(&opts.controller);
    let agent = build_ic_agent(opts.url, identity).await;

    for (kind, file, version) in [
        (ModelKind::Detection, "version-RFB-320.onnx", opts.embedding_version),
        (ModelKind::Landmarks, "2d106det.onnx", opts.embedding_version),
        (ModelKind::Embedding, "w600k_r50.onnx", opts.embedding_version),
    ] {
        let path = opts.models_dir.join(file);
        let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("Failed to read {path:?}: {e}"));
        let hash = sha256::sha256_string(&bytes);
        println!("Uploading {file} ({} bytes, sha256 {hash})", bytes.len());

        for (index, chunk) in bytes.chunks(CHUNK_BYTES).enumerate() {
            let args = upload_model_chunk::Args {
                kind,
                chunk_index: index as u32,
                chunk: ByteBuf::from(chunk.to_vec()),
            };
            let response = agent
                .update(&opts.personhood_verifier, "upload_model_chunk")
                .with_arg(Encode!(&args).unwrap())
                .call_and_wait()
                .await
                .expect("'upload_model_chunk' call failed");
            let response = Decode!(&response, upload_model_chunk::Response).unwrap();
            assert!(
                matches!(response, upload_model_chunk::Response::Success),
                "'upload_model_chunk' error: {response:?}"
            );
        }

        let args = commit_model::Args {
            kind,
            version,
            sha256: hash,
        };
        let response = agent
            .update(&opts.personhood_verifier, "commit_model")
            .with_arg(Encode!(&args).unwrap())
            .call_and_wait()
            .await
            .expect("'commit_model' call failed");
        let response = Decode!(&response, commit_model::Response).unwrap();
        match response {
            commit_model::Response::Success { size } => println!("Committed {file} ({size} bytes)"),
            other => panic!("'commit_model' error: {other:?}"),
        }
    }

    println!("All models uploaded and committed");
}
