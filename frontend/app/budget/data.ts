// GHMC Budget FY 2025-26 -- income and expenditure, hand-transcribed from the
// ONE clean, non-restated table pair in the source PDF ("Budget Highlights
// FY 2025-26: Income" / "...: Expenditure", pages 30-31 of the ingested
// budget PDF) rather than the extraction agent's output, which duplicates
// figures restated across multiple tables elsewhere in the same document
// (see README's "5x" note). Both sides sum to exactly Rs. 8,440 crore, the
// same verified total the chatbot cites -- checked by hand, not assumed.
//
// Minor line items (individually under ~Rs. 100cr, together under 3% of the
// total on either side) are grouped into "Other Income" / "Other
// Expenditure" for a readable diagram, not hidden -- every rupee is still
// counted, just not given its own sliver. Expenditure additionally merges
// same-named Revenue and Capital lines (e.g. "Street Lighting" appears as
// two separate rows in the source, revenue + capital account heads) into
// one figure, since that split is a budgeting technicality unrelated to
// where the money actually goes.

export type FlowItem = { label: string; amount: number };

export const TOTAL = 8440.0;

export const INCOME: FlowItem[] = [
  { label: "Capital Grant from State Govt.", amount: 3000.0 },
  { label: "Tax Revenues", amount: 2029.81 },
  { label: "Town Planning Fees", amount: 1201.15 },
  { label: "SFC Grants", amount: 800.0 },
  { label: "Borrowings", amount: 700.0 },
  { label: "XVth FC Grants", amount: 279.0 },
  { label: "Trade Licenses", amount: 112.0 },
  { label: "Mutation Fee", amount: 105.0 },
  { label: "Other Income", amount: 213.04 },
];

export const EXPENDITURE: FlowItem[] = [
  { label: "Roads / Bridges / H-CITI", amount: 1690.0 },
  { label: "Debt Servicing", amount: 1933.0 },
  { label: "Establishment", amount: 1680.9 },
  { label: "Solid Waste Management", amount: 687.0 },
  { label: "Green Budget", amount: 453.0 },
  { label: "Nalas / SNDP (drainage)", amount: 408.0 },
  { label: "Street Lighting", amount: 344.0 },
  { label: "Operation & Maintenance", amount: 307.0 },
  { label: "Land Acquisition", amount: 283.0 },
  { label: "Sanitation", amount: 226.0 },
  { label: "Administrative Expenses", amount: 212.5 },
  { label: "Other Expenditure", amount: 215.6 },
];
