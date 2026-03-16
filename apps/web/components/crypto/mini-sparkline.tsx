"use client";

type MiniSparklineProps = {
  points: number[];
};

const VIEWBOX_WIDTH = 120;
const VIEWBOX_HEIGHT = 32;
const PADDING = 2;

function buildPolylinePoints(points: number[]): string {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min;
  const denominator = points.length > 1 ? points.length - 1 : 1;

  return points
    .map((value, index) => {
      const x = PADDING + ((VIEWBOX_WIDTH - PADDING * 2) * index) / denominator;
      const normalized = span === 0 ? 0.5 : (value - min) / span;
      const y = VIEWBOX_HEIGHT - PADDING - normalized * (VIEWBOX_HEIGHT - PADDING * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function MiniSparkline(props: MiniSparklineProps) {
  const { points } = props;

  if (points.length < 2) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const polyline = buildPolylinePoints(points);
  const stroke = points[points.length - 1] >= points[0] ? "#16a34a" : "#dc2626";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-8 w-[120px]"
      role="img"
      aria-label="7-day trend"
      preserveAspectRatio="none"
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
    </svg>
  );
}