use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_icrc1_client::Runtime;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use registry_canister::add_token::{Response::*, *};
use types::{CanisterId, Empty};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    let PrepareResult { sns_wasm_canister_id } = match read_state(|state| prepare(args.ledger_canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: args.ledger_canister_id,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match futures::future::try_join5(
        client.name(),
        client.symbol(),
        client.decimals(),
        client.fee(),
        get_logo(args.ledger_canister_id, &client, sns_wasm_canister_id),
    )
    .await
    {
        Ok((name, symbol, decimals, fee, logo)) => mutate_state(|state| {
            let now = state.env.now();
            if state.data.tokens.add(
                args.ledger_canister_id,
                name,
                symbol,
                decimals,
                fee as u128,
                logo,
                args.info_url,
                args.how_to_buy_url,
                args.transaction_url_format,
                now,
            ) {
                Success
            } else {
                AlreadyAdded
            }
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    sns_wasm_canister_id: CanisterId,
}

fn prepare(ledger_canister_id: CanisterId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.tokens.exists(ledger_canister_id) {
        Err(AlreadyAdded)
    } else {
        Ok(PrepareResult {
            sns_wasm_canister_id: state.data.sns_wasm_canister_id,
        })
    }
}

async fn get_logo<R: Runtime>(
    ledger_canister_id: CanisterId,
    client: &ic_icrc1_client::ICRC1Client<R>,
    sns_wasm_canister_id: CanisterId,
) -> Result<Option<String>, (i32, String)> {
    let metadata = client.metadata().await?;

    let logo = metadata.into_iter().find(|(k, _)| k == "icrc1:logo").and_then(|(_, v)| {
        if let MetadataValue::Text(t) = v {
            Some(t)
        } else {
            None
        }
    });

    if logo.is_some() {
        return Ok(logo);
    }

    let deployed_snses = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {})
        .await
        .map_err(|(code, msg)| (code as i32, msg))?;

    if let Some(governance_canister_id) = deployed_snses
        .instances
        .into_iter()
        .find(|s| s.ledger_canister_id == Some(ledger_canister_id))
        .and_then(|s| s.governance_canister_id)
    {
        let governance_metadata = sns_governance_canister_c2c_client::get_metadata(governance_canister_id, &Empty {})
            .await
            .map_err(|(code, msg)| (code as i32, msg))?;

        Ok(governance_metadata.logo)
    } else {
        Ok(None)
    }
}
