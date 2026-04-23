/** Deterministic seed helpers — ports of admin-panel/src/examples/_factory/seeds.
 *  Kept in backend so the seed is self-contained and reproducible. */

export function pick<T>(arr: readonly T[], i: number): T {
  return arr[Math.abs(i) % arr.length]!;
}
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}
export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}
export function money(i: number, base = 100, spread = 5000): number {
  return Math.round(base + ((i * 97 + 13) % spread) * 100) / 100;
}
export function code(prefix: string, i: number, width = 4): string {
  return `${prefix}-${String(1000 + i).padStart(width, "0")}`;
}

export const FIRST_NAMES = [
  "Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine",
  "Barbara", "Margaret", "Anita", "Radia", "Shafi", "Leslie", "Dennis",
  "Edsger", "Tim", "John", "Bjarne", "Niklaus", "Carol", "Dana", "Hedy", "Elena",
];
export const LAST_NAMES = [
  "Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth",
  "Johnson", "Liskov", "Hamilton", "Borg", "Perlman", "Goldwasser",
  "Lamport", "Ritchie", "Dijkstra", "Berners-Lee", "McCarthy", "Shamir",
  "Stroustrup", "Wirth",
];
export const OWNERS = ["Sam", "Alex", "Taylor", "Jordan", "Casey", "Morgan", "Riley"];
export const REP_NAMES = [
  "Sam Rivera", "Alex Chen", "Taylor Nguyen", "Jordan Park",
  "Casey Morgan", "Morgan Davis", "Riley Kim",
];
export const CITIES = [
  "San Francisco", "Seattle", "Austin", "New York", "Boston",
  "Denver", "Chicago", "Portland", "Miami", "London",
];

export const COMPANIES = [
  { name: "Acme Corp", domain: "acme.com", industry: "saas", size: 540 },
  { name: "Globex", domain: "globex.io", industry: "retail", size: 210 },
  { name: "Initech", domain: "initech.dev", industry: "software", size: 1200 },
  { name: "Umbrella Co", domain: "umbrella.com", industry: "pharma", size: 3400 },
  { name: "Hooli", domain: "hooli.com", industry: "saas", size: 8800 },
  { name: "Pied Piper", domain: "piedpiper.com", industry: "saas", size: 45 },
  { name: "Dunder Mifflin", domain: "dundermifflin.com", industry: "paper", size: 180 },
  { name: "Stark Industries", domain: "stark.com", industry: "manufacturing", size: 24000 },
  { name: "Wayne Enterprises", domain: "wayne.com", industry: "manufacturing", size: 18000 },
  { name: "Cyberdyne", domain: "cyberdyne.dev", industry: "ai", size: 620 },
  { name: "Tyrell Corp", domain: "tyrell.ai", industry: "ai", size: 420 },
  { name: "Weyland", domain: "weyland.co", industry: "aerospace", size: 5200 },
  { name: "Massive Dynamic", domain: "massivedynamic.com", industry: "saas", size: 980 },
  { name: "Oscorp", domain: "oscorp.biz", industry: "biotech", size: 740 },
  { name: "Daily Planet", domain: "dailyplanet.com", industry: "media", size: 320 },
  { name: "LexCorp", domain: "lexcorp.com", industry: "energy", size: 3100 },
  { name: "Nakatomi", domain: "nakatomi.com", industry: "real-estate", size: 480 },
  { name: "Aperture Science", domain: "aperture.sci", industry: "research", size: 210 },
];

export function personName(i: number): string {
  return `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i + 3)}`;
}
export function personEmail(i: number, domain = "example.com"): string {
  const f = pick(FIRST_NAMES, i).toLowerCase();
  const l = pick(LAST_NAMES, i + 3).toLowerCase().replace(/\s+/g, "");
  return `${f}.${l}@${domain}`;
}
