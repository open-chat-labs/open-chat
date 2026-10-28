use candid::Principal;
use envconfig::Envconfig;
use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use mini_app_service::app::App;
use mini_app_service::bots::HttpBotClient;
use mini_app_service::cards::IcCardWriter;
use mini_app_service::config::Config;
use mini_app_service::store::{MemoryStore, RedisStore, Store};
use mini_app_service::tokens::{Tokens, key_pair_from_pem};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};
use types::{Empty, Error};

// How often the service looks for games whose bots stopped updating them
const ABANDONED_CHECK_INTERVAL: Duration = Duration::from_secs(10 * 60);

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt::init();
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");
    dotenv::dotenv().ok();

    let config = Config::init_from_env()?;
    // `mini_app_service principal` prints the principal the UserIndex's proposal must set
    if std::env::args().nth(1).as_deref() == Some("principal") {
        println!("{}", identity(&config.ic_identity_pem)?.sender()?);
        return Ok(());
    }

    let agent = Agent::builder()
        .with_url(config.ic_url.clone())
        .with_boxed_identity(identity(&config.ic_identity_pem)?)
        .build()?;
    if !config.is_production {
        agent.fetch_root_key().await?;
    }
    info!(principal = %agent.get_principal()?, "MiniApp service identity");

    let user_index = Principal::from_text(&config.user_index_canister_id)?;
    let oc_public_key = match user_index_canister_client::public_key(&agent, &user_index, &Empty {}).await? {
        user_index_canister::public_key::Response::Success(pem) => pem,
        response => return Err(format!("Failed to get OpenChat's public key: {response:?}").into()),
    };
    let tokens = Arc::new(Tokens::new(oc_public_key, key_pair_from_pem(&config.key_pem)?));

    let store: Arc<dyn Store> = match &config.redis_url {
        Some(url) => Arc::new(RedisStore::connect(url).await?),
        None => {
            warn!("No REDIS_URL, so games are kept in memory and end when the service does");
            Arc::new(MemoryStore::default())
        }
    };
    let app = Arc::new(App::new(
        tokens.clone(),
        store,
        Arc::new(HttpBotClient::new(tokens)),
        Arc::new(IcCardWriter::new(agent)),
    ));

    let sweeper = app.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(ABANDONED_CHECK_INTERVAL);
        loop {
            interval.tick().await;
            sweeper.end_abandoned_games().await;
        }
    });

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    info!(port = config.port, "MiniApp service listening");
    axum::serve(listener, mini_app_service::router(app)).await?;
    Ok(())
}

fn identity(pem: &str) -> Result<Box<dyn Identity + Send + Sync>, Error> {
    if let Ok(identity) = BasicIdentity::from_pem(pem.as_bytes()) {
        Ok(Box::new(identity))
    } else if let Ok(identity) = Secp256k1Identity::from_pem(pem.as_bytes()) {
        Ok(Box::new(identity))
    } else {
        Err("IC_IDENTITY_PEM is neither an Ed25519 nor a secp256k1 key".into())
    }
}
