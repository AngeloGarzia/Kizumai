export function geoPercent(project) {
  if (!project) return 0;
  const loc = project.location || {};
  let p = 0;
  if (project.ou || loc.label) p += 35;
  if (loc.city) p += 20;
  if (loc.postalCode) p += 15;
  if (loc.addressLine1) p += 10;
  if (loc.region || loc.department) p += 10;
  if (loc.latitude != null && loc.longitude != null) p += 10;
  return Math.min(100, p);
}
