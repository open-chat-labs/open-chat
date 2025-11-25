use crate::lifecycle::READER_WRITER_BUFFER_SIZE;
use crate::memory::get_upgrades_memory;
use crate::state::State;
use crate::{email_sender, env, rng, state};
use email_sender_core::NullEmailSender;
use ic_cdk::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use serde::Deserialize;
use sign_in_with_email_canister::InitOrUpgradeArgs;

#[post_upgrade]
fn post_upgrade(args: InitOrUpgradeArgs) {
    let upgrade_args = args.to_upgrade_args();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(READER_WRITER_BUFFER_SIZE, Reader::new(&memory, 0));
    let mut deserializer = rmp_serde::Deserializer::new(reader);

    let mut state = State::deserialize(&mut deserializer).unwrap();
    let entropy = if state.test_mode() { 0 } else { env::now() };

    rng::set_seed(state.salt(), entropy);

    if let Some(config) = upgrade_args.email_sender_config {
        let rsa_private_key = state
            .rsa_private_key()
            .clone()
            .expect("RSA private key not set");

        state.set_email_sender_config(config.decrypt(&rsa_private_key));
    }

    if let Some(config) = state.email_sender_config().cloned() {
        email_sender::init_from_config(config);
    } else if state.test_mode() {
        email_sender::init(NullEmailSender::default());
    }

    state::init(state);
}
