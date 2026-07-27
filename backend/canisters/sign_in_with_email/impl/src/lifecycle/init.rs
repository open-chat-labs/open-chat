use crate::state::State;
use crate::{email_sender, env, rng, state};
use email_sender_core::NullEmailSender;
use ic_cdk::init;
use rsa::pkcs8::{DecodePrivateKey, DecodePublicKey};
use rsa::{RsaPrivateKey, RsaPublicKey};
use sign_in_with_email_canister::InitOrUpgradeArgs;
use std::time::Duration;

#[init]
fn init(args: InitOrUpgradeArgs) {
    let init_args = args.to_init_args();
    let email_sender_public_key =
        RsaPublicKey::from_public_key_pem(&init_args.email_sender_public_key_pem.replace("\\n", "\n")).unwrap();
    let test_mode = init_args.salt.is_some();

    state::init(State::new(
        email_sender_public_key,
        init_args.whitelisted_principals,
        test_mode,
    ));

    if let Some(salt) = init_args.salt {
        email_sender::init(NullEmailSender::default());
        set_salt(salt, 0, init_args.rsa_private_key_pem)
    } else {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            ic_cdk::futures::spawn_migratory(async {
                let salt: [u8; 32] = ic_cdk_management_canister::raw_rand().await.unwrap().try_into().unwrap();

                set_salt(salt, env::now(), None);
            })
        });
    }
}

fn set_salt(salt: [u8; 32], entropy: u64, rsa_private_key_pem: Option<String>) {
    rng::set_seed(salt, entropy);

    // The key is only ever supplied in test mode - see `InitArgs::rsa_private_key_pem`
    let rsa_private_key = match rsa_private_key_pem {
        Some(pem) => RsaPrivateKey::from_pkcs8_pem(&pem).unwrap(),
        None => rng::generate_rsa_private_key(),
    };

    state::mutate(|s| {
        s.set_rsa_private_key(rsa_private_key);
        s.set_salt(salt);
    });
}
