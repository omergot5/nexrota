import { useMemo } from "react";
import { SHIFT_TONES } from "../../design/shiftPalette.js";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Avatar, Card, EmptyState, PageHeader } from "../ui.jsx";
import { useTheme } from "../../hooks/useTheme.js";
import { loadTable } from "../../lib/loadTable.js";
import { t } from "../../lib/terms.js";

// Kept in its own module and loaded lazily — recharts is roughly half the
// bundle, and reports are never the first screen a supervisor opens.

const SHIFT_TYPES = [
  { type: "morning", label: "בוקר/יום", color: SHIFT_TONES.morning },
  { type: "afternoon", label: "צהריים", color: SHIFT_TONES.afternoon },
  { type: "night", label: "לילה", color: SHIFT_TONES.night },
];

// `loadTable` מדווח את ספירת הלילות לכל שומר בשדה `nights` (לא `night`),
// כדי לא להתנגש עם שם הטיפוס `night` ב-SHIFT_TYPES. הכינוי הזה שומר על
// תווית ה-Tooltip קריאה בלי לשכפל את מפת SHIFT_TYPES.
const TYPE_LABEL = {
  ...Object.fromEntries(SHIFT_TYPES.map((d) => [d.type, d.label])),
  nights: SHIFT_TYPES.find((d) => d.type === "night").label,
};

export default function AnalyticsDash({ guards, shifts }) {
  // Recharts styles its axes and tooltips through JS props, not CSS, so it
  // cannot read our custom properties — it has to be told the theme.
  const { resolved } = useTheme();
  const axis = resolved === "light" ? "#475569" : "#94A3B8";
  const grid = resolved === "light" ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)";
  const tooltipStyle = {
    background: resolved === "light" ? "#FFFFFF" : "#131C2D",
    border: `1px solid ${grid}`,
    borderRadius: 12,
    color: resolved === "light" ? "#0F172A" : "#F1F5F9",
    fontSize: 12,
    direction: "rtl",
  };

  // הטבלה היחידה שמזינה את שני התרשימים ואת טבלת הפירוט. אף מספר עומס
  // לא מחושב כאן — כולו מגיע דרך teamAverages() בתוך loadTable (01-03).
  const table = useMemo(() => loadTable(guards, shifts), [guards, shifts]);

  const typeStats = useMemo(
    () =>
      SHIFT_TYPES.map((d) => ({ name: d.label, color: d.color, value: table.byType[d.type] || 0 })).filter(
        (d) => d.value > 0
      ),
    [table]
  );

  if (!table.guardCount || table.totalAssigned === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="דוחות" subtitle="סטטיסטיקות עומס ומעקב" />
        <EmptyState
          icon="trending"
          title="אין עדיין נתונים"
          body="אחרי שתשבץ משמרות, כאן יופיעו גרפי עומס והתפלגות."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="דוחות"
        subtitle={`${table.totalAssigned} שיבוצים · ${table.guardCount} שומרים · ${t("unit.load")} ממוצע ${table.meanLoad}`}
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-content mb-4">משמרות לפי שומר</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={table.rows} layout="vertical" margin={{ right: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 11, fill: axis }} allowDecimals={false} stroke={grid} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11, fill: axis }} stroke={grid} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: grid }}
                formatter={(v, n) => [v, TYPE_LABEL[n] || n]}
              />
              <Bar dataKey="morning" stackId="a" fill={SHIFT_TONES.morning} />
              <Bar dataKey="afternoon" stackId="a" fill={SHIFT_TONES.afternoon} />
              <Bar dataKey="nights" stackId="a" fill={SHIFT_TONES.night} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* An explicit legend: the stacked bars are distinguished only by
              colour, which is not enough on its own. */}
          <div className="flex gap-4 justify-center mt-2 text-xs text-muted flex-wrap">
            {SHIFT_TYPES.map((d) => (
              <span key={d.type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: d.color }}
                  aria-hidden="true"
                />
                {d.label}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-content mb-4">התפלגות סוגי משמרות</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={typeStats}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
                stroke="none"
              >
                {typeStats.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h2 className="font-bold text-content mb-4">פירוט לפי שומר</h2>
        <table className="w-full text-sm min-w-[600px]">
          <caption className="sr-only">פירוט נטל, משמרות ושעות לכל שומר, ממוין מהעמוס ביותר בנטל</caption>
          <thead>
            <tr className="border-b border-hairline">
              {[
                "שומר",
                t("unit.load"),
                "בוקר/יום",
                "צהריים",
                t("unit.nights"),
                t("unit.shifts"),
                t("unit.hours"),
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={`py-2 px-3 font-medium text-muted ${h === "שומר" ? "text-right" : "text-center"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.guardId} className="border-b border-hairline last:border-0">
                <th scope="row" className="py-2.5 px-3 text-right font-normal">
                  <div className="flex items-center gap-2">
                    <Avatar id={r.guardId} name={r.fullName} size={24} />
                    <span className="font-medium text-content text-xs">{r.fullName}</span>
                  </div>
                </th>
                <td className="py-2.5 px-3 text-center font-bold text-content">{r.load}</td>
                <td className="py-2.5 px-3 text-center text-warn font-semibold">{r.morning}</td>
                <td className="py-2.5 px-3 text-center text-brand font-semibold">{r.afternoon}</td>
                <td className="py-2.5 px-3 text-center text-info font-semibold">{r.nights}</td>
                <td className="py-2.5 px-3 text-center text-muted">{r.count}</td>
                <td className="py-2.5 px-3 text-center text-muted">{r.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
