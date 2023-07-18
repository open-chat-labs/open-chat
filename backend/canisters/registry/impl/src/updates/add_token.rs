use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::call::RejectionCode;
use registry_canister::add_token::{Response::*, *};
use types::{CanisterId, Empty};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    let PrepareResult { sns_wasm_canister_id } = match read_state(|state| prepare(args.ledger_canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match futures::future::try_join5(
        icrc1_ledger_canister_c2c_client::icrc1_name(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_symbol(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_decimals(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_fee(args.ledger_canister_id),
        get_logo(args.logo, args.ledger_canister_id, sns_wasm_canister_id),
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
                fee.0.try_into().unwrap(),
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

async fn get_logo(
    logo: Option<String>,
    ledger_canister_id: CanisterId,
    sns_wasm_canister_id: CanisterId,
) -> Result<Option<String>, (RejectionCode, String)> {
    if logo.is_some() {
        return Ok(logo);
    }

    let metadata = icrc1_ledger_canister_c2c_client::icrc1_metadata(ledger_canister_id).await?;

    let logo = metadata.into_iter().find(|(k, _)| k == "icrc1:logo").and_then(|(_, v)| {
        if let icrc1_ledger_canister::MetadataValue::Text(t) = v {
            Some(t)
        } else {
            None
        }
    });

    if logo.is_some() {
        return Ok(logo);
    }

    let deployed_snses = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await?;

    if let Some(governance_canister_id) = deployed_snses
        .instances
        .into_iter()
        .find(|s| s.ledger_canister_id == Some(ledger_canister_id))
        .and_then(|s| s.governance_canister_id)
    {
        let governance_metadata = sns_governance_canister_c2c_client::get_metadata(governance_canister_id, &Empty {}).await?;

        Ok(governance_metadata.logo)
    } else {
        Ok(None)
    }
}
