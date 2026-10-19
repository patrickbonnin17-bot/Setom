// SETOM V2 — planning seed data used by the prototype UI.
// Replace with Supabase queries once the production schema is connected.

export const planningTeams = [
  { id: 'team-1', name: 'Équipe 1', chef: 'Chef d’équipe', effectif: 6, vehicle: 'BV01' },
  { id: 'team-2', name: 'Équipe 2', chef: 'Chef d’équipe', effectif: 6, vehicle: 'BV02' },
  { id: 'team-3', name: 'Équipe 3', chef: 'Chef d’équipe', effectif: 5, vehicle: 'BV03' },
  { id: 'team-4', name: 'Équipe 4', chef: 'Chef d’équipe', effectif: 6, vehicle: 'BV04' },
];

export const planningDays = [
  { id: 'mon', label: 'Lun', date: '20 oct.' },
  { id: 'tue', label: 'Mar', date: '21 oct.' },
  { id: 'wed', label: 'Mer', date: '22 oct.' },
  { id: 'thu', label: 'Jeu', date: '23 oct.' },
  { id: 'fri', label: 'Ven', date: '24 oct.' },
];

export const planningOrders = [
  { id: 'os-142', number: 'OS-2026-0142', address: '12 rue des Lilas', city: 'Toulouse', sector: 'Nord', material: 'Enrobé', color: 'noir', plannedSurface: 85, estimatedTons: 12.0, status: 'planifie', day: 'mon', teamId: 'team-1', zoneType: 'périphérie', traffic: 'faible', deadline: '2026-11-14' },
  { id: 'os-143', number: 'OS-2026-0143', address: '8 avenue du Parc', city: 'Toulouse', sector: 'Ouest', material: 'Enrobé', color: 'noir', plannedSurface: 120, estimatedTons: 17.0, status: 'planifie', day: 'mon', teamId: 'team-1', zoneType: 'périphérie', traffic: 'faible', deadline: '2026-11-15' },
  { id: 'os-144', number: 'OS-2026-0144', address: '3 rue Victor Hugo', city: 'Toulouse', sector: 'Centre', material: 'Enrobé', color: 'rouge', plannedSurface: 65, estimatedTons: 9.0, status: 'planifie', day: 'tue', teamId: 'team-2', zoneType: 'centre', traffic: 'forte', deadline: '2026-11-05' },
  { id: 'os-145', number: 'OS-2026-0145', address: '41 route de Paris', city: 'Toulouse', sector: 'Nord', material: 'Béton', color: '', plannedSurface: 70, estimatedTons: 11.0, status: 'en-cours', day: 'wed', teamId: 'team-3', zoneType: 'périphérie', traffic: 'faible', deadline: '2026-11-18' },
];
