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
  LineChart,
  Line,
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
  const filtered = useMemo(() => {
    if (!histories || !item) return []
    return histories.filter((h) => h.item_id === item.id)
  }, [histories, item])

  const chartData = useMemo(() => aggregateByMonth(filtered), [filtered])
  const yearData = useMemo(() => aggregateByYear(filtered), [filtered])

  const total = chartData.reduce((s, d) => s + d.qty, 0)
  const avg = chartData.length ? total / chartData.length : 0
  const peak = chartData.length ? Math.max(...chartData.map((d) => d.qty)) : 0

  return (
    <div className="fade-in h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="section-title">Neyslusaga</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-mono font-semibold text-blue-600">{item.item_number}</span>
            {' · '}
            <span>{item.description?.trim() || '—'}</span>
            {' · '}
            <span className="text-gray-400">{item.location_name}</span>
          </p>
        </div>
        {chartData.length > 0 && (
          <span className="badge badge-blue">{chartData.length} mánuðir</span>
        )}
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

          {/* Area chart */}
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="qty"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#histGrad)"
                dot={chartData.length <= 36}
                activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 0 }}
              />
            </AreaChart>
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
                  <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
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

function SimulationTab({ item }) {
  const [simData, setSimData] = useState(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const simInput = await getSimInput(item.id)
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

  useEffect(() => {
    mutation.mutate()
  }, [])

  const chartData = useMemo(() => {
    if (!simData) return []
    return aggregateSimByWeek(simData)
  }, [simData])

  const tooltipStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  }

  return (
    <div className="fade-in">
      {!simData && !mutation.isPending && error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button onClick={() => mutation.mutate()} className="btn-secondary text-sm">
            Reyna aftur
          </button>
        </div>
      )}

      {mutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner message="Keyri hermun…" />
          <p className="text-xs text-gray-400 mt-3">900 dagar · 1000 hermar</p>
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

          {/* Chart */}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="inv" name="Lager" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="forecast" name="Spá" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="purchase_qty" name="Kaup" stroke="#10b981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          <button
            onClick={() => { setSimData(null); mutation.reset() }}
            className="btn-secondary text-xs py-1 px-3 mt-4 w-full"
          >
            Keyra aftur
          </button>
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

      {/* Split layout */}
      <div className="flex gap-5 items-start">
        {/* Left: Table */}
        <div className="flex-1 min-w-0 card p-0 overflow-hidden">
          {itemsLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner message="Hleð hlutum…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-gray-500">Engir hlutir fundust</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {COLS.map((col) => (
                      <th
                        key={col.key}
                        className={`table-header ${col.right ? 'text-right' : ''}`}
                      >
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
                          isSelected
                            ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                            : 'border-l-[3px] border-l-transparent'
                        }`}
                      >
                        {COLS.map((col) => (
                          <td
                            key={col.key}
                            className={`table-cell ${col.right ? 'text-right' : ''}`}
                          >
                            {col.render(item[col.key])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-5 -mx-6 px-6">
                {[
                  { id: 'history', label: 'Neyslusaga' },
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
              </div>

              {activeTab === 'history' ? (
                <HistoryChart
                  item={selectedItem}
                  histories={historiesData?.rows}
                  loading={historiesLoading}
                />
              ) : (
                <SimulationTab key={selectedItem.id} item={selectedItem} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
