import Link from "next/link";
import BudgetSankey from "./BudgetSankey";
import { EXPENDITURE, INCOME, TOTAL } from "./data";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
}

export default function BudgetPage() {
  return (
    <div className="budget-page">
      <p className="muted">
        Where GHMC&apos;s FY 2025-26 budget (₹8,440 crore) comes from and
        where it goes — city-level, not zone or ward-level. Hyderabad has no
        published zone/circle/ward-wise budget breakdown, unlike some other
        Indian cities; see &quot;Why city-level&quot; below.
      </p>

      <BudgetSankey />

      <details className="budget-note">
        <summary>Why city-level, not zone or ward-level</summary>
        <p>
          GHMC has published only city-wide combined budgets for at least the
          last 11 years (2014-15 through 2025-26) — no zone-specific or
          circle-specific budget documents exist. CMC has no published budget
          yet (formed February 2026). MMC has a proposed 2026-27 total
          (₹2,586.67cr, discussed at a standing committee) but no category
          breakdown has been published — a headline figure, not a line-item
          budget. If any of that changes, this page is exactly where a
          zone-wise version would go.
        </p>
      </details>

      <div className="budget-tables">
        <table className="budget-table">
          <caption>Income</caption>
          <thead>
            <tr>
              <th>Source</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {INCOME.map((i) => (
              <tr key={i.label}>
                <td>{i.label}</td>
                <td>{fmt(i.amount)}</td>
              </tr>
            ))}
            <tr className="budget-table-total">
              <td>Total</td>
              <td>{fmt(TOTAL)}</td>
            </tr>
          </tbody>
        </table>

        <table className="budget-table">
          <caption>Expenditure</caption>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {EXPENDITURE.map((e) => (
              <tr key={e.label}>
                <td>{e.label}</td>
                <td>{fmt(e.amount)}</td>
              </tr>
            ))}
            <tr className="budget-table-total">
              <td>Total</td>
              <td>{fmt(TOTAL)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="muted budget-source">
        Source: GHMC Budget Estimates 2025-26, &quot;Budget Highlights FY
        2025-26&quot; (Income p.30, Expenditure p.31). Why these figures
        and not the chatbot&apos;s raw extraction:{" "}
        <Link href="/sources">Data &amp; Sources</Link>.
      </p>
    </div>
  );
}
