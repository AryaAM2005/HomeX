import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Checked with the dataviz palette validator against the white chart surface.
const SERIES_COLORS = ['#b8491c', '#1677c9'];
const GRID_COLOR = '#e2d5c2';
const TEXT_COLOR = '#5e5249';
const TICK_STYLE = { fill: TEXT_COLOR, fontSize: 16 };

function ChartTooltip({ active, payload, rows, unit }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-md">
      <p className="text-base text-ink-soft">{rows[payload[0].payload.index].label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-base">
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.name}: <strong>{entry.value}</strong> {unit}
        </p>
      ))}
    </div>
  );
}

function EndValue({ x, y, index, value, lastIndex }) {
  if (index !== lastIndex) return null;

  return (
    <text x={x + 8} y={y + 5} fill="#2b2420" fontSize={16} fontWeight={600}>
      {value}
    </text>
  );
}

function Legend({ series }) {
  return (
    <ul className="flex flex-wrap gap-x-4 text-base text-ink-soft">
      {series.map(({ key, label }, index) => (
        <li key={key} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-5 rounded"
            style={{ background: SERIES_COLORS[index] }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

// One measure per chart: these have different scales, so they never share an axis.
export default function VitalsChart({ title, unit, series, rows }) {
  const lastIndex = rows.length - 1;

  return (
    <figure className="rounded-2xl border border-line bg-white p-4">
      <figcaption className="mb-2">
        <h3 className="font-sans text-lg font-semibold">
          {title} <span className="font-normal text-ink-soft">({unit})</span>
        </h3>
        {series.length > 1 && <Legend series={series} />}
      </figcaption>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="index"
              tickFormatter={(index) => rows[index]?.day ?? ''}
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              minTickGap={40}
              padding={{ left: 16 }}
            />
            <YAxis
              width={48}
              domain={['auto', 'auto']}
              tickCount={4}
              tickFormatter={(value) => (Number.isInteger(value) ? value : value.toFixed(1))}
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<ChartTooltip rows={rows} unit={unit} />}
              cursor={{ stroke: TEXT_COLOR, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {series.map(({ key, label }, index) => (
              <Line
                key={key}
                dataKey={key}
                name={label}
                stroke={SERIES_COLORS[index]}
                strokeWidth={2}
                dot={{ r: 4, fill: SERIES_COLORS[index], stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                label={<EndValue lastIndex={lastIndex} />}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
