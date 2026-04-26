/** Deterministic seed helpers — same input produces same data so the demo
 *  is stable across reloads and easy to screenshot / test. */
const rand = mulberry32(0x1337);
function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function pick(arr, i) {
    return arr[i % arr.length];
}
export function pickRand(arr) {
    return arr[Math.floor(rand() * arr.length)];
}
export function seq(n) {
    return Array.from({ length: n }, (_, i) => i);
}
export function daysAgo(n) {
    return new Date(Date.now() - n * 86_400_000).toISOString();
}
export function daysFromNow(n) {
    return new Date(Date.now() + n * 86_400_000).toISOString();
}
export function hoursAgo(n) {
    return new Date(Date.now() - n * 3_600_000).toISOString();
}
export const COMPANIES = [
    "Acme Corp", "Globex", "Initech", "Umbrella Co", "Soylent Ltd", "Hooli",
    "Pied Piper", "Dunder Mifflin", "Stark Industries", "Wayne Enterprises",
    "Cyberdyne", "Tyrell Corp", "Weyland-Yutani", "Massive Dynamic", "Oscorp",
    "Daily Planet", "LexCorp", "Nakatomi", "Omni Consumer", "Aperture Science",
];
export const FIRST_NAMES = [
    "Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine", "Barbara",
    "Margaret", "Anita", "Radia", "Shafi", "Leslie", "Dennis", "Edsger", "Tim",
    "John", "Rivest", "Bjarne", "Niklaus", "Carol", "Dana", "Hedy", "Elena",
];
export const LAST_NAMES = [
    "Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth",
    "Johnson", "Liskov", "Hamilton", "Borg", "Perlman", "Goldwasser",
    "Lamport", "Ritchie", "Dijkstra", "Berners-Lee", "McCarthy", "Shamir",
    "Stroustrup", "Wirth",
];
export const OWNERS = ["Sam", "Alex", "Taylor", "Jordan", "Casey", "Morgan", "Riley"];
export const CITIES = ["San Francisco", "Seattle", "Austin", "New York", "Boston", "Denver", "Chicago", "Portland", "Miami", "London"];
export function personName(i) {
    return `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i + 3)}`;
}
export function personEmail(i, domain = "example.com") {
    const f = pick(FIRST_NAMES, i).toLowerCase();
    const l = pick(LAST_NAMES, i + 3).toLowerCase().replace(/\s+/g, "");
    return `${f}.${l}@${domain}`;
}
export function money(i, base = 100, spread = 5000) {
    return Math.round(base + ((i * 97 + 13) % spread) * 100) / 100;
}
export function code(prefix, i, width = 4) {
    return `${prefix}-${String(1000 + i).padStart(width, "0")}`;
}
