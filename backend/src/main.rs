mod config;
mod error;
mod routes;
mod state;

use std::net::SocketAddr;

use axum::Router;
use config::AppConfig;
use error::AppError;
use state::AppState;
use tokio::net::TcpListener;
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};
use tracing::info;

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("fatal error: {err}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), AppError> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = AppConfig::from_env()?;
    let state = AppState::new(config);
    let port = state.config.port;
    let app = build_router(state);

    let bind_addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(bind_addr).await?;
    info!("meet37 backend listening on {bind_addr}");
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    routes::router()
        .route_layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "backend=info,tower_http=info".into());

    tracing_subscriber::fmt().with_env_filter(filter).init();
}
