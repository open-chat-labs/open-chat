use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::call::RejectionCode;
use registry_canister::add_token::{Response::*, *};
use registry_canister::NervousSystem;
use tracing::error;
use types::{CanisterId, Empty};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    let PrepareResult { sns_wasm_canister_id } = match read_state(|state| prepare(args.ledger_canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let nervous_system = match sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await {
        Ok(response) => response
            .instances
            .into_iter()
            .find(|s| s.ledger_canister_id == Some(args.ledger_canister_id))
            .map(|sns| NervousSystem {
                is_nns: false,
                root: sns.root_canister_id.unwrap(),
                governance: sns.governance_canister_id.unwrap(),
            }),
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let Urls {
        info_url,
        how_to_buy_url,
        transaction_url_format,
    } = match extract_urls(&args, nervous_system.as_ref()) {
        Ok(urls) => urls,
        Err(error) => {
            error!(%args.ledger_canister_id, error);
            return InvalidRequest(error.to_string());
        }
    };

    match futures::future::try_join5(
        icrc1_ledger_canister_c2c_client::icrc1_name(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_symbol(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_decimals(args.ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_fee(args.ledger_canister_id),
        get_logo(
            args.logo,
            args.ledger_canister_id,
            nervous_system.as_ref().map(|ns| ns.governance),
        ),
    )
    .await
    {
        Ok((.., logo)) if logo.is_none() => {
            error!(ledger = %args.ledger_canister_id, "Failed to find logo for token");
            return InternalError("Failed to find logo for token".to_string());
        }
        Ok((name, symbol, decimals, fee, logo)) => mutate_state(|state| {
            let now = state.env.now();
            if state.data.tokens.add(
                args.ledger_canister_id,
                name,
                symbol,
                decimals,
                fee.0.try_into().unwrap(),
                logo.unwrap(),
                nervous_system,
                info_url,
                how_to_buy_url,
                transaction_url_format,
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

struct Urls {
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
}

fn extract_urls(args: &Args, nervous_system: Option<&NervousSystem>) -> Result<Urls, &'static str> {
    let info_url = match args.how_to_buy_url.clone().or_else(|| {
        nervous_system
            .as_ref()
            .is_some_and(|ns| !ns.is_nns)
            .then_some("https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens".to_string())
    }) {
        Some(url) => url,
        _ => return Err("'how_to_buy_url' must be provided for non-SNS tokens"),
    };

    let how_to_buy_url = match args.how_to_buy_url.clone().or_else(|| {
        nervous_system
            .as_ref()
            .is_some_and(|ns| !ns.is_nns)
            .then_some("https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens".to_string())
    }) {
        Some(url) => url,
        _ => return Err("'how_to_buy_url' must be provided for non-SNS tokens"),
    };

    let transaction_url_format = match args.transaction_url_format.clone().or_else(|| {
        nervous_system
            .as_ref()
            .filter(|ns| !ns.is_nns)
            .map(|ns| ns.root)
            .map(|c| format!("https://dashboard.internetcomputer.org/sns/{c}/transaction/{{block_index}}"))
    }) {
        Some(url) => url,
        _ => return Err("'transaction_url_format' must be provided for non-SNS tokens"),
    };

    Ok(Urls {
        info_url,
        how_to_buy_url,
        transaction_url_format,
    })
}

async fn get_logo(
    logo: Option<String>,
    ledger_canister_id: CanisterId,
    governance_canister_id: Option<CanisterId>,
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

    if let Some(canister_id) = governance_canister_id {
        let governance_metadata = sns_governance_canister_c2c_client::get_metadata(canister_id, &Empty {}).await?;

        Ok(governance_metadata.logo)
    } else {
        Ok(None)
    }
}
