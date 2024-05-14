use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use futures::try_join;
use ic_cdk::api::call::RejectionCode;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use registry_canister::add_token::{Response::*, *};
use registry_canister::NervousSystemDetails;
use tracing::{error, info};
use types::CanisterId;

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

pub(crate) async fn add_sns_token(nervous_system: NervousSystemDetails) {
    add_token_impl(
        nervous_system.ledger_canister_id,
        Some(nervous_system),
        None,
        None,
        None,
        None,
    )
    .await;
}

async fn add_token_impl(
    ledger_canister_id: CanisterId,
    nervous_system: Option<NervousSystemDetails>,
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    logo: Option<String>,
) -> Response {
    let metadata = match icrc_ledger_canister_c2c_client::icrc1_metadata(ledger_canister_id).await {
        Ok(r) => r,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    if !check_icrc1_compatibility(&metadata) {
        return InvalidRequest("Token is not compatible with the ICRC1 standard".to_string());
    }

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

    match try_join!(
        icrc_ledger_canister_c2c_client::icrc1_name(ledger_canister_id),
        icrc_ledger_canister_c2c_client::icrc1_symbol(ledger_canister_id),
        icrc_ledger_canister_c2c_client::icrc1_decimals(ledger_canister_id),
        icrc_ledger_canister_c2c_client::icrc1_fee(ledger_canister_id),
        icrc_ledger_canister_c2c_client::icrc1_supported_standards(ledger_canister_id),
        get_logo(logo, metadata, nervous_system.as_ref().map(|ns| ns.logo.clone())),
    ) {
        Ok((.., logo)) if logo.is_none() => {
            let error = "Failed to find logo for token";
            error!(%ledger_canister_id, error);
            InternalError(error.to_string())
        }
        Ok((name, symbol, decimals, fee, standards, logo)) => mutate_state(|state| {
            let now = state.env.now();
            let standards = standards.into_iter().map(|r| r.name).collect();

            if let Some(ns) = nervous_system {
                state.data.nervous_systems.add(ns, now);
            }
            if state.data.tokens.add(
                ledger_canister_id,
                name.clone(),
                symbol,
                decimals,
                fee.0.try_into().unwrap(),
                logo.unwrap(),
                info_url,
                how_to_buy_url,
                transaction_url_format,
                standards,
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
    nervous_system: Option<&NervousSystemDetails>,
) -> Result<Urls, &'static str> {
    let info_url = match info_url.or_else(|| {
        nervous_system
            .as_ref()
            .map(|ns| ns.root_canister_id)
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
            .map(|ns| ns.root_canister_id)
            .map(|c| format!("https://dashboard.internetcomputer.org/sns/{c}/transaction/{{transaction_index}}"))
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
    metadata: Vec<(String, MetadataValue)>,
    governance_logo: Option<String>,
) -> Result<Option<String>, (RejectionCode, String)> {
    if logo.is_some() {
        return Ok(logo);
    }

    let logo = metadata.into_iter().find(|(k, _)| k == "icrc1:logo").and_then(|(_, v)| {
        if let MetadataValue::Text(t) = v {
            Some(t)
        } else {
            None
        }
    });

    Ok(logo.or(governance_logo))
}

fn check_icrc1_compatibility(metadata: &[(String, MetadataValue)]) -> bool {
    for (k, v) in metadata {
        if k == "icrc1:transfer_fee_rate" || k == "icrc1:burn_fee" || k == "icrc1:burn_fee_rate" {
            match v {
                MetadataValue::Nat(x) if *x > 0u128 => return false,
                MetadataValue::Int(x) if *x > 0i128 => return false,
                _ => {}
            }
        }
    }
    true
}
