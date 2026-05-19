import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { listRows, getItemHistories, getSimInput, runSimulation } from '../api/items.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  LineChart,
  Line,
  ReferenceArea,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function aggregateByMonth(rows) {
  const monthly = {}
  for (const h of rows) {
    const month = h.consumption_date?.slice(0, 7)
    if (!month) continue
    monthly[month] = (monthly[month] || 0) + (Number(h.qty) || 0)
  }
  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, qty]) => ({ month, qty }))
}

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString('is-IS', { maximumFractionDigits: decimals })
}

function StatBox({ label, value }) {
  return (
    <div className="bg-blue-50 rounded-xl p-4 text-center">
      <p className="text-xs font-medium text-blue-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-blue-900">{value}</p>
    </div>
  )
}

function aggregateByYear(rows) {
  const yearly = {}
  for (const h of rows) {
    const year = h.consumption_date?.slice(0, 4)
    if (!year) continue
    yearly[year] = (yearly[year] || 0) + (Number(h.qty) || 0)
  }
  return Object.entries(yearly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, qty]) => ({ year, qty }))
}

const BAR_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a']

function HistoryChart({ item, histories, loading }) {
  const [refAreaLeft, setRefAreaLeft] = useState(null)
  const [refAreaRight, setRefAreaRight] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoomDomain, setZoomDomain] = useState(null)

  const filtered = useMemo(() => {
    if (!histories || !item) return []
    return histories.filter((h) => h.item_id === item.id)
  }, [histories, item])

  const chartData = useMemo(() => aggregateByMonth(filtered), [filtered])
  const yearData = useMemo(() => aggregateByYear(filtered), [filtered])

  const visibleData = useMemo(() => {
    if (!zoomDomain) return chartData
    return chartData.slice(zoomDomain[0], zoomDomain[1] + 1)
  }, [chartData, zoomDomain])

  const total = visibleData.reduce((s, d) => s + d.qty, 0)
  const avg = visibleData.length ? total / visibleData.length : 0
  const peak = visibleData.length ? Math.max(...visibleData.map((d) => d.qty)) : 0

  const handleMouseDown = (e) => {
    if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setIsSelecting(true) }
  }
  const handleMouseMove = (e) => {
    if (isSelecting && e?.activeLabel) setRefAreaRight(e.activeLabel)
  }
  const handleMouseUp = () => {
    if (!isSelecting || !refAreaLeft || !refAreaRight) { setIsSelecting(false); return }
    const li = chartData.findIndex((d) => d.month === refAreaLeft)
    const ri = chartData.findIndex((d) => d.month === refAreaRight)
    if (li !== -1 && ri !== -1 && li !== ri) {
      setZoomDomain(li < ri ? [li, ri] : [ri, li])
    }
    setIsSelecting(false); setRefAreaLeft(null); setRefAreaRight(null)
  }

  return (
    <div className="fade-in h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="section-title">Saga</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-mono font-semibold text-blue-600">{item.item_number}</span>
            {' · '}
            <span>{item.description?.trim() || '—'}</span>
            {' · '}
            <span className="text-gray-400">{item.location_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {zoomDomain && (
            <button onClick={() => setZoomDomain(null)} className="btn-secondary text-xs py-0.5 px-2">
              Zoom út
            </button>
          )}
          {chartData.length > 0 && (
            <span className="badge badge-blue">{visibleData.length}/{chartData.length} mán.</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner message="Hleð sögu…" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3">📭</span>
          <p className="text-gray-500 text-sm">Engin saga fyrir þennan hlut</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatBox label="Heildarneysla" value={fmt(total)} />
            <StatBox label="Mánaðarlegt meðaltal" value={fmt(avg, 1)} />
            <StatBox label="Hámarksneysla" value={fmt(peak)} />
          </div>

          {/* Bar chart with drag-to-zoom */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={visibleData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ userSelect: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
                labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}
                formatter={(v) => [fmt(v, 1), 'Neysla']}
              />
              <Bar dataKey="qty" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              {isSelecting && refAreaLeft && refAreaRight && (
                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} fill="#3b82f6" fillOpacity={0.15} />
              )}
            </BarChart>
          </ResponsiveContainer>

          {/* Yearly bar chart */}
          {yearData.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-600 mt-6 mb-3">Sölusaga eftir ári</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={yearData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(v) => [fmt(v), 'Sala']}
                  />
                  <Bar dataKey="qty" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {yearData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      )}
    </div>
  )
}

function weekKey(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function aggregateHistoryByWeek(rows) {
  const weeks = {}
  for (const r of rows) {
    const key = weekKey(r.consumption_date)
    if (!key) continue
    weeks[key] = (weeks[key] || 0) + (Number(r.qty) || 0)
  }
  return weeks
}

function aggregateSimByWeek(rows) {
  const weeks = {}
  for (const r of rows) {
    const d = new Date(r.sim_date)
    // ISO week key: year-W##
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
    const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    if (!weeks[key]) weeks[key] = { week: key, inv: 0, forecast: 0, purchase_qty: 0, lost_sale: 0, n: 0 }
    weeks[key].inv += r.inv || 0
    weeks[key].forecast += r.forecast || 0
    weeks[key].purchase_qty += r.purchase_qty || 0
    weeks[key].lost_sale += r.lost_sale || 0
    weeks[key].n += 1
  }
  return Object.values(weeks)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({ ...w, inv: w.inv / w.n })) // avg inv per week
}

const SIM_SERIES = [
  { key: 'actual_qty', label: 'Saga',  color: '#f97316' },
  { key: 'forecast',   label: 'Spá',   color: '#3b82f6' },
  { key: 'inv',        label: 'Lager', color: '#6366f1' },
  { key: 'purchase_qty', label: 'Kaup', color: '#10b981' },
]

const SIM_PARAMS_DEFAULT = {
  number_of_days: 900,
  number_of_simulations: 1000,
  service_level: 0.95,
  lead_time: null,
  order_freq: null,
}

const SIM_PARAM_FIELDS = [
  { key: 'number_of_days',        label: 'Fjöldi daga',           min: 30,  max: 3650, step: 30   },
  { key: 'number_of_simulations', label: 'Fjöldi hermana',        min: 100, max: 5000, step: 100  },
  { key: 'service_level',         label: 'Þjónustugildi (0–1)',   min: 0.5, max: 1,    step: 0.05 },
  { key: 'lead_time',             label: 'Afhendingartími (dagar)', min: 0, max: 365,  step: 1    },
  { key: 'order_freq',            label: 'Pöntunartíðni (dagar)', min: 1,  max: 365,  step: 1    },
]

function SimulationTab({ item, histories = [] }) {
  const [simData, setSimData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useState(SIM_PARAMS_DEFAULT)
  const [showParams, setShowParams] = useState(false)
  const [visible, setVisible] = useState(() => Object.fromEntries(SIM_SERIES.map((s) => [s.key, true])))
  const [refAreaLeft, setRefAreaLeft] = useState(null)
  const [refAreaRight, setRefAreaRight] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoomDomain, setZoomDomain] = useState(null)

  const handleMouseDown = (e) => {
    if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setIsSelecting(true) }
  }
  const handleMouseMove = (e) => {
    if (isSelecting && e?.activeLabel) setRefAreaRight(e.activeLabel)
  }
  const handleMouseUp = (allData) => () => {
    if (!isSelecting || !refAreaLeft || !refAreaRight) { setIsSelecting(false); return }
    const li = allData.findIndex((d) => d.week === refAreaLeft)
    const ri = allData.findIndex((d) => d.week === refAreaRight)
    if (li !== -1 && ri !== -1 && li !== ri) setZoomDomain(li < ri ? [li, ri] : [ri, li])
    setIsSelecting(false); setRefAreaLeft(null); setRefAreaRight(null)
  }

  const { data: simDefaults } = useQuery({
    queryKey: ['sim-defaults', item.id],
    queryFn: () => getSimInput(item.id, { number_of_days: 1, number_of_simulations: 1 }),
  })

  useEffect(() => {
    if (!simDefaults) return
    const item0 = simDefaults.sim_rio_items?.[0]
    setParams((p) => ({
      ...p,
      lead_time: p.lead_time ?? item0?.del_time ?? null,
      order_freq: p.order_freq ?? item0?.buy_freq ?? null,
    }))
  }, [simDefaults])

  const mutation = useMutation({
    mutationFn: async () => {
      const simInput = await getSimInput(item.id, params)
      return runSimulation(simInput)
    },
    onSuccess: (data) => {
      setSimData(data.sim_result || [])
      setError('')
    },
    onError: (err) => {
      setError(err.response?.data?.detail || err.message || 'Villa í hermun')
    },
  })

  const historyByWeek = useMemo(() => aggregateHistoryByWeek(histories), [histories])


  const chartData = useMemo(() => {
    if (!simData) return []
    const simByWeek = {}
    for (const row of aggregateSimByWeek(simData)) {
      simByWeek[row.week] = row
    }
    const allWeeks = new Set([...Object.keys(historyByWeek), ...Object.keys(simByWeek)])
    return Array.from(allWeeks).sort().map((week) => ({
      week,
      actual_qty: historyByWeek[week] ?? null,
      inv: simByWeek[week]?.inv ?? null,
      forecast: simByWeek[week]?.forecast ?? null,
      purchase_qty: simByWeek[week]?.purchase_qty ?? null,
      lost_sale: simByWeek[week]?.lost_sale ?? null,
    }))
  }, [simData, historyByWeek])

  const visibleData = useMemo(() => {
    if (!zoomDomain) return chartData
    return chartData.slice(zoomDomain[0], zoomDomain[1] + 1)
  }, [chartData, zoomDomain])

  const tooltipStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  }

  return (
    <div className="fade-in">
      {/* Params panel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setShowParams((v) => !v)}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showParams ? 'Fela stillingar ▲' : 'Stillingar ▼'}
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary text-sm py-1.5 px-4"
          >
            {mutation.isPending ? 'Keyri…' : 'Keyra hermun'}
          </button>
        </div>
        {showParams && (
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-1 gap-2">
            {SIM_PARAM_FIELDS.map(({ key, label, min, max, step }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-xs text-gray-500 whitespace-nowrap">{label}</label>
                <input
                  type="number"
                  min={min} max={max} step={step}
                  value={params[key] ?? ''}
                  placeholder={params[key] == null ? 'Sjálfgefið' : ''}
                  onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="input-field py-0.5 text-sm w-28 text-right"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!simData && !mutation.isPending && error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <p className="text-red-500 text-sm mb-4">{error}</p>
        </div>
      )}

      {!simData && !mutation.isPending && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <span className="text-4xl mb-3">🧮</span>
          <p className="text-sm text-gray-500">Stilltu breytur og keyrðu hermun</p>
        </div>
      )}

      {mutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner message="Keyri hermun…" />
          <p className="text-xs text-gray-400 mt-3">{params.number_of_days} dagar · {params.number_of_simulations} hermar</p>
        </div>
      )}

      {simData && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { label: 'Meðal lager', value: fmt(chartData.reduce((s, d) => s + d.inv, 0) / (chartData.length || 1), 1) },
              { label: 'Heildar kaup', value: fmt(simData.reduce((s, r) => s + (r.purchase_qty || 0), 0)) },
              { label: 'Týnd sala', value: fmt(simData.reduce((s, r) => s + (r.lost_sale || 0), 0), 1) },
              { label: 'Vikur', value: chartData.length },
            ].map((s) => (
              <div key={s.label} className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs font-medium text-indigo-400 mb-0.5">{s.label}</p>
                <p className="text-lg font-bold text-indigo-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Series toggles */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SIM_SERIES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                style={{
                  borderColor: s.color,
                  background: visible[s.key] ? s.color : 'transparent',
                  color: visible[s.key] ? '#fff' : s.color,
                }}
              >
                {s.label}
              </button>
            ))}
            {zoomDomain && (
              <button onClick={() => setZoomDomain(null)} className="ml-auto btn-secondary text-xs py-0.5 px-2">Zoom út</button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={visibleData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp(chartData)}
              style={{ userSelect: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt(v, 1), n]} />
              {visible.actual_qty && <Bar dataKey="actual_qty" name="Saga" fill="#f97316" radius={[2, 2, 0, 0]} isAnimationActive={false} />}
              {visible.forecast && <Bar dataKey="forecast" name="Spá" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />}
              {visible.inv && <Area type="stepAfter" dataKey="inv" name="Lager" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />}
              {visible.purchase_qty && <Bar dataKey="purchase_qty" name="Kaup" fill="#10b981" radius={[2, 2, 0, 0]} isAnimationActive={false} />}
              {isSelecting && refAreaLeft && refAreaRight && (
                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} fill="#6366f1" fillOpacity={0.15} />
              )}
            </ComposedChart>
          </ResponsiveContainer>

        </>
      )}
    </div>
  )
}

const COLS = [
  { key: 'item_number', label: 'Hlut #', render: (v) => <span className="badge badge-blue font-mono">{v}</span> },
  { key: 'description', label: 'Lýsing', render: (v) => <span className="truncate max-w-xs block">{v?.trim() || '—'}</span> },
  { key: 'location_name', label: 'Staðsetning', render: (v) => v || '—' },
  { key: 'price', label: 'Verð', render: (v) => <span className="font-mono">{fmt(v)}</span>, right: true },
  { key: 'stock_level', label: 'Lager', render: (v) => <span className="font-mono">{fmt(v, 1)}</span>, right: true },
  { key: 'last_year_usage', label: 'Notkun í ár', render: (v) => <span className="font-mono">{fmt(v)}</span>, right: true },
  {
    key: 'purchasing_method',
    label: 'Aðferð',
    render: (v) => v ? <span className="badge badge-blue text-xs">{v}</span> : '—',
  },
  { key: 'purchase_suggestion', label: 'Tillaga', render: (v) => <span className="font-mono font-semibold text-blue-700">{fmt(v)}</span>, right: true },
]

export default function ItemsPage() {
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('history')
  const [viewMode, setViewMode] = useState('table')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => listRows('items', { limit: 200, offset: 0 }),
  })

  const { data: historiesData, isLoading: historiesLoading } = useQuery({
    queryKey: ['item-histories', selectedItem?.id],
    queryFn: () => getItemHistories(selectedItem.id),
    enabled: !!selectedItem,
  })

  const allItems = itemsData?.rows || []

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems
    const q = search.toLowerCase()
    return allItems.filter((item) =>
      [item.item_number, item.description, item.location_name, item.vendor_name].some((v) =>
        String(v || '').toLowerCase().includes(q),
      ),
    )
  }, [allItems, search])

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Items</h1>
          <p className="text-gray-500 text-sm mt-1">
            {itemsLoading ? 'Hleð…' : `${filteredItems.length} / ${allItems.length} hlutir`}
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
                  viewMode === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
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

      {/* Split layout */}
      <div className="flex gap-5 items-start">
        {/* Left: Table or Cards */}
        <div className="flex-1 min-w-0">
          {itemsLoading ? (
            <div className="card flex items-center justify-center py-20">
              <LoadingSpinner message="Hleð hlutum…" />
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
                        onClick={() => { setSelectedItem(isSelected ? null : item); setActiveTab('history') }}
                        className={`table-row transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : 'border-l-[3px] border-l-transparent'
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
                const miniData = isSelected && historiesData
                  ? aggregateByMonth(historiesData.filter((h) => h.item_id === item.id)).slice(-24)
                  : null
                return (
                  <div
                    key={item.id}
                    onClick={() => { setSelectedItem(isSelected ? null : item); setActiveTab('history') }}
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
                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
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
                    {isSelected ? (
                      miniData?.length > 0 ? (
                        <div className="-mx-1">
                          <p className="text-xs text-gray-400 mb-1 px-1">Saga (24 mán.)</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={miniData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                              <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                              <YAxis hide />
                              <Tooltip
                                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                                formatter={(v) => [fmt(v, 1), 'Neysla']}
                              />
                              <Bar dataKey="qty" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[80px] flex items-center justify-center text-xs text-gray-300 bg-gray-50 rounded-lg">
                          {historiesLoading ? 'Hleð…' : 'Engin saga'}
                        </div>
                      )
                    ) : (
                      <div className="h-[50px] flex items-end gap-px px-1">
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

        {/* Right: Panel — sticky so it stays visible while scrolling */}
        <div className="w-[440px] flex-shrink-0 card sticky top-4">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <span className="text-5xl mb-4">📈</span>
              <p className="text-sm font-medium">Veldu línu til að sjá gögn</p>
            </div>
          ) : (
            <>
              {/* Tabs + expand button */}
              <div className="flex items-center border-b border-gray-200 mb-5 -mx-6 px-6">
                {[
                  { id: 'history', label: 'Saga' },
                  { id: 'simulation', label: 'Hermun' },
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
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="ml-auto mb-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Opna stórt
                </button>
              </div>

              {activeTab === 'history' ? (
                <HistoryChart item={selectedItem} histories={historiesData} loading={historiesLoading} />
              ) : (
                <SimulationTab key={selectedItem.id} item={selectedItem} histories={historiesData || []} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Full-screen modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <p className="text-sm text-gray-500 font-mono">
                  <span className="font-semibold text-blue-600">{selectedItem.item_number}</span>
                  {' · '}{selectedItem.description?.trim()}
                  {' · '}{selectedItem.location_name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {[{ id: 'history', label: 'Saga' }, { id: 'simulation', label: 'Hermun' }].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Loka
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'history' ? (
                <HistoryChart item={selectedItem} histories={historiesData} loading={historiesLoading} />
              ) : (
                <SimulationTab key={`modal-${selectedItem.id}`} item={selectedItem} histories={historiesData || []} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
