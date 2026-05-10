use std::sync::Arc;

use redis::Client as RedisClient;
use sqlx::PgPool;

use crate::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db_pool: PgPool,
    pub redis_client: RedisClient,
}

impl AppState {
    pub fn new(config: AppConfig, db_pool: PgPool, redis_client: RedisClient) -> Self {
        Self {
            config: Arc::new(config),
            db_pool,
            redis_client,
        }
    }
}
