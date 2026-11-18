-- Offres applicables à certains modèles de véhicule (aucune ligne = tous les modèles).
CREATE TABLE IF NOT EXISTS offer_model (
  offer_id text NOT NULL REFERENCES offer(id) ON DELETE CASCADE,
  model_id text NOT NULL REFERENCES vehicle_model(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, model_id)
);
