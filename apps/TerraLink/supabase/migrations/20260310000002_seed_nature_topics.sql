-- ============================================================
-- Migration: Seed nature_topics + manufacturing templates
-- ============================================================

-- ── Nature Topics (TNFD-aligned reference data) ──────────────
insert into public.nature_topics (topic_key, name, topic_group) values
  -- Land
  ('land_use_change',       'Land-use change',               'land'),
  ('soil_degradation',      'Soil degradation',              'land'),
  ('desertification',       'Desertification',               'land'),
  ('habitat_fragmentation', 'Habitat fragmentation',         'land'),
  -- Freshwater
  ('water_extraction',      'Freshwater extraction',         'freshwater'),
  ('water_pollution',       'Freshwater pollution',          'freshwater'),
  ('wetland_loss',          'Wetland loss',                  'freshwater'),
  ('water_flow_alteration', 'Water flow alteration',         'freshwater'),
  -- Marine
  ('overfishing',           'Overfishing',                   'marine'),
  ('coral_reef_loss',       'Coral reef degradation',        'marine'),
  ('marine_pollution',      'Marine pollution',              'marine'),
  ('coastal_erosion',       'Coastal habitat loss',          'marine'),
  -- Species
  ('species_decline',       'Species population decline',    'species'),
  ('invasive_species',      'Invasive species introduction', 'species'),
  ('pollinator_loss',       'Pollinator loss',               'species'),
  ('genetic_diversity',     'Genetic diversity loss',        'species'),
  -- Pollution
  ('air_pollution',         'Air pollution',                 'pollution'),
  ('solid_waste',           'Solid waste / plastics',        'pollution'),
  ('chemical_contamination','Chemical contamination',        'pollution'),
  ('noise_light_pollution', 'Noise & light pollution',       'pollution'),
  -- Climate interaction
  ('ghg_emissions',         'GHG emissions',                 'climate_interaction'),
  ('carbon_sequestration',  'Carbon sequestration loss',     'climate_interaction'),
  ('climate_adaptation',    'Climate adaptation capacity',   'climate_interaction'),
  ('microclimate_change',   'Microclimate regulation loss',  'climate_interaction')
on conflict (topic_key) do nothing;
