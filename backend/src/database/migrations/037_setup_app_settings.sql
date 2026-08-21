-- Paramètres mémoire (et autres) exposés dans la page Setup admin.
INSERT INTO app_settings (key, value) VALUES
  ('memory_archive_threshold', '0.05'),
  ('memory_snapshot_event_threshold', '8'),
  ('memory_snapshot_max_age_hours', '24'),
  ('memory_snapshot_top_nodes', '40'),
  ('memory_recall_max_chars', '4000'),
  ('memory_graph_depth', '2'),
  ('memory_recall_node_limit', '12'),
  ('memory_decay_cron', '0 */6 * * *'),
  ('memory_snapshot_cron', '15 */6 * * *')
ON CONFLICT (key) DO NOTHING;
