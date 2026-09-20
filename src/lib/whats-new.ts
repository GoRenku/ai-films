import { getCollection } from 'astro:content';
export async function getNews() {
  const [films, artists, updates] = await Promise.all([getCollection('films'), getCollection('artists'), getCollection('updates')]);
  return [
    ...films.map(f => ({title:f.data.title, description:f.data.description, date:f.data.discoveredAt, kind:'New film', href:`/films/${f.id}/`, image:f.data.image, alt:f.data.imageAlt, rank:0})),
    ...artists.map(a => ({title:a.data.title, description:a.data.description, date:a.data.discoveredAt, kind:'New artist', href:`/artists/${a.id}/`, image:undefined, alt:undefined, rank:2})),
    ...updates.map(u => ({title:u.data.title, description:u.data.description, date:u.data.date, kind:'Journal update', href:`/journal/${u.id}/`, image:undefined, alt:undefined, rank:1})),
  ].sort((a,b)=>b.date.localeCompare(a.date)||a.rank-b.rank||a.title.localeCompare(b.title));
}
export const displayDate = (date:string) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
