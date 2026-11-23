-- Migration 004 : informations des documents (fiche de location, attestation d'assurance)
-- préremplies pour les deux Clio de GoPermis, repérées par leur immatriculation.
-- Ne remplace jamais une valeur déjà saisie.
UPDATE vehicles SET
  brand = COALESCE(NULLIF(brand, ''), 'RENAULT'),
  model = 'Clio IV',
  color = COALESCE(NULLIF(color, ''), 'GRIS'),
  insurance_signatory = COALESCE(NULLIF(insurance_signatory, ''), 'M. BESSOLTANE Mansour'),
  insurance_policy = COALESCE(NULLIF(insurance_policy, ''), 'AU479942'),
  insurer = COALESCE(NULLIF(insurer, ''), 'GENERALI IARD - 75456, Paris Cedex 09 - France')
WHERE REPLACE(REPLACE(UPPER(registration_number), ' ', ''), '-', '') = 'FH932YK';

UPDATE vehicles SET
  brand = COALESCE(NULLIF(brand, ''), 'RENAULT'),
  model = 'Clio 5',
  color = COALESCE(NULLIF(color, ''), 'GRIS'),
  insurance_signatory = COALESCE(NULLIF(insurance_signatory, ''), 'M. AMMICH Mohammed-Amine'),
  insurance_policy = COALESCE(NULLIF(insurance_policy, ''), 'AU479942'),
  insurer = COALESCE(NULLIF(insurer, ''), 'GENERALI IARD - 75456, Paris Cedex 09 - France')
WHERE REPLACE(REPLACE(UPPER(registration_number), ' ', ''), '-', '') = 'GA318TH';
