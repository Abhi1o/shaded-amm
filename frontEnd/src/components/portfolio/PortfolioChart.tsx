'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';

type TimeRange = '24h' | '7d' | '30d' | 'all';

export function PortfolioChart() {
  const { portfolioHistory } = usePortfolioStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const filteredData = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;

    switch (timeRange) {
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
        cutoff = 0;
        break;
    }

    return portfolioHistory.filter((point) => point.timestamp >= cutoff);
  }, [portfolioHistory, timeRange]);

  const { minValue, maxValue, points } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minValue: 0, maxValue: 0, points: [] };
    }

    const values = filteredData.map((d) => Number(d.totalValue) / 1e9);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate SVG points
    const width = 800;
    const height = 300;
    const padding = 40;

    const xScale = (width - 2 * padding) / (filteredData.length - 1 || 1);
    const yScale = (height - 2 * padding) / (max - min || 1);

    const svgPoints = filteredData.map((point, index) => {
      const x = padding + index * xScale;
      const y = height - padding - (Number(point.totalValue) / 1e9 - min) * yScale;
      return { x, y, value: Number(point.totalValue) / 1e9, timestamp: point.timestamp };
    });

    return { minValue: min, maxValue: max, points: svgPoints };
  }, [filteredData]);

  const pathData = useMemo(() => {
    if (points.length === 0) return '';

    const path = points.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x} ${point.y}`;
    }).join(' ');

    return path;
  }, [points]);

  const areaPathData = useMemo(() => {
    if (points.length === 0) return '';

    const path = pathData;
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];

    return `${path} L ${lastPoint.x} 340 L ${firstPoint.x} 340 Z`;
  }, [pathData, points]);

  if (filteredData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Portfolio Performance</h3>
        </div>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No historical data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Portfolio Performance</h3>
        <div className="flex space-x-2">
          {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg width="100%" height="300" viewBox="0 0 800 300" preserveAspectRatio="none">
          {/* Grid lines */}
          <g className="grid-lines" stroke="#e5e7eb" strokeWidth="1">
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="40"
                y1={40 + i * 55}
                x2="760"
                y2={40 + i * 55}
                strokeDasharray="4 4"
              />
            ))}
          </g>

          {/* Area fill */}
          <path
            d={areaPathData}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis labels */}
          <g className="y-axis-labels" fill="#6b7280" fontSize="12">
            {[0, 1, 2, 3, 4].map((i) => {
              const value = maxValue - (i * (maxValue - minValue)) / 4;
              return (
                <text key={i} x="5" y={45 + i * 55} textAnchor="start">
                  {value.toFixed(2)}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Value range */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            Min: {minValue.toFixed(2)} SOL
          </div>
          <div>
            Max: {maxValue.toFixed(2)} SOL
          </div>
        </div>
      </div>
    </div>
  );
}
