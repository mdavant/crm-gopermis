-- Migration 002 : offres applicables à certains modèles de véhicule.
-- Une offre sans ligne ici s'applique à tous les modèles.
CREATE TABLE IF NOT EXISTS offer_models (
  offer_id VARCHAR(80) NOT NULL,
  model_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (offer_id, model_id),
  KEY idx_offer_models_model (model_id),
  CONSTRAINT fk_offer_models_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_models_model FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
