import React from 'react';
import { Icon } from 'lucide-react';

/**
 * StatCard – reusable component for displaying a metric.
 * Props:
 *  - title: string – label of the metric
 *  - value: string|number – main value displayed
 *  - Icon: React component – Lucide icon
 *  - colorClass: string – Tailwind background color class (e.g., 'bg-amber-600')
 */
export default function StatCard({ title, value, Icon, colorClass }) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl p-5 flex items-center shadow-md border border-white/10">
      <div className={`p-3 rounded-lg ${colorClass} text-white`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-300">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
