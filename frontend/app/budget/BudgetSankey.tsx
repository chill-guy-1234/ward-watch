import { EXPENDITURE, INCOME, TOTAL, type FlowItem } from "./data";

// A fixed 3-column shape (income sources -> single GHMC hub -> expenditure
// categories) is simple enough to lay out by hand -- no need for a general
// graph-layout library (d3-sankey etc.) for something this shaped.

const WIDTH = 960;
const HEIGHT = 640;
const TOP = 16;
const COLUMN_HEIGHT = HEIGHT - TOP * 2;
const GAP = 4;
const BAR_W = 26;

const INCOME_X = 190;
const HUB_X0 = 460;
const HUB_X1 = 500;
const EXPENDITURE_X = 744;

// Brown/gold family, not a generic rainbow palette -- stays in the site's
// established theme even across ~20 data categories.
const PALETTE = [
  "#d9a021", "#8a5a2b", "#b8791e", "#6b4a2a", "#c98a3c", "#a0672a",
  "#e0aa2e", "#7a5518", "#caa04a", "#9c6b30", "#b58f4a", "#8c6239",
];

type LaidOutNode = FlowItem & { y0: number; y1: number; color: string };

function layout(items: FlowItem[]): LaidOutNode[] {
  const usable = COLUMN_HEIGHT - GAP * (items.length - 1);
  let y = TOP;
  return items.map((item, i) => {
    const h = (item.amount / TOTAL) * usable;
    const node = { ...item, y0: y, y1: y + h, color: PALETTE[i % PALETTE.length] };
    y += h + GAP;
    return node;
  });
}

function ribbon(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number) {
  const midX = (x0 + x1) / 2;
  return `M${x0},${y0a} C${midX},${y0a} ${midX},${y1a} ${x1},${y1a} L${x1},${y1b} C${midX},${y1b} ${midX},${y0b} ${x0},${y0b} Z`;
}

function fmt(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export default function BudgetSankey() {
  const income = layout(INCOME);
  const expenditure = layout(EXPENDITURE);

  return (
    <div className="sankey-scroll">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Sankey diagram of GHMC's FY 2025-26 budget: income sources flowing into total expenditure categories"
      >
        {/* ribbons: income -> hub */}
        {income.map((n) => (
          <path
            key={`in-${n.label}`}
            d={ribbon(INCOME_X + BAR_W, n.y0, n.y1, HUB_X0, n.y0, n.y1)}
            fill={n.color}
            opacity={0.45}
          >
            <title>{`${n.label}: ${fmt(n.amount)}`}</title>
          </path>
        ))}

        {/* ribbons: hub -> expenditure */}
        {expenditure.map((n) => (
          <path
            key={`out-${n.label}`}
            d={ribbon(HUB_X1, n.y0, n.y1, EXPENDITURE_X, n.y0, n.y1)}
            fill={n.color}
            opacity={0.45}
          >
            <title>{`${n.label}: ${fmt(n.amount)}`}</title>
          </path>
        ))}

        {/* hub */}
        <rect
          x={HUB_X0}
          y={TOP}
          width={HUB_X1 - HUB_X0}
          height={COLUMN_HEIGHT}
          fill="var(--accent)"
        >
          <title>{`GHMC Budget FY 2025-26: ${fmt(TOTAL)}`}</title>
        </rect>
        <text
          x={(HUB_X0 + HUB_X1) / 2}
          y={HEIGHT / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${(HUB_X0 + HUB_X1) / 2} ${HEIGHT / 2})`}
          className="sankey-hub-label"
        >
          GHMC Budget FY 2025-26 — {fmt(TOTAL)}
        </text>

        {/* income nodes + labels */}
        {income.map((n) => (
          <g key={n.label}>
            <rect x={INCOME_X} y={n.y0} width={BAR_W} height={n.y1 - n.y0} fill={n.color}>
              <title>{`${n.label}: ${fmt(n.amount)}`}</title>
            </rect>
            {n.y1 - n.y0 > 10 && (
              <text x={INCOME_X - 8} y={(n.y0 + n.y1) / 2} textAnchor="end" className="sankey-label">
                {n.label}
              </text>
            )}
          </g>
        ))}

        {/* expenditure nodes + labels */}
        {expenditure.map((n) => (
          <g key={n.label}>
            <rect x={EXPENDITURE_X} y={n.y0} width={BAR_W} height={n.y1 - n.y0} fill={n.color}>
              <title>{`${n.label}: ${fmt(n.amount)}`}</title>
            </rect>
            {n.y1 - n.y0 > 10 && (
              <text
                x={EXPENDITURE_X + BAR_W + 8}
                y={(n.y0 + n.y1) / 2}
                textAnchor="start"
                className="sankey-label"
              >
                {n.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
