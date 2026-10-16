import type { Category, MediaMoment } from './types';

export const storyScenes = [
  {
    id: 'opening',
    step: '01',
    label: 'Opening scene',
    title: 'A birthday microsite with night-mode drama.',
  },
  {
    id: 'memo',
    step: '02',
    label: 'Voice memo',
    title: 'Upload audio, transcribe it, and time the transcript to media moments.',
  },
  {
    id: 'window',
    step: '03',
    label: 'Gift window',
    title: 'Tap a glass pane in the 2 × 2 window to open the random gift reveal.',
  },
  {
    id: 'wheel',
    step: '04',
    label: 'Wheel spin',
    title: 'Each category gets one random wheel result and then locks in.',
  },
  {
    id: 'cashout',
    step: '05',
    label: 'Cashout',
    title: 'Collect all four gifts and turn the result into a print-ready PDF.',
  },
] as const;

export const categories: Category[] = [
  {
    key: 'likeDontNeed',
    title: 'You like it, but don’t need it',
    eyebrow: 'Nice extras',
    blurb: 'Sweet things she would enjoy but does not really need.',
    accent: '#ff7a18',
    gradient: 'linear-gradient(135deg, rgba(255, 122, 24, 0.95), rgba(255, 47, 109, 0.9))',
    gifts: [
      { name: 'A Card, Flowers & Cake', price: 65 },
      { name: 'New Necklace', price: 20 },
      { name: 'New JBL Speaker', price: 50 },
      { name: 'Passenger Concert Tickets 2027', price: 60 },
      { name: 'Good smelling Soaps & Creams', price: 70 },
    ],
  },
  {
    key: 'dontLikeNeed',
    title: 'You don’t like it, but do need it',
    eyebrow: 'Practical',
    blurb: 'The useful stuff that helps even if it is not exciting.',
    accent: '#9b7bff',
    gradient: 'linear-gradient(135deg, rgba(155, 123, 255, 0.95), rgba(77, 160, 255, 0.86))',
    gifts: [
      { name: 'I.C.E. Ticket', price: 70 },
      { name: 'Sleep Eye Cover', price: 10 },
      { name: '20% of Rent', price: 90 },
      { name: '10% of Ghana Plane Ticket', price: 93 },
      { name: 'A Pack of Ribbons', price: 20 },
    ],
  },
  {
    key: 'dontLikeDontNeed',
    title: 'You don’t like it, and don’t need it',
    eyebrow: 'Random',
    blurb: 'The funny and unnecessary picks.',
    accent: '#18d4ff',
    gradient: 'linear-gradient(135deg, rgba(24, 212, 255, 0.95), rgba(0, 255, 163, 0.85))',
    gifts: [
      { name: 'A Small Bouncy Ball', price: 6 },
      { name: 'Green Bandana', price: 5 },
      { name: 'Key holder of a German City', price: 8 },
      { name: 'Ear rings', price: 15 },
      { name: 'Asking Bryan 3 Questions', price: 0 },
    ],
  },
  {
    key: 'likeNeed',
    title: 'You like it, and do need it',
    eyebrow: 'Best picks',
    blurb: 'The gifts she would want and actually use.',
    accent: '#ffd84d',
    gradient: 'linear-gradient(135deg, rgba(255, 216, 77, 0.95), rgba(255, 120, 64, 0.85))',
    gifts: [
      { name: 'Perfume & Skincare', price: 100 },
      { name: 'Any clothing item(s)', price: 60 },
      { name: 'Puma Sneakers', price: 45 },
      { name: 'Deutsche Bahn Subscription', price: 63 },
      { name: '50% of Your Kente', price: 100 },
    ],
  },
];

export const mediaMoments: MediaMoment[] = [
  {
    id: 'moment-01',
    title: 'Soft photo intro',
    kind: 'image',
    start: 0,
    end: 8,
    caption: 'Use this slot for your first photo while the preamble starts.',
    treatment: 'Sunset portrait or smiling close-up',
  },
  {
    id: 'moment-02',
    title: 'Memory clip',
    kind: 'video',
    start: 8,
    end: 16,
    caption: 'Swap in a short video memory while the story gets personal.',
    treatment: 'Laughing clip or candid moment',
  },
  {
    id: 'moment-03',
    title: 'Favorite snapshot',
    kind: 'image',
    start: 16,
    end: 24,
    caption: 'Another image slot for a favorite still or a date-night photo.',
    treatment: 'Favorite selfie or dressed-up picture',
  },
  {
    id: 'moment-04',
    title: 'Final reveal clip',
    kind: 'video',
    start: 24,
    end: 36,
    caption: 'Use this as the last emotional beat before the gift window opens.',
    treatment: 'Cute short video or final montage clip',
  },
];
