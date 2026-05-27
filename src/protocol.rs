use iroh::{
    Endpoint, EndpointId,
    endpoint::{ConnectError, Connection, ConnectionError, WriteError},
    protocol::{AcceptError, ProtocolHandler},
};
use tracing::{debug, error, warn};

#[derive(Debug)]
pub struct Protocol;

impl Protocol {
    pub const ALPN: &[u8] = b"/atman/knockknock/1";
}

impl ProtocolHandler for Protocol {
    async fn accept(&self, conn: Connection) -> Result<(), AcceptError> {
        let endpoint_id = conn.remote_id();
        let (mut send, mut recv) = conn.accept_bi().await?;

        let data = recv
            .read_to_end(usize::MAX)
            .await
            .map_err(AcceptError::from_err)?;

        debug!(?endpoint_id, "received data: {data:?}");

        send.finish()?;
        conn.closed().await;
        Ok(())
    }
}

pub async fn connect(
    endpoint: &Endpoint,
    endpoint_id: EndpointId,
    payload: &[u8],
) -> Result<(), Error> {
    let conn = endpoint.connect(endpoint_id, Protocol::ALPN).await?;
    let (mut send, mut _recv) = conn.open_bi().await?;

    send.write_all(payload).await?;
    if let Err(e) = send.finish() {
        warn!(?endpoint_id, ?e, "failed to finish sending data");
    }

    match send.stopped().await {
        Ok(Some(e)) => {
            warn!(?endpoint_id, ?e, "peer stopped reading data")
        }
        Ok(None) => {
            debug!(?endpoint_id, "peer finished reading data")
        }
        Err(e) => {
            error!(?endpoint_id, ?e, "failed to wait for peer to read all data");
        }
    }

    conn.close(0u8.into(), b"done");
    Ok(())
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("failed to connect to peer: {0}")]
    Connect(#[from] ConnectError),
    #[error("connection error: {0}")]
    Connection(#[from] ConnectionError),
    #[error("failed to write data to conn: {0}")]
    Write(#[from] WriteError),
}
