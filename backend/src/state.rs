use std::sync::Arc;

use aws_sdk_s3::Client as S3Client;
use redis::Client as RedisClient;
use sqlx::PgPool;

use crate::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db_pool: PgPool,
    pub redis_client: RedisClient,
    pub s3_client: S3Client,
}

impl AppState {
    pub fn new(
        config: AppConfig,
        db_pool: PgPool,
        redis_client: RedisClient,
        s3_client: S3Client,
    ) -> Self {
        Self {
            config: Arc::new(config),
            db_pool,
            redis_client,
            s3_client,
        }
    }
}
