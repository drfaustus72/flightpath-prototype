import type { Leg } from '../../domain/track/synth'

/**
 * Demo tracks. Generated ones are fictional and built from real airport positions;
 * the ForeFlight file is a real X-Plane export shared by the product owner.
 */
export type Sample =
  | { id: string; name: string; description: string; kind: 'synthetic'; start: string; legs: Leg[] }
  | { id: string; name: string; description: string; kind: 'file'; url: string; fileName: string }

const patternLeg = (touchAndGo: boolean): Leg => ({
  kind: 'fly',
  from: 'KTOA',
  to: 'KTOA',
  via: [
    [33.83, -118.37],
    [33.79, -118.37],
  ],
  cruiseFt: 1100,
  kt: 80,
  touchAndGo,
})

export const SAMPLES: Sample[] = [
  {
    id: 'catalina',
    name: 'Catalina lunch run',
    description: 'Hawthorne to Catalina and back, with a stop for lunch',
    kind: 'synthetic',
    start: '2026-11-08T17:10:00Z',
    legs: [
      { kind: 'ground', at: 'KHHR', sec: 420 },
      { kind: 'fly', from: 'KHHR', to: 'KAVX', via: [[33.77, -118.41]], cruiseFt: 4500, kt: 110 },
      { kind: 'ground', at: 'KAVX', sec: 3000 },
      { kind: 'fly', from: 'KAVX', to: 'KHHR', via: [[33.77, -118.39]], cruiseFt: 3500, kt: 110 },
      { kind: 'ground', at: 'KHHR', sec: 240 },
    ],
  },
  {
    id: 'pattern',
    name: 'Pattern work at Torrance',
    description: 'Three touch-and-goes and a full stop at KTOA',
    kind: 'synthetic',
    start: '2026-11-05T16:00:00Z',
    legs: [
      { kind: 'ground', at: 'KTOA', sec: 360 },
      patternLeg(true),
      patternLeg(true),
      patternLeg(true),
      patternLeg(false),
      { kind: 'ground', at: 'KTOA', sec: 180 },
    ],
  },
  {
    id: 'santa-barbara',
    name: 'Coastal cross-country',
    description: 'Hawthorne up the coast to Santa Barbara',
    kind: 'synthetic',
    start: '2026-11-02T18:00:00Z',
    legs: [
      { kind: 'ground', at: 'KHHR', sec: 480 },
      { kind: 'fly', from: 'KHHR', to: 'KSBA', via: [[34.02, -118.62], [34.15, -119.2]], cruiseFt: 5500, kt: 115 },
      { kind: 'ground', at: 'KSBA', sec: 300 },
    ],
  },
  {
    id: 'big-bear',
    name: 'High country: Big Bear',
    description: 'Chino to Big Bear City, field elevation 6,752 ft',
    kind: 'synthetic',
    start: '2026-10-25T16:30:00Z',
    legs: [
      { kind: 'ground', at: 'KCNO', sec: 420 },
      { kind: 'fly', from: 'KCNO', to: 'L35', via: [[34.15, -117.3]], cruiseFt: 9500, kt: 105 },
      { kind: 'ground', at: 'L35', sec: 300 },
    ],
  },
  {
    id: 'sim-kemt-kpoc',
    name: 'Simulator: El Monte to Brackett',
    description: 'A real ForeFlight export of an X-Plane session',
    kind: 'file',
    url: '/samples/foreflight-kemt-kpoc-sim.kml',
    fileName: 'foreflight-kemt-kpoc-sim.kml',
  },
]
