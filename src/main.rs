mod protocol;

use clap::Parser;
use iroh::{Endpoint, EndpointId, SecretKey, endpoint, protocol::Router};
use tokio::signal::ctrl_c;
use tracing::{error, info, warn};

use crate::protocol::{Protocol, connect};

pub const ALPN: &[u8] = b"/atman/knockknock/1";

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let secret_key = SecretKey::generate();
    let endpoint = Endpoint::builder(endpoint::presets::N0)
        .secret_key(secret_key.clone())
        .alpns(vec![ALPN.to_vec()])
        .bind()
        .await
        .expect("endpoint must be binded");

    let endpoint_id = endpoint.id();
    info!(?endpoint_id, "endpoint initialized");

    let protocol = Protocol;
    let router = Router::builder(endpoint)
        .accept(Protocol::ALPN, protocol)
        .spawn();
    info!("router spawned");

    match Args::parse().cmd {
        Command::Knock {
            endpoint_id,
            payload,
        } => {
            info!(?endpoint_id, "knocking...");
            if let Err(e) =
                connect(&router.endpoint().clone(), endpoint_id, payload.as_bytes()).await
            {
                error!(?e, ?endpoint_id, "failed to knock");
            } else {
                info!(?endpoint_id, "knock successful");
            }
        }
        Command::Accept => {
            info!("listening...");
        }
    }

    match ctrl_c().await {
        Ok(()) => {
            info!("received ctrl-c signal, shutting down...");
        }
        Err(e) => {
            error!(?e, "failed to listen for ctrl-c signal");
        }
    }

    if let Err(e) = router.shutdown().await {
        warn!("failed to shutdown router: {e}");
    } else {
        info!("router shutdown");
    }
    router.endpoint().close().await;
    info!("endpoint closed");
}

#[derive(Parser, Debug)]
struct Args {
    #[clap(subcommand)]
    cmd: Command,
}

#[derive(Parser, Debug)]
enum Command {
    Knock {
        endpoint_id: EndpointId,
        payload: String,
    },
    Accept,
}
