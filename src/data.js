export const ROUTE_COLORS = {
  1: '#1B3A5C',
  2: '#2E6B4F',
}

export const ROUTES = {
  1: {
    id: 1,
    name: 'Literary Adventure',
    subtitle: 'Route 1',
    color: ROUTE_COLORS[1],
    totalWalk: '~2 miles',
    suggestedTime: '6–8 hours',
    stops: [
      { id: '1-1', order: 1, name: 'Strand Book Store', address: '828 Broadway, New York, NY 10003', lat: 40.7332, lng: -73.9910, isStart: true, walkToNext: { duration: '6 min', distance: '0.3 mi' } },
      { id: '1-2', order: 2, name: 'Books of Wonder', address: '42 W 17th St, New York, NY 10011', lat: 40.7396, lng: -73.9925, walkToNext: { duration: '10 min', distance: '0.5 mi' } },
      { id: '1-3', order: 3, name: 'Rizzoli Bookstore', address: '1133 Broadway, New York, NY 10010', lat: 40.7439, lng: -73.9890, walkToNext: { duration: '18 min', distance: '0.8 mi' } },
      { id: '1-4', order: 4, name: 'Three Lives & Company', address: '154 W 10th St, New York, NY 10014', lat: 40.7334, lng: -74.0021, walkToNext: { duration: '12 min', distance: '0.6 mi' } },
      { id: '1-5', order: 5, name: 'Housing Works Bookstore', address: '126 Crosby St, New York, NY 10012', lat: 40.7233, lng: -73.9973, walkToNext: { duration: '3 min', distance: '0.1 mi' } },
      { id: '1-6', order: 6, name: 'McNally Jackson Books SoHo', address: '134 Prince St, New York, NY 10012', lat: 40.7248, lng: -73.9979, walkToNext: { duration: '10 min', distance: '0.4 mi' } },
      { id: '1-7', order: 7, name: 'Yu & Me Books', address: '44 Mulberry St, New York, NY 10013', lat: 40.7157, lng: -73.9989, isFinish: true },
    ],
  },
  2: {
    id: 2,
    name: 'Used Book Adventure',
    subtitle: 'Route 2',
    color: ROUTE_COLORS[2],
    totalWalk: '~2.3 miles',
    suggestedTime: '6–7 hours',
    stops: [
      { id: '2-1', order: 1, name: 'Strand Bookstore', address: '828 Broadway, New York, NY 10003', lat: 40.7332, lng: -73.9910, isStart: true, description: 'Iconic. Massive. Used & bargain section.', hours: [['Mon–Sat', '10AM–9PM'], ['Sun', '11AM–7PM']], walkToNext: { duration: '6 min', distance: '0.3 mi' } },
      { id: '2-2', order: 2, name: 'Alabaster Bookshop', address: '122 4th Ave, New York, NY 10003', lat: 40.7330, lng: -73.9897, description: 'Carefully curated used & rare books.', hours: [['Mon–Sat', '11AM–7PM'], ['Sun', '12–6PM']], walkToNext: { duration: '5 min', distance: '0.2 mi' } },
      { id: '2-3', order: 3, name: 'Codex', address: '1 Bleecker St, New York, NY 10012', lat: 40.7259, lng: -73.9938, description: 'Thoughtfully selected used books.', hours: [['Mon–Sat', '11AM–7PM'], ['Sun', '12–6PM']], walkToNext: { duration: '7 min', distance: '0.3 mi' } },
      { id: '2-4', order: 4, name: 'Mercer Street Books & Records', address: '206 Mercer St, New York, NY 10012', lat: 40.7266, lng: -73.9954, description: 'Great used books + vinyl records.', hours: [['Mon–Sat', '11AM–7PM'], ['Sun', '12–6PM']], walkToNext: { duration: '6 min', distance: '0.3 mi' } },
      { id: '2-5', order: 5, name: 'Housing Works Bookstore', address: '126 Crosby St, New York, NY 10012', lat: 40.7233, lng: -73.9973, description: 'Huge selection of used books. Support a cause.', hours: [['Mon–Sat', '10AM–8PM'], ['Sun', '11AM–7PM']], walkToNext: { duration: '5 min', distance: '0.2 mi' } },
      { id: '2-6', order: 6, name: 'Sweet Pickle Books', address: '47 Orchard St, New York, NY 10002', lat: 40.7168, lng: -73.9908, description: 'Used books + pickle-themed fun!', hours: [['Mon–Sun', '11AM–7PM']], walkToNext: { duration: '6 min', distance: '0.3 mi' } },
      { id: '2-7', order: 7, name: 'Mast Books', address: '72 Avenue A, New York, NY 10009', lat: 40.7256, lng: -73.9814, description: 'Used & rare art, photography & culture books.', hours: [['Mon–Sat', '11AM–7PM'], ['Sun', '12–6PM']], walkToNext: { duration: '8 min', distance: '0.4 mi' } },
      { id: '2-8', order: 8, name: 'The Rabbit Books & Bar', address: '170 Avenue A, New York, NY 10009', lat: 40.7268, lng: -73.9799, description: 'Books by day, cocktails by night.', hours: [['Mon–Thu', '4PM–12AM'], ['Fri', '4PM–1AM'], ['Sun', '12PM–12AM']], isFinish: true },
    ],
  },
}

export const BONUS_STOPS = [
  { id: 'bonus-union-square', name: 'Union Square Greenmarket', icon: '\u{1F333}', lat: 40.7359, lng: -73.9911, note: "If it's market day, explore the vendors and grab a snack! (Between Stops 1 & 2)" },
  { id: 'bonus-soho-cafes', name: 'SoHo Cafés', icon: '☕', lat: 40.7248, lng: -73.9958, note: 'Great coffee between Stops 5 & 6 — try La Colombe, Bluestone Lane, or a cozy spot on Prince St.' },
  { id: 'bonus-chinatown', name: 'Chinatown', icon: '\u{1F95F}', lat: 40.7158, lng: -73.9970, note: 'After the crawl! Celebrate your book haul with dumplings, noodles, or bubble tea.' },
]

export const CHALLENGE_ITEMS = [
  'Buy one book you weren’t planning on',
  'Pick up a bookmark from every store',
  'Take a photo of your favorite shelf',
  'Rate each store 1–5 "books"',
  'Choose one book just by its cover',
]
