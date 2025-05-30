use canister_agent_utils::get_dfx_identity;
use clap::Parser;
use ic_agent::agent::AgentBuilder;
use ic_utils::interfaces::ManagementCanister;
use pocket_ic::nonblocking::PocketIc;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;
use types::CanisterId;
use url::Url;

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let identity = get_dfx_identity(&args.controller);
    let ic_agent = AgentBuilder::default()
        .with_boxed_identity(identity)
        .with_url(args.ic_url)
        .build()
        .unwrap();

    let pocket_ic = PocketIc::new_from_existing_instance(Url::parse(&args.pocket_ic_url).unwrap(), 0, None);
    let effective_canister_id = pocket_ic.topology().await.default_effective_canister_id.into();

    ic_agent.fetch_root_key().await.unwrap();

    let management_canister = ManagementCanister::create(&ic_agent);

    let mut futures = Vec::new();
    for canister_name in args.canister_names {
        futures.push(create_canister(
            &management_canister,
            canister_name,
            args.cycles,
            effective_canister_id,
        ));
    }

    let map: BTreeMap<_, _> = futures::future::try_join_all(futures).await.unwrap().into_iter().collect();

    let json = serde_json::to_string_pretty(&map).unwrap();

    std::fs::create_dir_all(&args.canister_ids_json_dir).unwrap();

    let file_path = Path::new(&args.canister_ids_json_dir).join("canister_ids.json");
    std::fs::write(file_path, json).unwrap();
}

async fn create_canister(
    management_canister: &ManagementCanister<'_>,
    canister_name: String,
    cycles: u128,
    effective_canister_id: CanisterId,
) -> Result<(String, LocalWrapper), String> {
    match management_canister
        .create_canister()
        .as_provisional_create_with_amount(Some(cycles))
        .with_effective_canister_id(effective_canister_id)
        .call_and_wait()
        .await
    {
        Ok((canister_id,)) => Ok((canister_name, LocalWrapper { local: canister_id })),
        Err(err) => Err(err.to_string()),
    }
}

#[derive(Parser)]
struct Args {
    #[arg(long)]
    ic_url: String,

    #[arg(long)]
    pocket_ic_url: String,

    #[arg(long)]
    controller: String,

    #[arg(long)]
    canister_ids_json_dir: String,

    #[arg(long)]
    cycles: u128,

    #[arg(long = "canister")]
    canister_names: Vec<String>,
}

#[derive(Serialize)]
struct LocalWrapper {
    local: CanisterId,
}
