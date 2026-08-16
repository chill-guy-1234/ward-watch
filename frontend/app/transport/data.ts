// Hyderabad public transport network — operational services only.
//
// Phase 2 Metro corridors (airport/Future City, Patancheru, Medchal,
// Shamirpet, Hayathnagar, Chandrayangutta) are NOT included: as of Aug 2026
// they remain in central-government appraisal with no fixed timeline and
// construction targeted 2028-30. Nothing here is under construction or
// proposed — same rule the rest of the app follows about not presenting
// planned things as current.
//
// MMTS Phase II stations are likewise omitted (commented out in the source
// this was ported from) for the same reason.

export type Category =
  | "red"
  | "green"
  | "blue"
  | "mmts"
  | "train"
  | "bus"
  | "airport";

export type Stop = {
  n: string;
  lat: number;
  lng: number;
  info?: string;
};

export type Hub = Stop & { cat: Category };

export const RED: Stop[] = [
  { n: "Miyapur", lat: 17.496519, lng: 78.372163 },
  { n: "JNTU College", lat: 17.4987, lng: 78.3888 },
  { n: "KPHB Colony", lat: 17.4938, lng: 78.4018 },
  { n: "Kukatpally", lat: 17.4851, lng: 78.4094 },
  { n: "Balanagar", lat: 17.4768, lng: 78.422 },
  { n: "Moosapet", lat: 17.472, lng: 78.426 },
  { n: "Bharat Nagar", lat: 17.464, lng: 78.4279 },
  { n: "Erragadda", lat: 17.4568, lng: 78.4304 },
  { n: "ESI Hospital", lat: 17.4477, lng: 78.4397 },
  { n: "S.R. Nagar", lat: 17.4431, lng: 78.4407 },
  {
    n: "Ameerpet ★",
    lat: 17.4356,
    lng: 78.4447,
    info: "Heart of the Metro network. Massive multi-level elevated interchange between Red Line (Miyapur–LB Nagar) and Blue Line (Nagole–Raidurg).",
  },
  { n: "Punjagutta", lat: 17.4285, lng: 78.4512 },
  { n: "Irrum Manzil", lat: 17.4205, lng: 78.454 },
  { n: "Khairatabad", lat: 17.4116, lng: 78.4609 },
  { n: "Lakdi-ka-pul", lat: 17.4038, lng: 78.4647 },
  { n: "Assembly", lat: 17.3981, lng: 78.4708 },
  { n: "Nampally", lat: 17.3923, lng: 78.4701 },
  { n: "Gandhi Bhavan", lat: 17.388, lng: 78.476 },
  { n: "Osmania Medical College", lat: 17.3824, lng: 78.479 },
  {
    n: "MG Bus Station ★",
    lat: 17.3781,
    lng: 78.48,
    info: "Major interchange connecting Red and Green Metro lines. Direct skywalk access to the MGBS inter-state bus terminal.",
  },
  { n: "Malakpet", lat: 17.377143, lng: 78.49406 },
  { n: "New Market", lat: 17.3734, lng: 78.5031 },
  { n: "Musarambagh", lat: 17.3711, lng: 78.512 },
  { n: "Dilsukhnagar", lat: 17.3686, lng: 78.5257 },
  { n: "Chaitanyapuri", lat: 17.3683, lng: 78.5358 },
  { n: "Victoria Memorial", lat: 17.3584, lng: 78.5445 },
  { n: "LB Nagar", lat: 17.3484, lng: 78.551 },
];

export const GREEN: Stop[] = [
  {
    n: "JBS Parade Ground ★",
    lat: 17.4445,
    lng: 78.4983,
    info: "Strategic northern interchange. Connects the Green Line (JBS–MGBS) with the Blue Line (Nagole–Raidurg). Directly adjacent to Jubilee Bus Station.",
  },
  { n: "Secunderabad West", lat: 17.434077, lng: 78.499926 },
  { n: "Gandhi Hospital", lat: 17.4248, lng: 78.5028 },
  { n: "Musheerabad", lat: 17.4186, lng: 78.5018 },
  { n: "RTC Cross Roads", lat: 17.4098, lng: 78.4978 },
  { n: "Chikkadpally", lat: 17.4025, lng: 78.4936 },
  { n: "Narayanguda", lat: 17.3948, lng: 78.4895 },
  { n: "Sultan Bazaar", lat: 17.3865, lng: 78.4845 },
  {
    n: "MG Bus Station ★",
    lat: 17.3781,
    lng: 78.48,
    info: "Major interchange connecting Green and Red Metro lines. Direct skywalk access to the MGBS inter-state bus terminal.",
  },
];

export const BLUE: Stop[] = [
  { n: "Nagole", lat: 17.390031, lng: 78.558767 },
  { n: "Uppal", lat: 17.399202, lng: 78.560164 },
  { n: "Stadium", lat: 17.4072, lng: 78.5542 },
  { n: "NGRI", lat: 17.4147, lng: 78.5464 },
  { n: "Habsiguda", lat: 17.4192, lng: 78.5414 },
  { n: "Tarnaka", lat: 17.428503, lng: 78.527822 },
  { n: "Mettuguda", lat: 17.4355, lng: 78.5196 },
  { n: "Secunderabad East", lat: 17.4357, lng: 78.5055 },
  {
    n: "Parade Ground ★",
    lat: 17.4432,
    lng: 78.4975,
    info: "Key northern interchange. Connects the Blue Line (Nagole–Raidurg) with the Green Line (JBS–MGBS).",
  },
  { n: "Paradise", lat: 17.4435, lng: 78.4851 },
  { n: "Rasoolpura", lat: 17.4433, lng: 78.4758 },
  { n: "Prakash Nagar", lat: 17.4449, lng: 78.4653 },
  { n: "Begumpet", lat: 17.4375, lng: 78.4567 },
  {
    n: "Ameerpet ★",
    lat: 17.4356,
    lng: 78.4447,
    info: "Heart of the Metro network. Massive multi-level elevated interchange between Blue Line (Nagole–Raidurg) and Red Line (Miyapur–LB Nagar).",
  },
  { n: "Madhura Nagar", lat: 17.436802, lng: 78.439358 },
  { n: "Yusufguda", lat: 17.435, lng: 78.4264 },
  { n: "Road No. 5 Jubilee Hills", lat: 17.4301, lng: 78.4231 },
  { n: "Jubilee Hills Check Post", lat: 17.4282, lng: 78.4137 },
  { n: "Peddamma Gudi", lat: 17.4307, lng: 78.4084 },
  { n: "Madhapur", lat: 17.4372, lng: 78.4005 },
  { n: "Durgam Cheruvu", lat: 17.4428, lng: 78.3875 },
  { n: "HITEC City", lat: 17.4481, lng: 78.3831 },
  { n: "Raidurg", lat: 17.4422, lng: 78.3773 },
];

export const MMTS_STATIONS: Stop[] = [
  { n: "Secunderabad Jn.", lat: 17.4337, lng: 78.5016 },
  { n: "James Street", lat: 17.4329, lng: 78.4868 },
  { n: "Sanjeevaiah Park", lat: 17.4357, lng: 78.4764 },
  { n: "Necklace Road", lat: 17.4233, lng: 78.4632 },
  { n: "Khairtabad (MMTS)", lat: 17.413, lng: 78.4611 },
  { n: "Lakdi-ka-pul (MMTS)", lat: 17.4038, lng: 78.4635 },
  { n: "Hyderabad / Nampally", lat: 17.3924, lng: 78.4675 },
  { n: "Begumpet (MMTS)", lat: 17.4387, lng: 78.4586 },
  { n: "Nature Cure Hospital", lat: 17.4458, lng: 78.4529 },
  { n: "Fateh Nagar", lat: 17.4565, lng: 78.4501 },
  { n: "Bharat Nagar (MMTS)", lat: 17.4618, lng: 78.4312 },
  { n: "Borabanda", lat: 17.4591, lng: 78.4079 },
  { n: "Hi-Tech City (MMTS)", lat: 17.4685, lng: 78.3844 },
  { n: "Hafizpet", lat: 17.4826, lng: 78.3633 },
  { n: "Chandanagar", lat: 17.4874, lng: 78.3327 },
  { n: "Lingampalli", lat: 17.4833, lng: 78.3167 },
  { n: "Kachiguda (MMTS)", lat: 17.3896, lng: 78.4998 },
  { n: "Vidyanagar", lat: 17.4025, lng: 78.5117 },
  { n: "Jamia Osmania", lat: 17.4113, lng: 78.5183 },
  { n: "Arts College", lat: 17.4182, lng: 78.52 },
  { n: "Sitaphalmandi", lat: 17.428, lng: 78.5198 },
  { n: "Malakpet (MMTS)", lat: 17.376133, lng: 78.494757 },
  { n: "Dabirpura", lat: 17.3662, lng: 78.4905 },
  { n: "Yakutpura", lat: 17.3601, lng: 78.4922 },
  { n: "Huppuguda", lat: 17.3411, lng: 78.4824 },
  { n: "Falaknuma", lat: 17.3327, lng: 78.4752 },
];

// Railway corridors the MMTS runs on, as drawn lines (not a schedule).
export const MMTS_ROUTES: [number, number][][] = [
  // R1: Secunderabad <-> Lingampalli (western corridor via Begumpet)
  [
    [17.4337, 78.5016], [17.4329, 78.4868], [17.4387, 78.4586],
    [17.4458, 78.4529], [17.4565, 78.4501], [17.4618, 78.4312],
    [17.4591, 78.4079], [17.4685, 78.3844], [17.4826, 78.3633],
    [17.4874, 78.3327], [17.4833, 78.3167],
  ],
  // R2: Hyderabad (Nampally) <-> Begumpet (central branch)
  [
    [17.3924, 78.4675], [17.4038, 78.4635], [17.413, 78.4611],
    [17.4233, 78.4632], [17.4357, 78.4764], [17.4329, 78.4868],
    [17.4387, 78.4586],
  ],
  // R3: Secunderabad <-> Falaknuma (north-south corridor)
  [
    [17.4337, 78.5016], [17.428, 78.5198], [17.4182, 78.52],
    [17.4113, 78.5183], [17.4025, 78.5117], [17.3896, 78.4998],
    [17.3761, 78.4948], [17.3662, 78.4905], [17.3601, 78.4922],
    [17.3411, 78.4824], [17.3327, 78.4752],
  ],
];

export const HUBS: Hub[] = [
  { n: "Secunderabad Junction", cat: "train", lat: 17.4337, lng: 78.5016, info: "Hyderabad's primary rail hub. Connects to all major Indian cities. Interchange for Metro Blue/Green lines and MMTS." },
  { n: "Kacheguda", cat: "train", lat: 17.3896, lng: 78.4998, info: "Heritage terminal. Major hub for south-bound long-distance trains. Managed by South Central Railway." },
  { n: "Hyderabad Deccan (Nampally)", cat: "train", lat: 17.3924, lng: 78.4675, info: "City-centre terminal. Primary station for major express trains. Direct walkway to Metro Red Line." },
  { n: "Lingampalli Station", cat: "train", lat: 17.4829, lng: 78.3168, info: "Western suburbs rail hub. Major stop for Mumbai-bound trains. Western terminus for MMTS Phase 1." },
  { n: "Cherlapally Station", cat: "train", lat: 17.4575, lng: 78.6056, info: "Satellite terminal for east Hyderabad, built to decongest Secunderabad Junction." },
  { n: "MGBS – Mahatma Gandhi", cat: "bus", lat: 17.3782, lng: 78.4848, info: "One of India's largest bus terminals. Major hub for TGSRTC and inter-state buses. Linked to Metro Red/Green lines via skywalk." },
  { n: "Jubilee Bus Station (JBS)", cat: "bus", lat: 17.447721, lng: 78.498415, info: "Primary hub for north-bound buses (Karimnagar, Nizamabad). Directly connected to Metro Green Line." },
  { n: "Rajiv Gandhi Intl. Airport", cat: "airport", lat: 17.2403, lng: 78.4294, info: "Hyderabad's primary international airport, at Shamshabad. No Metro connection yet — the airport corridor is still awaiting approval." },
  { n: "Begumpet Airport (historic)", cat: "airport", lat: 17.4496, lng: 78.4712, info: "Historic city airport. Now used for VIP flights, military operations, and the Wings India air show." },
  { n: "Hakimpet Air Force Station", cat: "airport", lat: 17.5533, lng: 78.5247, info: "Indian Air Force training base. Not a civilian airport." },
  { n: "Dundigal Air Force Academy", cat: "airport", lat: 17.6272, lng: 78.4033, info: "Training institute for IAF officers. Not a civilian airport." },
];

export const CATEGORY_META: Record<
  Category,
  { color: string; label: string; badge: string }
> = {
  red: { color: "#C0392B", label: "Metro — Red Line", badge: "M" },
  green: { color: "#1E8449", label: "Metro — Green Line", badge: "M" },
  blue: { color: "#1A5276", label: "Metro — Blue Line", badge: "M" },
  mmts: { color: "#7D3C98", label: "MMTS suburban rail", badge: "T" },
  train: { color: "#884EA0", label: "Railway station", badge: "R" },
  bus: { color: "#CB4335", label: "Bus terminal", badge: "B" },
  airport: { color: "#1F618D", label: "Airport / airbase", badge: "A" },
};

export const FILTER_ORDER: Category[] = [
  "red",
  "green",
  "blue",
  "mmts",
  "train",
  "bus",
  "airport",
];
