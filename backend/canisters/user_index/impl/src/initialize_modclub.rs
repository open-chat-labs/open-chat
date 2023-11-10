use candid::Principal;
use modclub_canister::{
    addProviderAdmin::{ProviderError, ProviderResult},
    getProviderRules::Rule,
    subscribe::{SubscribeCallbackFunc, SubscribeMessage},
};
use tracing::{error, trace};

use crate::{mutate_state, read_state};

#[allow(dead_code)]
pub async fn initialize_modclub() {
    let (modclub_canister_id, user_index_canister_id, already_registered, test_mode) = read_state(|state| {
        (
            state.modclub_canister_id(),
            state.env.canister_id(),
            !state.data.reported_messages.rules().is_empty(),
            state.data.test_mode,
        )
    });

    if already_registered {
        trace!("Already registered with modclub");
        return;
    }

    trace!("1. Register OpenChat with Modclub as a provider");

    match modclub_canister_c2c_client::registerProvider(
        modclub_canister_id,
        (
            "OpenChat".to_string(),
            "A decentralized chat app governed by the people for the people".to_string(),
            None,
        ),
    )
    .await
    {
        Ok((message,)) => {
            if message != "Registration successful" {
                error!(?message, "Failed to register OpenChat as a provider with Modclub");
                return;
            }
        }
        Err(_) => return,
    }

    trace!("2. Add the platform rules");

    let initial_rules = [
        "Do not threaten to harm another individual or group of people. This includes direct, indirect, and suggestive threats.", 
        "Do not solicit, share, or make attempts to distribute content that depicts, promotes, or attempts to normalize child sexual abuse. Also, do not post content that in any way sexualizes children.", 
        "Do not share sexually explicit or sexually suggestive content of other people without the subject’s knowledge and consent, otherwise known as “revenge porn.” This includes the non-consensual distribution of intimate media that was created either with or without an individual’s consent.",
        "Do not share content that glorifies, promotes, or normalizes suicide or other acts of physical self-harm. This includes content that encourages others to cut, burn, or starve themselves, as well as content that normalizes eating disorders, such as anorexia and bulimia. Self-harm acts or threats used as a form of emotional manipulation or coercion are also prohibited.",
        "Do not share real media depicting gore, excessive violence, or animal harm, especially with the intention to harass or shock others.",
        "Do not use OpenChat to promote, coordinate, or execute financial scams."];

    match modclub_canister_c2c_client::addRules(
        modclub_canister_id,
        (initial_rules.iter().map(|r| r.to_string()).collect(), None),
    )
    .await
    {
        Ok((rule_ids,)) => {
            mutate_state(|state| {
                state.data.reported_messages.set_rules(
                    rule_ids
                        .into_iter()
                        .enumerate()
                        .map(|(i, id)| Rule {
                            description: initial_rules[i].to_string(),
                            id,
                        })
                        .collect(),
                )
            });
        }
        Err(_) => return,
    }

    trace!("3. Set Matt as initial Modclub admin");

    let admin_principal = if test_mode {
        "gq3of-647vc-zi77a-4byjm-j43ti-btw75-5ig3w-qnps3-kkg3f-sm5ir-vqe"
    } else {
        "fkgua-dzdbj-2wcim-wmajg-dhbi3-2qvlt-gujxk-tu33f-pkpkh-in3ou-wae"
    };

    match modclub_canister_c2c_client::addProviderAdmin(
        modclub_canister_id,
        (Principal::from_text(admin_principal).unwrap(), "Matt".to_string(), None),
    )
    .await
    {
        Ok((result,)) => match result {
            ProviderResult::ok | ProviderResult::err(ProviderError::ProviderAdminIsAlreadyRegistered) => (),
            ProviderResult::err(err) => {
                error!(?err, "Failed to add Matt as an admin with Modclub");
                return;
            }
        },
        Err(_) => return,
    }

    trace!("4. Register a callback with Modclub to receive moderation reports");

    let _ = modclub_canister_c2c_client::subscribe(
        modclub_canister_id,
        (SubscribeMessage {
            callback: SubscribeCallbackFunc::new(user_index_canister_id, "modclub_callback".to_string()),
        },),
    )
    .await;
}
