import { useEffect, useState, useMemo } from 'react';
import { usageStatisticsApi, UsageRecordItem } from '@/services/api/usageStatistics';
import {
  IconCheckCircle2,
  IconAlertTriangle,
  IconRefreshCw,
  IconChevronLeft,
} from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import styles from './UsageStatisticsPage.module.scss';

const getMaskedKeyParts = (key: string) => {
  if (!key) return { prefix: '', middle: '', suffix: '' };
  if (key.length <= 12) {
    return {
      prefix: key.substring(0, 3),
      middle: key.substring(3, key.length - 3),
      suffix: key.substring(key.length - 3),
    };
  }
  return {
    prefix: key.substring(0, 7),
    middle: key.substring(7, key.length - 4),
    suffix: key.substring(key.length - 4),
  };
};

const renderMaskedValue = (val: string | undefined, defaultVal = '-') => {
  if (!val) {
    return <span className={styles.keyText}>{defaultVal}</span>;
  }
  const isKey = val.length > 20 || val.startsWith('sk-');
  if (isKey) {
    const { prefix, middle, suffix } = getMaskedKeyParts(val);
    return (
      <span className={styles.maskedKeyWrapper} title={val}>
        <span className={styles.keyPart}>{prefix}</span>
        <span className={styles.keyPartBlurred}>{middle}</span>
        <span className={styles.keyPart}>{suffix}</span>
      </span>
    );
  }
  return <span className={styles.sourceText} title={val}>{val}</span>;
};

export function UsageStatisticsPage() {
  const [records, setRecords] = useState<UsageRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [heatmapPeriod, setHeatmapPeriod] = useState('week');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: number; count: number; dateStr: string } | null>(null);
  const [hoveredModelName, setHoveredModelName] = useState<string | null>(null);
  
  const pageSize = 15;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await usageStatisticsApi.getUsage();
      setRecords(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage records');
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh keeps loading state untouched (used by the auto-refresh
  // timer so the page does not flicker every interval).
  const refreshDataSilently = async () => {
    try {
      const data = await usageStatisticsApi.getUsage();
      setRecords(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage records');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh the request history detail every 6 seconds so the page
  // stays current without a manual refresh button.
  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshDataSilently();
    }, 6 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Dynamic provider list for filter select options
  const providerOptions = useMemo(() => {
    const providers = Array.from(new Set(records.map((r) => r.provider).filter(Boolean)));
    return [
      { value: 'all', label: '全部渠道' },
      ...providers.map((p) => ({ value: p, label: p })),
    ];
  }, [records]);

  // Dynamic model list for filter select options
  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(records.map((r) => r.model).filter(Boolean)));
    return [
      { value: 'all', label: '全部模型' },
      ...models.map((m) => ({ value: m, label: m })),
    ];
  }, [records]);

  // Filtered records (synchronized with global heatmapPeriod)
  const filteredRecords = useMemo(() => {
    // The window is anchored when the period or records change, not on every paint.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    let periodLimitMs = 0;
    if (heatmapPeriod === 'day') periodLimitMs = 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === '3days') periodLimitMs = 3 * 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === 'week') periodLimitMs = 7 * 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === 'month') periodLimitMs = 30 * 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === '3months') periodLimitMs = 90 * 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === '6months') periodLimitMs = 180 * 24 * 60 * 60 * 1000;
    else if (heatmapPeriod === 'year') periodLimitMs = 365 * 24 * 60 * 60 * 1000;

    return records.filter((r) => {
      // 时间段筛选 (同步全局选择的周期)
      if (periodLimitMs > 0) {
        const itemDate = new Date(r.timestamp).getTime();
        if (itemDate < now - periodLimitMs) return false;
      }

      // 状态筛选
      if (statusFilter === 'success' && r.failed) return false;
      if (statusFilter === 'failed' && !r.failed) return false;

      // 渠道筛选
      if (providerFilter !== 'all' && r.provider !== providerFilter) return false;

      // 模型筛选
      if (modelFilter !== 'all' && r.model !== modelFilter) return false;

      return true;
    });
  }, [records, heatmapPeriod, statusFilter, providerFilter, modelFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  // Adjust page index when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, providerFilter, modelFilter, heatmapPeriod]);

  // Chinese token units formatter
  const formatTokensChinese = (num: number) => {
    if (num >= 100000000) {
      return `${(num / 100000000).toFixed(1)} 亿`;
    }
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)} 万`;
    }
    return num.toLocaleString();
  };

  // Latency duration formatter
  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0 秒';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} 小时`);
    if (mins > 0) parts.push(`${mins} 分`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} 秒`);
    return parts.join(' ');
  };

  // Streak calculator helper
  const calculateStreaks = (dates: string[]) => {
    if (dates.length === 0) return { currentStreak: 0, maxStreak: 0 };
    
    // Sort unique dates ascending
    const sorted = Array.from(new Set(dates)).sort();
    
    let maxStreak = 0;
    let currentStreak: number;
    
    const parseDate = (dStr: string) => {
      const [y, m, d] = dStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    
    const isConsecutive = (d1: Date, d2: Date) => {
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 1;
    };
    
    let tempStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDate(sorted[i - 1]);
      const curr = parseDate(sorted[i]);
      
      if (isConsecutive(prev, curr)) {
        tempStreak++;
      } else if (prev.getTime() !== curr.getTime()) {
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastDateStr = sorted[sorted.length - 1];
    const lastDate = parseDate(lastDateStr);
    lastDate.setHours(0, 0, 0, 0);
    
    if (lastDate.getTime() === today.getTime() || lastDate.getTime() === yesterday.getTime()) {
      let count = 1;
      let checkIdx = sorted.length - 1;
      while (checkIdx > 0) {
        const curr = parseDate(sorted[checkIdx]);
        const prev = parseDate(sorted[checkIdx - 1]);
        if (isConsecutive(prev, curr)) {
          count++;
          checkIdx--;
        } else if (prev.getTime() === curr.getTime()) {
          checkIdx--;
        } else {
          break;
        }
      }
      currentStreak = count;
    } else {
      currentStreak = 0;
    }
    
    return { currentStreak, maxStreak };
  };

  // Calculations for Bento Cards and daily/hourly activity, filtered by the selected period
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    if (total === 0) {
      return {
        total,
        successRate: 100,
        totalTokens: 0,
        avgLatency: 0,
        avgTtft: 0,
        peakTokens: 0,
        maxLatencyMs: 0,
        cacheHitRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        modelCounts: {} as Record<string, number>,
        dailyTokens: {} as Record<string, number>,
        dailyRequests: {} as Record<string, number>,
        hourlyTokens: {} as Record<string, number>,
        hourlyRequests: {} as Record<string, number>,
      };
    }

    let failedCount = 0;
    let tokensSum = 0;
    let latencySum = 0;
    let ttftSum = 0;
    let latencyCount = 0;
    let ttftCount = 0;
    let peakTokens = 0;
    let maxLatencyMs = 0;
    let cacheTokens = 0;
    let inputTokensSum = 0;
    const modelCounts: Record<string, number> = {};
    const dailyTokens: Record<string, number> = {};
    const dailyRequests: Record<string, number> = {};
    const hourlyTokens: Record<string, number> = {};
    const hourlyRequests: Record<string, number> = {};

    filteredRecords.forEach((r) => {
      if (r.failed) failedCount++;
      const tk = r.tokens?.total_tokens || 0;
      tokensSum += tk;
      if (tk > peakTokens) peakTokens = tk;
      const inTok = r.tokens?.input_tokens || 0;
      const cacheTok = r.tokens?.cache_read_tokens || r.tokens?.cached_tokens || 0;
      inputTokensSum += inTok;
      cacheTokens += cacheTok;
      
      if (r.latency_ms > 0) {
        latencySum += r.latency_ms;
        latencyCount++;
        if (r.latency_ms > maxLatencyMs) maxLatencyMs = r.latency_ms;
      }
      if (r.ttft_ms > 0) {
        ttftSum += r.ttft_ms;
        ttftCount++;
      }

      modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;

      // Calculate daily sums
      const d = new Date(r.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyTokens[dateStr] = (dailyTokens[dateStr] || 0) + tk;
      dailyRequests[dateStr] = (dailyRequests[dateStr] || 0) + 1;

      // Calculate hourly sums
      const hourStr = String(d.getHours()).padStart(2, '0');
      const hourlyKey = `${dateStr} ${hourStr}`;
      hourlyTokens[hourlyKey] = (hourlyTokens[hourlyKey] || 0) + tk;
      hourlyRequests[hourlyKey] = (hourlyRequests[hourlyKey] || 0) + 1;
    });

    const { currentStreak, maxStreak } = calculateStreaks(Object.keys(dailyRequests));

    return {
      total,
      successRate: Number((((total - failedCount) / total) * 100).toFixed(2)),
      totalTokens: tokensSum,
      avgLatency: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      avgTtft: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : 0,
      peakTokens,
      maxLatencyMs,
      cacheHitRate: inputTokensSum > 0 ? Number(((cacheTokens / inputTokensSum) * 100).toFixed(2)) : 0,
      currentStreak,
      maxStreak,
      modelCounts,
      dailyTokens,
      dailyRequests,
      hourlyTokens,
      hourlyRequests,
    };
  }, [filteredRecords]);

  // Generate trend chart data based on selected period
  const chartData = useMemo(() => {
    const points: { label: string; value: number; count: number; dateStr: string }[] = [];
    // Same clock snapshot as the filtered window: recompute only when inputs change.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    
    if (heatmapPeriod === 'day') {
      // Last 24 hours, grouped by hour
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 60 * 60 * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hourStr = String(d.getHours()).padStart(2, '0');
        const key = `${dateStr} ${hourStr}`;
        
        points.push({
          label: `${hourStr}:00`,
          value: stats.hourlyTokens[key] || 0,
          count: stats.hourlyRequests[key] || 0,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日 ${hourStr}:00`,
        });
      }
    } else if (heatmapPeriod === '3days') {
      // Last 3 days (72 hours), grouped by 3-hour blocks (24 points)
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 3 * 60 * 60 * 1000);
        let aggregatedTokens = 0;
        let aggregatedRequests = 0;
        for (let h = 0; h < 3; h++) {
          const tempD = new Date(d.getTime() - h * 60 * 60 * 1000);
          const dateStr = `${tempD.getFullYear()}-${String(tempD.getMonth() + 1).padStart(2, '0')}-${String(tempD.getDate()).padStart(2, '0')}`;
          const hourStr = String(tempD.getHours()).padStart(2, '0');
          const key = `${dateStr} ${hourStr}`;
          aggregatedTokens += stats.hourlyTokens[key] || 0;
          aggregatedRequests += stats.hourlyRequests[key] || 0;
        }
        
        const hourStr = String(d.getHours()).padStart(2, '0');
        points.push({
          label: `${d.getDate()}日 ${hourStr}:00`,
          value: aggregatedTokens,
          count: aggregatedRequests,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日 ${hourStr}:00`,
        });
      }
    } else if (heatmapPeriod === 'week') {
      // Last 7 days, grouped by day
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        points.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: stats.dailyTokens[dateStr] || 0,
          count: stats.dailyRequests[dateStr] || 0,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
        });
      }
    } else if (heatmapPeriod === 'month') {
      // Last 30 days, grouped by day
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        points.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: stats.dailyTokens[dateStr] || 0,
          count: stats.dailyRequests[dateStr] || 0,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
        });
      }
    } else if (heatmapPeriod === '3months') {
      // Last 90 days, grouped by day
      for (let i = 89; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        points.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: stats.dailyTokens[dateStr] || 0,
          count: stats.dailyRequests[dateStr] || 0,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
        });
      }
    } else if (heatmapPeriod === '6months') {
      // Last 180 days, grouped by week (26 points)
      for (let i = 25; i >= 0; i--) {
        const d = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
        let aggregatedTokens = 0;
        let aggregatedRequests = 0;
        for (let w = 0; w < 7; w++) {
          const tempD = new Date(d.getTime() - w * 24 * 60 * 60 * 1000);
          const dateStr = `${tempD.getFullYear()}-${String(tempD.getMonth() + 1).padStart(2, '0')}-${String(tempD.getDate()).padStart(2, '0')}`;
          aggregatedTokens += stats.dailyTokens[dateStr] || 0;
          aggregatedRequests += stats.dailyRequests[dateStr] || 0;
        }
        
        points.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: aggregatedTokens,
          count: aggregatedRequests,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日当周`,
        });
      }
    } else {
      // Last year (365 days), grouped by week (52 points)
      for (let i = 51; i >= 0; i--) {
        const d = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
        let aggregatedTokens = 0;
        let aggregatedRequests = 0;
        for (let w = 0; w < 7; w++) {
          const tempD = new Date(d.getTime() - w * 24 * 60 * 60 * 1000);
          const dateStr = `${tempD.getFullYear()}-${String(tempD.getMonth() + 1).padStart(2, '0')}-${String(tempD.getDate()).padStart(2, '0')}`;
          aggregatedTokens += stats.dailyTokens[dateStr] || 0;
          aggregatedRequests += stats.dailyRequests[dateStr] || 0;
        }
        
        points.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: aggregatedTokens,
          count: aggregatedRequests,
          dateStr: `${d.getMonth() + 1}月${d.getDate()}日当周`,
        });
      }
    }
    
    return points;
  }, [stats.dailyTokens, stats.dailyRequests, stats.hourlyTokens, stats.hourlyRequests, heatmapPeriod]);

  // Max value of the chart
  const maxChartVal = useMemo(() => {
    const vals = chartData.map((p) => p.value);
    return vals.length > 0 ? Math.max(...vals, 0) || 1 : 1;
  }, [chartData]);

    // Map data to SVG coordinates (Canvas: 1000x250, padding: X=[60, 960], Y=[45, 215])
    const pointsCoordinates = useMemo(() => {
      const xPaddingStart = 70;
      const xPaddingEnd = 970;
      const yPaddingTop = 45;
      const yPaddingBottom = 215;
    
    const chartWidth = xPaddingEnd - xPaddingStart;
    const chartHeight = yPaddingBottom - yPaddingTop;
    
    return chartData.map((p, idx) => {
      const divisor = chartData.length - 1 || 1;
      const x = xPaddingStart + (idx / divisor) * chartWidth;
      const y = yPaddingBottom - (p.value / maxChartVal) * chartHeight;
      return {
        x,
        y,
        label: p.label,
        value: p.value,
        count: p.count,
        dateStr: p.dateStr,
      };
    });
  }, [chartData, maxChartVal]);

  const linePath = useMemo(() => {
    if (pointsCoordinates.length === 0) return '';
    let path = `M ${pointsCoordinates[0].x} ${pointsCoordinates[0].y}`;
    for (let i = 0; i < pointsCoordinates.length - 1; i++) {
      const p0 = pointsCoordinates[i];
      const p1 = pointsCoordinates[i + 1];
      // Control points for a horizontal cubic Bezier spline
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [pointsCoordinates]);

  const areaPath = useMemo(() => {
    if (pointsCoordinates.length === 0) return '';
    const lastX = pointsCoordinates[pointsCoordinates.length - 1].x;
    const firstX = pointsCoordinates[0].x;
    return `${linePath} L ${lastX} 215 L ${firstX} 215 Z`;
  }, [pointsCoordinates, linePath]);

  // Selected X labels to avoid crowding (shows start, 25%, 50%, 75%, and end)
  const xLabelsIndices = useMemo(() => {
    const total = chartData.length;
    if (total <= 5) {
      return Array.from({ length: total }).map((_, i) => i);
    }
    return [
      0,
      Math.floor(total * 0.25),
      Math.floor(total * 0.5),
      Math.floor(total * 0.75),
      total - 1,
    ];
  }, [chartData]);

  // Donut chart segments calculations for model distribution
  const pieSlices = useMemo(() => {
    const modelCounts = stats.modelCounts;
    const sorted = Object.entries(modelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
      
    const modelTotal = sorted.reduce((sum, item) => sum + item.count, 0);
    if (modelTotal === 0) return [];
    
    // Show the top 5 models directly (no "其他模型" aggregation).
    const top = sorted.slice(0, 5);
    
    const data = top.map((item) => ({
      name: item.name,
      count: item.count,
      // Keep two decimals so tiny slices (e.g. < 0.5%) never render as 0%.
      percentage: Math.round((item.count / modelTotal) * 10000) / 100,
    }));

    const sliceColors = [
      '#8b5cf6', // Vivid Purple
      '#f59e0b', // Amber
      '#10b981', // Emerald Green
      '#ec4899', // Hot Pink
      '#38bdf8', // Sky Blue
      '#64748b', // Slate Gray
    ];

    let accumulatedAngle = 0;
    const cx = 120;
    const cy = 120;
    const R = 80;    // Outer radius
    const r_in = 56; // Inner radius (concentric donut hole)

    return data.map((item, idx) => {
      const angle = (item.count / modelTotal) * 360;
      // Clamp angle slightly below 360 to prevent SVG arc coordinate zero-length bug
      const safeAngle = angle >= 360 ? 359.99 : angle;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + safeAngle;
      accumulatedAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      // Outer boundary coordinates
      const x_out_1 = cx + R * Math.cos(startRad);
      const y_out_1 = cy + R * Math.sin(startRad);
      const x_out_2 = cx + R * Math.cos(endRad);
      const y_out_2 = cy + R * Math.sin(endRad);

      // Inner boundary coordinates
      const x_in_1 = cx + r_in * Math.cos(startRad);
      const y_in_1 = cy + r_in * Math.sin(startRad);
      const x_in_2 = cx + r_in * Math.cos(endRad);
      const y_in_2 = cy + r_in * Math.sin(endRad);

      const largeArcFlag = safeAngle > 180 ? 1 : 0;
      // SVG path for a perfect donut wedge
      const pathData = `M ${x_out_1} ${y_out_1} A ${R} ${R} 0 ${largeArcFlag} 1 ${x_out_2} ${y_out_2} L ${x_in_2} ${y_in_2} A ${r_in} ${r_in} 0 ${largeArcFlag} 0 ${x_in_1} ${y_in_1} Z`;

      // Bisector angle for organic pop-out translation
      const midRad = ((startAngle + safeAngle / 2 - 90) * Math.PI) / 180;
      const tx = 5 * Math.cos(midRad);
      const ty = 5 * Math.sin(midRad);
      
      return {
        ...item,
        pathData,
        tx,
        ty,
        color: sliceColors[idx % sliceColors.length],
      };
    });
  }, [stats.modelCounts]);

  const activeSlice = useMemo(() => {
    return hoveredModelName ? pieSlices.find((s) => s.name === hoveredModelName) : null;
  }, [pieSlices, hoveredModelName]);



  return (
    <div className={styles.container}>
      {/* Decorative Orbs */}
      <div className={styles.backgroundOrbs}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>使用统计</h1>
          <p className={styles.description}>查看并分析经由 CLIProxyAPI 的所有 API 请求用量、耗时与模型分布账本</p>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Bento Grid Metrics: Advanced Streak & Tokens */}
      <div className={styles.bentoGrid}>
        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{formatTokensChinese(stats.totalTokens)}</span>
            <span className={styles.bentoLabel}>累计 Token 数</span>
            <span className={styles.bentoSublabel}>总计消耗用量</span>
          </div>
        </Card>

        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{formatTokensChinese(stats.peakTokens)}</span>
            <span className={styles.bentoLabel}>单次峰值 Token</span>
            <span className={styles.bentoSublabel}>单次请求最高用量</span>
          </div>
        </Card>

        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{formatDuration(stats.maxLatencyMs)}</span>
            <span className={styles.bentoLabel}>最长单次耗时</span>
            <span className={styles.bentoSublabel}>最长任务处理时间</span>
          </div>
        </Card>

        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{stats.cacheHitRate}%</span>
            <span className={styles.bentoLabel}>缓存命中率</span>
            <span className={styles.bentoSublabel}>缓存节省的输入 Token 占比</span>
          </div>
        </Card>
      </div>

      {/* Bento Grid Metrics: Performance Stats */}
      <div className={styles.performanceGrid}>
        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{stats.total.toLocaleString()}</span>
            <span className={styles.bentoLabel}>总请求次数</span>
          </div>
        </Card>

        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue} style={{ color: 'var(--success-color)' }}>
              {stats.successRate.toFixed(2)}%
            </span>
            <span className={styles.bentoLabel}>请求成功率</span>
          </div>
        </Card>
        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{(stats.avgLatency / 1000).toFixed(2)} 秒</span>
            <span className={styles.bentoLabel}>平均请求耗时</span>
          </div>
        </Card>

        <Card className={styles.bentoCard}>
          <div className={styles.bentoContent}>
            <span className={styles.bentoValue}>{(stats.avgTtft / 1000).toFixed(2)} 秒</span>
            <span className={styles.bentoLabel}>平均首字响应时间</span>
          </div>
        </Card>
      </div>

      {/* Dynamic Double Charts Container */}
      <div className={styles.chartFlexLayout}>
        {/* Left: Token Activity Trend Chart */}
        <Card className={styles.trendCard}>
          <div className={styles.heatmapHeader}>
            <h2 className={styles.cardHeading}>Token 用量趋势</h2>
            <Select
              value={heatmapPeriod}
              options={[
                { value: 'day', label: '最近一天' },
                { value: '3days', label: '最近三天' },
                { value: 'week', label: '最近一周' },
                { value: 'month', label: '最近一月' },
                { value: '3months', label: '最近三月' },
                { value: '6months', label: '最近半年' },
                { value: 'year', label: '最近一年' },
              ]}
              onChange={setHeatmapPeriod}
              size="sm"
              className={styles.periodSelect}
            />
          </div>
          
          <div className={styles.chartContainer}>
            {/* SVG Canvas (Width 100%, Height 240px) */}
            <svg viewBox="0 0 1020 250" className={styles.trendSvg} width="100%" height="240">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.0" />
                </linearGradient>
                {/* Glow Filter for Premium Look */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid Lines */}
              <line x1="70" y1="45" x2="970" y2="45" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
              <line x1="70" y1="130" x2="970" y2="130" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
              <line x1="70" y1="215" x2="970" y2="215" stroke="var(--border-color)" strokeWidth="1" opacity="0.3" />

              {/* Y-Axis Labels */}
              <text x="60" y="49" textAnchor="end" fontSize="10" fill="var(--text-secondary)" opacity="0.6">
                {formatTokensChinese(maxChartVal)}
              </text>
              <text x="60" y="134" textAnchor="end" fontSize="10" fill="var(--text-secondary)" opacity="0.6">
                {formatTokensChinese(maxChartVal / 2)}
              </text>
              <text x="60" y="219" textAnchor="end" fontSize="10" fill="var(--text-secondary)" opacity="0.6">
                0
              </text>

              {/* Area Path */}
              {areaPath && (
                <path d={areaPath} fill="url(#areaGradient)" />
              )}

              {/* Line Path with Glow Shadow */}
              {linePath && (
                <>
                  <path d={linePath} fill="none" stroke="var(--primary-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" transform="translate(0, 2)" />
                  <path d={linePath} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                </>
              )}

              {/* Hover Guides (Crosshair style) */}
              {hoveredPoint && (
                <>
                  {/* Vertical Guide */}
                  <line
                    x1={hoveredPoint.x}
                    y1={45}
                    x2={hoveredPoint.x}
                    y2={215}
                    stroke="var(--primary-color)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.4"
                  />
                  {/* Horizontal Guide */}
                  <line
                    x1="70"
                    y1={hoveredPoint.y}
                    x2="970"
                    y2={hoveredPoint.y}
                    stroke="var(--primary-color)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.4"
                  />
                  {/* Glowing 3-layer dot */}
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="10"
                    fill="var(--primary-color)"
                    opacity="0.15"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="6"
                    fill="var(--primary-color)"
                    opacity="0.45"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="var(--primary-color)"
                    strokeWidth="2.5"
                  />
                </>
              )}

              {/* X-Axis Labels */}
              {xLabelsIndices.map((idx) => {
                const p = pointsCoordinates[idx];
                if (!p) return null;
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={237}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-secondary)"
                    opacity="0.7"
                  >
                    {p.label}
                  </text>
                );
              })}

              {/* Interactive Hover Zones */}
              {pointsCoordinates.map((p, idx) => {
                const colWidth = 900 / (pointsCoordinates.length - 1 || 1);
                const zoneX = p.x - colWidth / 2;
                return (
                  <rect
                    key={idx}
                    x={zoneX}
                    y={0}
                    width={colWidth}
                    height={235}
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </svg>

            {/* Glowing Float Tooltip */}
            {hoveredPoint && (
              <div
                className={styles.chartTooltip}
                style={{
                  left: `${hoveredPoint.x > 800 ? hoveredPoint.x - 170 : hoveredPoint.x + 10}px`,
                  top: `${hoveredPoint.y < 120 ? hoveredPoint.y + 10 : hoveredPoint.y - 70}px`
                }}
              >
                <div className={styles.tooltipDate}>{hoveredPoint.dateStr}</div>
                <div className={styles.tooltipValue}>用量：{hoveredPoint.value.toLocaleString()} Tokens</div>
                <div className={styles.tooltipCount}>请求次数：{hoveredPoint.count} 次</div>
              </div>
            )}
          </div>

          <div className={styles.heatmapFooter}>
            <span className={styles.footerNote}>
              {heatmapPeriod === 'day' && '自动计算近 1 天用量趋势'}
              {heatmapPeriod === '3days' && '自动计算近 3 天用量趋势'}
              {heatmapPeriod === 'week' && '自动计算近 7 天用量趋势'}
              {heatmapPeriod === 'month' && '自动计算近 30 天用量趋势'}
              {heatmapPeriod === '3months' && '自动计算近 90 天用量趋势'}
              {heatmapPeriod === '6months' && '自动计算近 180 天用量趋势'}
              {heatmapPeriod === 'year' && '自动计算近 365 天用量趋势'}
            </span>
          </div>
        </Card>

        {/* Right: Model Distribution Pie/Donut Chart */}
        <Card className={styles.donutCard}>
          <div className={styles.cardHeaderWithSub}>
            <h2 className={styles.cardHeading}>模型调用分布比例</h2>
            {activeSlice ? (
              <p className={styles.pieSubHeading} style={{ color: activeSlice.color }}>
                {activeSlice.name}：<strong>{activeSlice.count.toLocaleString()}</strong> 次 ({activeSlice.percentage.toFixed(2)}%)
              </p>
            ) : (
              <p className={styles.pieSubHeading}>
                调用模型 <strong>TOP {pieSlices.length}</strong>
              </p>
            )}
          </div>
          <div className={styles.donutContentWrapper}>
            {pieSlices.length === 0 ? (
              <div className={styles.donutEmptyPlaceholder}>暂无模型分布数据</div>
            ) : (
              <>
                {/* SVG Donut Chart via Paths */}
                <div className={styles.donutSvgWrapper}>
                  <svg width="240" height="240" viewBox="0 0 240 240" className={styles.donutSvg}>
                    {/* Visual paths - purely for display, pointer events disabled to prevent shifting hover loops */}
                    {pieSlices.map((slice, idx) => {
                      const isHovered = hoveredModelName === slice.name;
                      return (
                        <path
                          key={`visual-${idx}`}
                          d={slice.pathData}
                          fill={slice.color}
                          stroke="var(--card-bg)"
                          strokeWidth="2.0"
                          strokeLinejoin="round"
                          className={styles.pieSlicePath}
                          style={{
                            opacity: hoveredModelName ? (isHovered ? 1.0 : 0.35) : 0.95,
                            transform: isHovered ? `translate(${slice.tx}px, ${slice.ty}px)` : 'none',
                            pointerEvents: 'none',
                          }}
                        />
                      );
                    })}

                    {/* Invisible target detector paths - static layout to capture hover events stably */}
                    {pieSlices.map((slice, idx) => {
                      return (
                        <path
                          key={`detector-${idx}`}
                          d={slice.pathData}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth="4.0"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredModelName(slice.name)}
                          onMouseLeave={() => setHoveredModelName(null)}
                        >
                          <title>{`${slice.name}：${slice.count} 次 (${slice.percentage.toFixed(2)}%)`}</title>
                        </path>
                      );
                    })}

                    {/* Dynamic Center text with pointer-events disabled */}
                    <g style={{ pointerEvents: 'none' }}>
                      {activeSlice ? (
                        <>
                          <text x="120" y="115" textAnchor="middle" className={styles.donutCenterValue}>
                            {activeSlice.percentage.toFixed(2)}%
                          </text>
                          <text 
                            x="120" 
                            y="136" 
                            textAnchor="middle" 
                            className={styles.donutCenterLabel} 
                            style={{ fill: activeSlice.color, opacity: 1, fontWeight: 600 }}
                          >
                            {activeSlice.name.length > 12 ? activeSlice.name.substring(0, 10) + '..' : activeSlice.name}
                          </text>
                        </>
                      ) : (
                        <>
                          <text x="120" y="126" textAnchor="middle" className={styles.donutCenterLabel}>
                            TOP {pieSlices.length} 模型
                          </text>
                        </>
                      )}
                    </g>
                  </svg>
                </div>

                {/* Legend list */}
                <div className={styles.donutLegendList}>
                  {pieSlices.map((slice, idx) => {
                    const isHovered = hoveredModelName === slice.name;
                    return (
                      <div
                        key={idx}
                        className={`${styles.legendItem} ${isHovered ? styles.legendItemActive : ''}`}
                        style={{
                          opacity: hoveredModelName && !isHovered ? 0.45 : 1,
                        }}
                        onMouseEnter={() => setHoveredModelName(slice.name)}
                        onMouseLeave={() => setHoveredModelName(null)}
                      >
                        <span className={styles.legendColor} style={{ backgroundColor: slice.color }} />
                        <span className={styles.legendName} title={slice.name}>
                          {slice.name}
                        </span>
                        <span className={styles.legendPercent}>
                          {slice.percentage.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Requests Details Table */}
      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.cardHeading}>请求历史记录明细</h2>
          <div className={styles.filterControls}>
            <Select
              value={statusFilter}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'success', label: '成功' },
                { value: 'failed', label: '失败' },
              ]}
              onChange={setStatusFilter}
              size="sm"
              className={styles.filterSelect}
            />
            <Select
              value={providerFilter}
              options={providerOptions}
              onChange={setProviderFilter}
              size="sm"
              className={styles.filterSelect}
            />
            <Select
              value={modelFilter}
              options={modelOptions}
              onChange={setModelFilter}
              size="sm"
              className={styles.filterSelect}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loadingPlaceholder}>
              <IconRefreshCw size={24} className={styles.spinning} />
              <p>正在拉取最新使用日志账本...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyPlaceholder}>
              <IconAlertTriangle size={32} />
              <p>暂无匹配的使用历史记录</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>渠道商/模型</th>
                  <th>状态</th>
                  <th>消耗 Tokens</th>
                  <th>耗时/TTFT</th>
                  <th>下游 Key/来源</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => {
                  const localTime = new Date(record.timestamp).toLocaleString();
                  return (
                    <tr key={record.id}>
                      <td className={styles.timeCell}>{localTime}</td>
                      <td>
                        <div className={styles.modelDetails}>
                          <span className={styles.providerBadge}>{record.provider}</span>
                          <span className={styles.modelText}>{record.model}</span>
                        </div>
                      </td>
                      <td>
                        {record.failed ? (
                          <span className={`${styles.statusBadge} ${styles.failed}`}>
                            <IconAlertTriangle size={12} />
                            失败
                          </span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.success}`}>
                            <IconCheckCircle2 size={12} />
                            成功
                          </span>
                        )}
                      </td>
                      <td>
                        <div className={styles.tokensDetails}>
                          <span className={styles.totalTokensText}>
                            {(record.tokens?.total_tokens || 0).toLocaleString()}
                          </span>
                          <span className={styles.tokensBreakdown}>
                            (输入 {record.tokens?.input_tokens} / 输出 {record.tokens?.output_tokens}
                            {record.tokens?.reasoning_tokens > 0 && ` / 思考 ${record.tokens?.reasoning_tokens}`}
                            {record.tokens?.cached_tokens > 0 && ` / 缓存 ${record.tokens?.cached_tokens}`})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.latencyDetails}>
                          <span>{(record.latency_ms / 1000).toFixed(2)} s</span>
                          <span className={styles.ttftText}>首字: {(record.ttft_ms / 1000).toFixed(2)} s</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.keyDetails}>
                          {renderMaskedValue(record.api_key, '-')}
                          {record.source && renderMaskedValue(record.source, '')}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={styles.paginationButton}
            >
              <IconChevronLeft size={16} />
              上一页
            </Button>
            <span className={styles.pageInfo}>
              第 {currentPage} / {totalPages} 页 (共 {filteredRecords.length} 条记录)
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={styles.paginationButton}
            >
              下一页
              <IconChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
