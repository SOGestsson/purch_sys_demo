import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { listRows, getSimInput, getForecastDirect, getRawSimulate } from '../api/items.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  ComposedChart,
  Line,
  Bar,
  Legend,
  Area,
  Brush,
} from 'recharts'

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString('is-IS', { maximumFractionDigits: decimals })
}

function StatBox({ label, value }) {
  return (
    <div className="bg-blue-50 rounded-xl p-3 text-center">
      <p className="text-xs font-medium text-blue-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-blue-900">{value}</p>
    </div>
  )
}

function HistoryChart({ data, historyOnly, isDailyMode, expanded = false }) {
  return (
    <ResponsiveContainer width="100%" height={expanded ? 620 : 260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="forecastVarianceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.12} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
        <XAxis
          dataKey={isDailyMode ? 'day' : 'month'}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={38} tickFormatter={(v) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '12px' }}
          labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}
          formatter={(v, name) => {
            if (name === 'actual_qty') return [fmt(v, 1), 'Neysla']
            if (name === 'forecast_qty') return [fmt(v, 1), 'Spá']
            if (name === 'forecast_upper') return [fmt(v, 1), 'Spá efri mörk']
            if (name === 'forecast_lower') return [fmt(v, 1), 'Spá neðri mörk']
            return [fmt(v, 1), name]
          }}
        />
        <Area
          type="monotone"
          dataKey="forecast_lower"
          stackId="forecast-band"
          stroke="none"
          fillOpacity={0}
          legendType="none"
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="forecast_band"
          name="Variance band"
          stackId="forecast-band"
          stroke="none"
          fill="url(#forecastVarianceFill)"
          fillOpacity={1}
          activeDot={false}
          legendType="rect"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="actual_qty"
          name="Neysla"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={historyOnly.length <= 36}
          activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="forecast_qty"
          name="Spá"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 4"
          activeDot={{ r: 4, fill: '#d97706', strokeWidth: 0 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast_upper"
          name="Spá efri mörk"
          stroke="#f59e0b"
          strokeOpacity={0.65}
          strokeWidth={1}
          dot={false}
          strokeDasharray="2 3"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast_lower"
          name="Spá neðri mörk"
          stroke="#f59e0b"
          strokeOpacity={0.65}
          strokeWidth={1}
          dot={false}
          strokeDasharray="2 3"
          connectNulls={false}
        />
        <Brush
          dataKey={isDailyMode ? 'day' : 'month'}
          height={22}
          stroke="#93c5fd"
          fill="#eff6ff"
          travellerWidth={10}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function HistoryRangeControls({ rangeMonths, setRangeMonths }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {[
        { label: '12 mán.', value: 12 },
        { label: '24 mán.', value: 24 },
        { label: '36 mán.', value: 36 },
        { label: 'Allt', value: null },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => setRangeMonths(option.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            rangeMonths === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function aggregateByMonth(rows) {
  const monthly = {}
  for (const h of rows) {
    const month = (h.day || h.consumption_date)?.slice(0, 7)
    if (!month) continue
    const qty = Number(h.actual_sale ?? h.qty) || 0
    monthly[month] = (monthly[month] || 0) + qty
  }
  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, qty]) => qty > 0)
    .map(([month, qty]) => ({ month, qty }))
}

function expandMonthlyHistoryToDaily(rows) {
  const monthlyRows = aggregateByMonth(rows)
  const dailyRows = []

  for (const row of monthlyRows) {
    const [year, month] = row.month.split('-').map(Number)
    if (!year || !month) continue

    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyQty = row.qty / 30

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day))
      dailyRows.push({
        day: date.toISOString().slice(0, 10),
        actual_qty: dailyQty,
        forecast_qty: null,
        forecast_lower: null,
        forecast_upper: null,
        forecast_band: null,
      })
    }
  }

  return dailyRows
}

function aggregateForecastByMonth(forecastResponse) {
  const forecastItem = forecastResponse?.forecasts?.[0]
  if (!forecastItem?.forecast_dates?.length || !forecastItem?.forecast?.length) return []

  const monthly = {}
  forecastItem.forecast_dates.forEach((day, index) => {
    const month = day?.slice(0, 7)
    if (!month) return
    if (!monthly[month]) {
      monthly[month] = { forecast_qty: 0, variance_qty: 0 }
    }
    monthly[month].forecast_qty += Number(forecastItem.forecast[index]) || 0
    monthly[month].variance_qty += Number(forecastItem.variance?.[index]) || 0
  })

  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => {
      const stdDev = Math.sqrt(Math.max(values.variance_qty, 0))
      return {
        month,
        forecast_qty: values.forecast_qty,
        forecast_lower: Math.max(values.forecast_qty - stdDev, 0),
        forecast_upper: values.forecast_qty + stdDev,
        forecast_band: Math.max(values.forecast_qty + stdDev, 0) - Math.max(values.forecast_qty - stdDev, 0),
      }
    })
}

function forecastDailySeries(forecastResponse) {
  const forecastItem = forecastResponse?.forecasts?.[0]
  if (!forecastItem?.forecast_dates?.length || !forecastItem?.forecast?.length) return []

  return forecastItem.forecast_dates.map((day, index) => {
    const forecastQty = Number(forecastItem.forecast[index]) || 0
    const varianceQty = Number(forecastItem.variance?.[index]) || 0
    const stdDev = Math.sqrt(Math.max(varianceQty, 0))

    return {
      day,
      actual_qty: null,
      forecast_qty: forecastQty,
      forecast_lower: Math.max(forecastQty - stdDev, 0),
      forecast_upper: forecastQty + stdDev,
      forecast_band: Math.max(forecastQty + stdDev, 0) - Math.max(forecastQty - stdDev, 0),
    }
  })
}

function mergeHistoryAndForecast(historyRows, forecastResponse) {
  const historyByMonth = aggregateByMonth(historyRows)
  const forecastByMonth = aggregateForecastByMonth(forecastResponse)
  const merged = new Map()

  for (const row of historyByMonth) {
    merged.set(row.month, {
      month: row.month,
      actual_qty: row.qty,
      forecast_qty: null,
      forecast_lower: null,
      forecast_upper: null,
      forecast_band: null,
    })
  }

  for (const row of forecastByMonth) {
    const existing = merged.get(row.month)
    merged.set(row.month, {
      month: row.month,
      actual_qty: existing?.actual_qty ?? null,
      forecast_qty: row.forecast_qty,
      forecast_lower: row.forecast_lower,
      forecast_upper: row.forecast_upper,
      forecast_band: row.forecast_band,
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.month.localeCompare(b.month))
}

function mergeHistoryAndForecastDaily(historyRows, forecastResponse) {
  const historyByDay = expandMonthlyHistoryToDaily(historyRows)
  const forecastByDay = forecastDailySeries(forecastResponse)
  const merged = new Map()

  for (const row of historyByDay) {
    merged.set(row.day, row)
  }

  for (const row of forecastByDay) {
    const existing = merged.get(row.day)
    merged.set(row.day, {
      day: row.day,
      actual_qty: existing?.actual_qty ?? null,
      forecast_qty: row.forecast_qty,
      forecast_lower: row.forecast_lower,
      forecast_upper: row.forecast_upper,
      forecast_band: row.forecast_band,
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.day.localeCompare(b.day))
}

function HistoryPanel({ item, histories, forecastData, loading, forecastLoading }) {
  const [rangeMonths, setRangeMonths] = useState(12)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isDailyMode = rangeMonths === 12

  const chartData = useMemo(() => {
    if (!item) return []
    return isDailyMode
      ? mergeHistoryAndForecastDaily(histories, forecastData)
      : mergeHistoryAndForecast(histories, forecastData)
  }, [histories, forecastData, item, isDailyMode])

  const historyOnly = useMemo(
    () => chartData.filter((row) => row.actual_qty != null),
    [chartData],
  )

  const total = historyOnly.reduce((s, d) => s + d.actual_qty, 0)
  const avg = historyOnly.length ? total / historyOnly.length : 0
  const peak = historyOnly.length ? Math.max(...historyOnly.map((d) => d.actual_qty)) : 0

  const visibleData = useMemo(() => {
    if (isDailyMode) {
      if (chartData.length <= 365) return chartData
      return chartData.slice(-365)
    }
    if (!rangeMonths || chartData.length <= rangeMonths) return chartData
    return chartData.slice(-rangeMonths)
  }, [chartData, rangeMonths, isDailyMode])

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="section-title">Saga</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-mono font-semibold text-blue-600">{item.item_number}</span>
            {' · '}{item.description?.trim() || '—'}
            {' · '}<span className="text-gray-400">{item.location_name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {forecastLoading && <span className="badge badge-blue">Reikna spá…</span>}
          {historyOnly.length > 0 && <span className="badge badge-blue">{historyOnly.length} mán.</span>}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Opna stórt
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner message="Hleð sögu…" /></div>
      ) : historyOnly.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">📭</span>
          <p className="text-gray-500 text-sm">Engin saga fyrir þennan hlut</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <HistoryRangeControls rangeMonths={rangeMonths} setRangeMonths={setRangeMonths} />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatBox label="Heildarneysla" value={fmt(total)} />
            <StatBox label={isDailyMode ? 'Dagleg' : 'Mánaðarleg'} value={fmt(avg, 1)} />
            <StatBox label="Hámark" value={fmt(peak)} />
          </div>
          <HistoryChart
            data={visibleData}
            historyOnly={historyOnly}
            isDailyMode={isDailyMode}
          />
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Saga og spá</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-mono font-semibold text-blue-600">{item.item_number}</span>
                  {' · '}{item.description?.trim() || '—'}
                </p>
                <div className="mt-3">
                  <HistoryRangeControls rangeMonths={rangeMonths} setRangeMonths={setRangeMonths} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Loka
              </button>
            </div>
            <div className="p-6">
              <HistoryChart
                data={visibleData}
                historyOnly={historyOnly}
                isDailyMode={isDailyMode}
                expanded
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ForecastJsonTab({ forecastData, forecastLoading }) {
  if (forecastLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner message="Reikna spá…" />
      </div>
    )
  }

  if (!forecastData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
        <span className="text-3xl mb-3">📭</span>
        <p className="text-sm">Engin spágögn tiltæk</p>
      </div>
    )
  }

  const json = JSON.stringify(forecastData, null, 2)

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          {forecastData.forecasts?.[0]?.forecast_dates?.length ?? 0} dagar í spá
        </p>
        <button
          onClick={() => {
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'forecast.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="btn-secondary text-xs py-1 px-3"
        >
          Hlaða niður JSON
        </button>
      </div>
      <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs overflow-auto max-h-[460px] text-gray-700 leading-relaxed">
        {json}
      </pre>
    </div>
  )
}


const GROUP_OPTIONS = [
  { label: 'Dagur', value: 'day' },
  { label: 'Vika', value: 'week' },
  { label: 'Mánuður', value: 'month' },
]


function SimChart({ data, groupBy, visible, yDomain, height }) {
  const xKey = groupBy === 'day' ? 'day' : 'label'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 8)} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={38} tickFormatter={(v) => fmt(v)} domain={yDomain} />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '12px' }} formatter={(v, name) => [fmt(v, 1), name]} />
        <defs>
          <linearGradient id="simForecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        {visible.inv && <Area type="monotone" dataKey="inv" name="Lagerstaða" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} dot={false} />}
        {visible.actual_qty && <Line type="monotone" dataKey="actual_qty" name="Neysla" stroke="#1d4ed8" strokeWidth={2} dot={false} connectNulls={false} />}
        {visible.forecast_band && <Area type="monotone" dataKey="forecast_lower" stackId="fc" stroke="none" fillOpacity={0} legendType="none" connectNulls={false} />}
        {visible.forecast_band && <Area type="monotone" dataKey="forecast_band" name="Öryggismörk" stackId="fc" stroke="none" fill="url(#simForecastBand)" fillOpacity={1} activeDot={false} legendType="none" connectNulls={false} />}
        {visible.purchase_qty && <Bar dataKey="purchase_qty" name="Innkaup" fill="#f59e0b" opacity={0.85} radius={[2, 2, 0, 0]} />}
        {visible.forecast_qty && <Line type="monotone" dataKey="forecast_qty" name="Spá" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false} />}
        <Brush dataKey={xKey} height={22} stroke="#93c5fd" fill="#eff6ff" travellerWidth={10} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

const SIM_PARAMS_DEFAULT = {
  order_freq: 30,
  lead_time: 30,
  service_level: 0.95,
  forecast_periods: 6,
  season_length: 12,
  freq: 'M',
  local_model: 'auto_ets',
}

const FREQ_OPTIONS = ['D', 'W', 'M', 'Q', 'Y']
const MODEL_OPTIONS = ['auto_ets', 'ets', 'arima', 'theta', 'naive']

const SERIES = [
  { key: 'inv', label: 'Lagerstaða', color: '#3b82f6' },
  { key: 'actual_qty', label: 'Neysla', color: '#1d4ed8' },
  { key: 'purchase_qty', label: 'Innkaup', color: '#f59e0b' },
  { key: 'forecast_qty', label: 'Spá', color: '#10b981' },
  { key: 'forecast_band', label: 'Öryggismörk', color: '#10b981' },
]

function SimulationPanel({ item, histories = [] }) {
  const [simData, setSimData] = useState(null)
  const [error, setError] = useState('')
  const [groupBy, setGroupBy] = useState('week')
  const [params, setParams] = useState(SIM_PARAMS_DEFAULT)
  const [showParams, setShowParams] = useState(false)
  const [runParams, setRunParams] = useState(SIM_PARAMS_DEFAULT)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [visible, setVisible] = useState(() => Object.fromEntries(SERIES.map((s) => [s.key, true])))

  const toggleSeries = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }))

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))

  const { data: forecastData } = useQuery({
    queryKey: ['sim-forecast', item.id, runParams.forecast_periods, runParams.freq, runParams.local_model, runParams.season_length],
    queryFn: () => getForecastDirect(item.id, {
      forecast_periods: runParams.forecast_periods,
      mode: 'local',
      local_model: runParams.local_model,
      season_length: runParams.season_length,
      freq: runParams.freq,
    }),
    enabled: !!item.id,
  })

  const mutation = useMutation({
    mutationFn: () => getRawSimulate(item.id, { ...params, mode: 'local' }),
    retry: 2,
    onSuccess: (data) => {
      const result = data?.simulator_output ?? data
      setSimData(Array.isArray(result) ? result : [])
      setRunParams(params)
      setError('')
    },
    onError: (err) => { setError(err.response?.data?.detail || err.message || 'Villa í hermun') },
  })


  const dailyData = useMemo(() => {
    if (!simData) return []

    const forecastItem = forecastData?.forecasts?.[0]
    const forecastByDay = {}
    if (forecastItem?.forecast_dates) {
      forecastItem.forecast_dates.forEach((day, i) => {
        const qty = Number(forecastItem.forecast?.[i]) || 0
        const stdDev = Math.sqrt(Math.max(Number(forecastItem.variance?.[i]) || 0, 0))
        forecastByDay[day] = {
          forecast_qty: qty,
          forecast_lower: Math.max(qty - stdDev, 0),
          forecast_upper: qty + stdDev,
        }
      })
    }

    // Build history rows (daily avg per month)
    const monthlyHistory = aggregateByMonth(histories)
    const simStartDay = simData[0]?.sim_date ?? ''
    const historyRows = []
    for (const { month, qty } of monthlyHistory) {
      if (month >= simStartDay.slice(0, 7)) continue
      const [y, m] = month.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const dailyQty = qty / daysInMonth
      for (let d = 1; d <= daysInMonth; d++) {
        const day = `${month}-${String(d).padStart(2, '0')}`
        historyRows.push({ day, actual_qty: dailyQty, inv: null, purchase_qty: null, forecast_qty: null, forecast_lower: null, forecast_upper: null, forecast_band: null })
      }
    }

    const simRows = simData.map((r) => {
      const f = forecastByDay[r.sim_date] ?? null
      return {
        day: r.sim_date,
        inv: r.inv,
        purchase_qty: r.purchase_qty,
        actual_qty: null,
        forecast_qty: f?.forecast_qty ?? null,
        forecast_lower: f?.forecast_lower ?? null,
        forecast_upper: f?.forecast_upper ?? null,
        forecast_band: f != null ? f.forecast_upper - f.forecast_lower : null,
      }
    })

    return [...historyRows, ...simRows]
  }, [simData, forecastData, histories])

  const chartData = useMemo(() => {
    if (!dailyData.length) return []
    if (groupBy === 'day') return dailyData

    const getBucket = (day) => {
      if (groupBy === 'month') return day.slice(0, 7)
      const d = new Date(day)
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
      return `${d.getFullYear()}-V${String(week).padStart(2, '0')}`
    }

    const buckets = {}
    for (const r of dailyData) {
      const key = getBucket(r.day)
      if (!buckets[key]) buckets[key] = { label: key, actual_qty: 0, purchase_qty: 0, inv: 0, forecast_qty: 0, forecast_lower: 0, forecast_upper: 0, nInv: 0, nFc: 0 }
      if (r.actual_qty != null) buckets[key].actual_qty += r.actual_qty
      if (r.purchase_qty != null) buckets[key].purchase_qty += r.purchase_qty
      if (r.inv != null) { buckets[key].inv += r.inv; buckets[key].nInv += 1 }
      if (r.forecast_qty != null) {
        buckets[key].forecast_qty += r.forecast_qty
        buckets[key].forecast_lower += r.forecast_lower ?? 0
        buckets[key].forecast_upper += r.forecast_upper ?? 0
        buckets[key].nFc += 1
      }
    }

    return Object.values(buckets)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((b) => ({
        label: b.label,
        actual_qty: b.actual_qty || null,
        purchase_qty: b.purchase_qty || null,
        inv: b.nInv ? b.inv / b.nInv : null,
        forecast_qty: b.nFc ? b.forecast_qty : null,
        forecast_lower: b.nFc ? b.forecast_lower : null,
        forecast_upper: b.nFc ? b.forecast_upper : null,
        forecast_band: b.nFc ? b.forecast_upper - b.forecast_lower : null,
      }))
  }, [dailyData, groupBy])

  const visibleChartData = useMemo(() => {
    if (visible.actual_qty) return chartData
    return chartData.filter((r) => r.inv != null || r.purchase_qty != null || r.forecast_qty != null)
  }, [chartData, visible.actual_qty])

  const yDomain = useMemo(() => {
    const keys = SERIES.filter((s) => visible[s.key] && s.key !== 'forecast_band').map((s) => s.key)
    if (!keys.length || !visibleChartData.length) return [0, 'auto']
    let max = 0
    for (const row of visibleChartData) {
      for (const key of keys) {
        const v = row[key]
        if (v != null && v > max) max = v
      }
    }
    return [0, Math.ceil(max * 1.05)]
  }, [visibleChartData, visible])

  if (simData === null && !mutation.isPending && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <span className="text-4xl mb-4">🧮</span>
        <p className="text-sm font-medium text-gray-600 mb-1">Tilbúið til keyrslu</p>
        <p className="text-xs text-gray-400 mb-4">Opnaðu stillingar og ýttu á „Keyra hermun"</p>
        <button onClick={() => { setShowParams(true); mutation.mutate() }} className="btn-primary text-sm py-1.5 px-5">
          Keyra hermun
        </button>
      </div>
    )
  }

  if (mutation.isPending) {
    return <div className="flex flex-col items-center justify-center py-12"><LoadingSpinner message="Keyri hermun…" /></div>
  }

  if (!simData && error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
        <span className="text-3xl mb-3">📭</span>
        <p className="text-sm text-gray-500">Hermun ekki tiltæk fyrir þennan hlut</p>
        <p className="text-xs mt-1 font-mono text-gray-300">{item.item_number} (id: {item.id})</p>
        <p className="text-xs mt-1 mb-4 font-mono text-red-400 max-w-xs break-words">{error}</p>
        <button onClick={() => mutation.mutate()} className="btn-secondary text-xs py-1 px-3">Reyna aftur</button>
      </div>
    )
  }

  if (!chartData.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
        <span className="text-3xl mb-3">📭</span>
        <p className="text-sm">Engin hermunarniðurstöður fyrir þennan hlut</p>
        <p className="text-xs mt-1 text-gray-300 font-mono">item.id: {item.id}</p>
        <button onClick={() => mutation.mutate()} className="btn-secondary text-sm mt-4">Reyna aftur</button>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-3">
        <h2 className="section-title">Monte Carlo hermun</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Opna stórt
          </button>
          <button
            type="button"
            onClick={() => setShowParams((v) => !v)}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {showParams ? 'Fela stillingar' : 'Stillingar'}
          </button>
          <div className="flex gap-1">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroupBy(opt.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  groupBy === opt.value ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showParams && (
        <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { key: 'order_freq', label: 'Pöntunar tíðni (dagar)', type: 'number', min: 1 },
            { key: 'lead_time', label: 'Afhendingartími (dagar)', type: 'number', min: 0 },
            { key: 'service_level', label: 'Þjónustugildi (0–1)', type: 'number', min: 0, max: 1, step: 0.05 },
            { key: 'forecast_periods', label: 'Spátímabil', type: 'number', min: 1 },
            { key: 'season_length', label: 'Árstíðarlengd', type: 'number', min: 1 },
          ].map(({ key, label, ...inputProps }) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-500">{label}</span>
              <input
                {...inputProps}
                value={params[key]}
                onChange={(e) => setParam(key, inputProps.type === 'number' ? Number(e.target.value) : e.target.value)}
                className="input-field py-1 text-sm"
              />
            </label>
          ))}
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500">Tíðni (freq)</span>
            <select value={params.freq} onChange={(e) => setParam('freq', e.target.value)} className="input-field py-1 text-sm">
              {FREQ_OPTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500">Líkan</span>
            <select value={params.local_model} onChange={(e) => setParam('local_model', e.target.value)} className="input-field py-1 text-sm">
              {MODEL_OPTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="col-span-2 pt-1">
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary text-sm py-1.5 px-4 w-full"
            >
              {mutation.isPending ? 'Keyri…' : 'Keyra hermun'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => toggleSeries(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              visible[s.key]
                ? 'border-transparent text-white'
                : 'border-gray-200 text-gray-400 bg-white'
            }`}
            style={visible[s.key] ? { backgroundColor: s.color } : {}}
          >
            {s.label}
          </button>
        ))}
      </div>

      <SimChart data={visibleChartData} groupBy={groupBy} visible={visible} yDomain={yDomain} height={300} />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Monte Carlo hermun</h3>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">{item.item_number} · {item.description?.trim()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowParams((v) => !v)} className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  {showParams ? 'Fela stillingar' : 'Stillingar'}
                </button>
                <div className="flex gap-1">
                  {GROUP_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setGroupBy(opt.value)}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${groupBy === opt.value ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors ml-2">
                  Loka
                </button>
              </div>
            </div>

            <div className="px-6 pt-4 flex-shrink-0">
              {showParams && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3 grid grid-cols-4 gap-x-4 gap-y-2">
                  {[
                    { key: 'order_freq', label: 'Pöntunartíðni (dagar)', type: 'number', min: 1 },
                    { key: 'lead_time', label: 'Afhendingartími (dagar)', type: 'number', min: 0 },
                    { key: 'service_level', label: 'Þjónustugildi (0–1)', type: 'number', min: 0, max: 1, step: 0.05 },
                    { key: 'forecast_periods', label: 'Spátímabil', type: 'number', min: 1 },
                    { key: 'season_length', label: 'Árstíðarlengd', type: 'number', min: 1 },
                  ].map(({ key, label, ...inputProps }) => (
                    <label key={key} className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500">{label}</span>
                      <input {...inputProps} value={params[key]} onChange={(e) => setParam(key, inputProps.type === 'number' ? Number(e.target.value) : e.target.value)} className="input-field py-1 text-sm" />
                    </label>
                  ))}
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500">Tíðni</span>
                    <select value={params.freq} onChange={(e) => setParam('freq', e.target.value)} className="input-field py-1 text-sm">
                      {FREQ_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500">Líkan</span>
                    <select value={params.local_model} onChange={(e) => setParam('local_model', e.target.value)} className="input-field py-1 text-sm">
                      {MODEL_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary text-sm py-1.5 px-4 w-full">
                      {mutation.isPending ? 'Keyri…' : 'Keyra hermun'}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SERIES.map((s) => (
                  <button key={s.key} type="button" onClick={() => toggleSeries(s.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${visible[s.key] ? 'border-transparent text-white' : 'border-gray-200 text-gray-400 bg-white'}`}
                    style={visible[s.key] ? { backgroundColor: s.color } : {}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6">
              <SimChart data={visibleChartData} groupBy={groupBy} visible={visible} yDomain={yDomain} height={480} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const COLS = [
  { key: 'item_number', label: 'Hlut #', render: (v) => <span className="badge badge-blue font-mono">{v}</span> },
  { key: 'description', label: 'Lýsing', render: (v) => <span className="truncate max-w-[200px] block">{v?.trim() || '—'}</span> },
  { key: 'location_name', label: 'Staður', render: (v) => v || '—' },
  { key: 'price', label: 'Verð', render: (v) => <span className="font-mono">{fmt(v)}</span>, right: true },
  { key: 'stock_level', label: 'Lager', render: (v) => <span className="font-mono">{fmt(v, 1)}</span>, right: true },
  { key: 'last_year_usage', label: 'Notkun', render: (v) => <span className="font-mono">{fmt(v)}</span>, right: true },
  { key: 'purchasing_method', label: 'Aðferð', render: (v) => v ? <span className="badge badge-blue text-xs">{v}</span> : '—' },
  { key: 'purchase_suggestion', label: 'Tillaga', render: (v) => <span className="font-mono font-semibold text-blue-700">{fmt(v)}</span>, right: true },
]

async function fetchNoisItems() {
  const [page1, page2] = await Promise.all([
    listRows('items', { limit: 1000, offset: 10000 }),
    listRows('items', { limit: 1000, offset: 11000 }),
  ])
  const rows = [...(page1.rows || []), ...(page2.rows || [])].filter(
    (r) => r.organisation === 'Noi',
  )
  return rows
}

export default function NoisPage() {
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('simulation')
  const [usageMin, setUsageMin] = useState('')
  const [moveMin, setMoveMin] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [itemNumberFilter, setItemNumberFilter] = useState('')
  const [descFilter, setDescFilter] = useState('')
  const [productGroupFilter, setProductGroupFilter] = useState('')

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['noi-items'],
    queryFn: fetchNoisItems,
  })

  const { data: simInputData } = useQuery({
    queryKey: ['noi-sim-input', selectedItem?.id],
    queryFn: () =>
      getSimInput(selectedItem.id, {
        number_of_days: 3650,
        number_of_simulations: 1000,
        service_level: 0.95,
      }),
    enabled: !!selectedItem,
  })

  const histories = simInputData?.sim_input_his || []

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['noi-forecast-direct', selectedItem?.id],
    queryFn: () =>
      getForecastDirect(selectedItem.id, {
        forecast_periods: 12,
        mode: 'local',
        local_model: 'auto_ets',
        season_length: 12,
        freq: 'M',
      }),
    enabled: !!selectedItem,
  })

  const productGroups = useMemo(() =>
    [...new Set(allItems.map((i) => i.product_group_name).filter(Boolean))].sort(),
    [allItems],
  )

  const filteredItems = useMemo(() => {
    let items = allItems
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((item) =>
        [item.item_number, item.description, item.location_name, item.vendor_name].some((v) =>
          String(v || '').toLowerCase().includes(q),
        ),
      )
    }
    if (itemNumberFilter.trim()) {
      const q = itemNumberFilter.toLowerCase()
      items = items.filter((item) => String(item.item_number || '').toLowerCase().includes(q))
    }
    if (descFilter.trim()) {
      const q = descFilter.toLowerCase()
      items = items.filter((item) => String(item.description || '').toLowerCase().includes(q))
    }
    if (productGroupFilter) {
      items = items.filter((item) => item.product_group_name === productGroupFilter)
    }
    if (usageMin !== '') {
      const min = Number(usageMin)
      if (!isNaN(min)) items = items.filter((item) => (item.last_year_usage ?? 0) >= min)
    }
    if (moveMin !== '') {
      const min = Number(moveMin)
      if (!isNaN(min)) items = items.filter((item) => (item.num_move_last_three_years ?? 0) >= min)
    }
    return items
  }, [allItems, search, itemNumberFilter, descFilter, productGroupFilter, usageMin, moveMin])

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Noi — Birgðir</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isLoading ? 'Hleð…' : `${filteredItems.length} / ${allItems.length} hlutir`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[{ value: 'table', icon: '▤' }, { value: 'cards', icon: '⊞' }].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setViewMode(opt.value)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  viewMode === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.icon}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedItem(null) }}
              placeholder="Leita…"
              className="input-field pl-8 py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={itemNumberFilter}
            onChange={(e) => { setItemNumberFilter(e.target.value); setSelectedItem(null) }}
            placeholder="Hlut #…"
            className="input-field py-1 text-sm w-32"
          />
          <input
            type="text"
            value={descFilter}
            onChange={(e) => { setDescFilter(e.target.value); setSelectedItem(null) }}
            placeholder="Lýsing…"
            className="input-field py-1 text-sm w-48"
          />
          <select
            value={productGroupFilter}
            onChange={(e) => { setProductGroupFilter(e.target.value); setSelectedItem(null) }}
            className="input-field py-1 text-sm w-48"
          >
            <option value="">Allir vöruhópar</option>
            {productGroups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Notkun ≥</span>
            <input
              type="number"
              min="0"
              value={usageMin}
              onChange={(e) => setUsageMin(e.target.value)}
              placeholder="0"
              className="w-20 input-field py-1 text-sm"
            />
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Hreyfingar (3 ár) ≥</span>
            <input
              type="number"
              min="0"
              value={moveMin}
              onChange={(e) => setMoveMin(e.target.value)}
              placeholder="0"
              className="w-20 input-field py-1 text-sm"
            />
          </div>
          {(itemNumberFilter || descFilter || productGroupFilter || usageMin !== '' || moveMin !== '') && (
            <button
              type="button"
              onClick={() => { setItemNumberFilter(''); setDescFilter(''); setProductGroupFilter(''); setUsageMin(''); setMoveMin('') }}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Hreinsa síur ×
            </button>
          )}
        </div>
      </div>

      {/* Split layout */}
      <div className="flex gap-5 items-start">
        {/* Left: Table or Cards */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="card flex items-center justify-center py-20">
              <LoadingSpinner message="Hleð Noi hlutum…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-gray-500">Engir hlutir fundust</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="card p-0 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {COLS.map((col) => (
                      <th key={col.key} className={`table-header ${col.right ? 'text-right' : ''}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <tr
                        key={item.id}
                        onClick={() => { setSelectedItem(isSelected ? null : item); setActiveTab('simulation') }}
                        className={`table-row transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                            : 'border-l-[3px] border-l-transparent'
                        }`}
                      >
                        {COLS.map((col) => (
                          <td key={col.key} className={`table-cell ${col.right ? 'text-right' : ''}`}>
                            {col.render(item[col.key])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id
                const miniChartData = isSelected
                  ? mergeHistoryAndForecast(histories, forecastData).slice(-24)
                  : null
                return (
                  <div
                    key={item.id}
                    onClick={() => { setSelectedItem(isSelected ? null : item); setActiveTab('simulation') }}
                    className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-blue-500 shadow-md' : 'border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="badge badge-blue font-mono text-xs">{item.item_number}</span>
                      {item.purchasing_method && (
                        <span className="text-xs text-gray-400 font-medium">{item.purchasing_method}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-snug mb-1 line-clamp-2">
                      {item.description?.trim() || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">{item.location_name || '—'}</p>
                    <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                      <div className="bg-gray-50 rounded-lg py-1.5">
                        <p className="text-xs text-gray-400 mb-0.5">Lager</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(item.stock_level, 1)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-1.5">
                        <p className="text-xs text-gray-400 mb-0.5">Notkun/ár</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(item.last_year_usage)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg py-1.5">
                        <p className="text-xs text-blue-400 mb-0.5">Tillaga</p>
                        <p className="text-sm font-semibold text-blue-700">{fmt(item.purchase_suggestion)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                      <div className="bg-gray-50 rounded-lg py-1.5">
                        <p className="text-xs text-gray-400 mb-0.5">Hreyf. 1 ár</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(item.num_move_last_year)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-1.5">
                        <p className="text-xs text-gray-400 mb-0.5">Hreyf. 2 ár</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(item.num_move_last_two_years)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-1.5">
                        <p className="text-xs text-gray-400 mb-0.5">Hreyf. 3 ár</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(item.num_move_last_three_years)}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      miniChartData?.length > 0 ? (
                        <div className="mt-1 -mx-1">
                          <p className="text-xs text-gray-400 mb-1 px-1">Saga og spá (12 mán. spá)</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={miniChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={38} tickFormatter={(v) => fmt(v)} />
                              <Tooltip
                                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(v, name) => [fmt(v, 1), name === 'actual_qty' ? 'Neysla' : 'Spá']}
                              />
                              <Line type="monotone" dataKey="actual_qty" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls={false} />
                              <Line type="monotone" dataKey="forecast_qty" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 3" connectNulls={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[120px] flex items-center justify-center text-xs text-gray-300 bg-gray-50 rounded-lg">
                          {simInputData ? 'Engin saga' : 'Hleð…'}
                        </div>
                      )
                    ) : (
                      <div className="h-[60px] flex items-end gap-px px-1">
                        {Array.from({ length: 12 }, (_, i) => {
                          const seed = ((item.id ?? 0) * 31 + i * 17) % 100
                          return (
                            <div key={i} className="flex-1 bg-gray-100 rounded-sm" style={{ height: `${25 + Math.sin(i * 0.9 + seed) * 15 + (seed % 25)}%` }} />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Sticky panel */}
        <div className="w-[440px] flex-shrink-0 card sticky top-4">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <span className="text-5xl mb-4">📈</span>
              <p className="text-sm font-medium">Veldu línu til að sjá gögn</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-5 -mx-6 px-6">
                {[
                  { id: 'simulation', label: 'Hermun' },
                  { id: 'json', label: 'Spá JSON' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-2 mr-6 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'simulation' && (
                <SimulationPanel key={selectedItem.id} item={selectedItem} histories={histories} />
              )}
              {activeTab === 'json' && (
                <ForecastJsonTab forecastData={forecastData} forecastLoading={forecastLoading} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
