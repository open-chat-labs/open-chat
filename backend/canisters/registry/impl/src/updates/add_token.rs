use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::call::RejectionCode;
use registry_canister::add_token::{Response::*, *};
use registry_canister::NervousSystem;
use tracing::{error, info};
use types::{CanisterId, Empty};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    add_token_impl(
        args.ledger_canister_id,
        None,
        Some(args.info_url),
        Some(args.how_to_buy_url),
        Some(args.transaction_url_format),
        args.logo,
    )
    .await
}

pub(crate) async fn add_sns_token(
    ledger_canister_id: CanisterId,
    root_canister_id: CanisterId,
    governance_canister_id: CanisterId,
) {
    add_token_impl(
        ledger_canister_id,
        Some(NervousSystem {
            is_nns: false,
            root: root_canister_id,
            governance: governance_canister_id,
        }),
        None,
        None,
        None,
        None,
    )
    .await;
}

async fn add_token_impl(
    ledger_canister_id: CanisterId,
    nervous_system: Option<NervousSystem>,
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    logo: Option<String>,
) -> Response {
    let Urls {
        info_url,
        how_to_buy_url,
        transaction_url_format,
    } = match extract_urls(info_url, how_to_buy_url, transaction_url_format, nervous_system.as_ref()) {
        Ok(urls) => urls,
        Err(error) => {
            error!(%ledger_canister_id, error);
            return InvalidRequest(error.to_string());
        }
    };

    match futures::future::try_join5(
        icrc1_ledger_canister_c2c_client::icrc1_name(ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_symbol(ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_decimals(ledger_canister_id),
        icrc1_ledger_canister_c2c_client::icrc1_fee(ledger_canister_id),
        get_logo(logo, ledger_canister_id, nervous_system.as_ref().map(|ns| ns.governance)),
    )
    .await
    {
        Ok((.., logo)) if logo.is_none() => {
            let error = "Failed to find logo for token";
            error!(%ledger_canister_id, error);
            InternalError(error.to_string())
        }
        Ok((name, symbol, decimals, fee, logo)) => mutate_state(|state| {
            let now = state.env.now();
            if state.data.tokens.add(
                ledger_canister_id,
                name.clone(),
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
                info!(name, %ledger_canister_id, "Token added");
                Success
            } else {
                AlreadyAdded
            }
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct Urls {
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
}

fn extract_urls(
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    nervous_system: Option<&NervousSystem>,
) -> Result<Urls, &'static str> {
    let info_url = match info_url.or_else(|| {
        nervous_system
            .as_ref()
            .map(|ns| ns.root)
            .map(|c| format!("https://dashboard.internetcomputer.org/sns/{c}"))
    }) {
        Some(url) => url,
        _ => return Err("'info_url' must be provided for non-SNS tokens"),
    };

    let how_to_buy_url = match how_to_buy_url.or_else(|| {
        nervous_system
            .as_ref()
            .is_some_and(|ns| !ns.is_nns)
            .then_some("https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens".to_string())
    }) {
        Some(url) => url,
        _ => return Err("'how_to_buy_url' must be provided for non-SNS tokens"),
    };

    let transaction_url_format = match transaction_url_format.or_else(|| {
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
