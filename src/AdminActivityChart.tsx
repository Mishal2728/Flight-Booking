import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Inquiry } from './services/apiClient';

type AdminActivityChartProps = {
  inquiries: Pick<Inquiry, 'created_at'>[];
  days: number;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AdminActivityChart({ inquiries, days }: AdminActivityChartProps) {
  const data = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const counts = new Map<string, number>();

    for (const inquiry of inquiries) {
      const createdAt = new Date(inquiry.created_at);
      if (!Number.isFinite(createdAt.getTime())) continue;
      const key = dateKey(createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (days - index - 1));
      return {
        day: date.toLocaleDateString('en-IN', days === 7
          ? { weekday: 'short' }
          : { day: 'numeric', month: 'short' }),
        inquiries: counts.get(dateKey(date)) ?? 0,
      };
    });
  }, [inquiries, days]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="inquiry-activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#74c8c6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#74c8c6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eff2f3" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          minTickGap={16}
          tick={{ fontSize: 11, fill: '#929ca5' }}
        />
        <YAxis hide allowDecimals={false} />
        <Tooltip contentStyle={{ border: '1px solid #e8eded', borderRadius: 8, fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="inquiries"
          name="Inquiries"
          stroke="#348f91"
          strokeWidth={2.5}
          fill="url(#inquiry-activity-fill)"
          animationDuration={280}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
