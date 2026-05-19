import { Fragment, useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listRows, startMultiSimJob, getJobStatus, getSimPrep, getSimInput, updateRow } from '../api/items.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'

const PAGE_SIZE = 25
const SIMULATOR_SERIES = [
  { key: 'inventory_level', label: 'Inventory level', color: '#f59e0b' },
  { key: 'forecast', label: 'Forecast', color: '#ef4444' },
  { key: 'deliveries', label: 'Deliveries', color: '#16a34a' },
  { key: 'history', label: 'History', color: '#2563eb' },
  { key: 'purchase_qty', label: 'Purchase_qty', color: '#15803d' },
]

function fmt(v, decimals = 0) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toLocaleString('is-IS', { maximumFractionDigits: decimals })
}

function fmtAxisNumber(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString('is-IS', { maximumFractionDigits: Number.isInteger(n) ? 0 : 1 })
}

function StockBadge({ value }) {
  if (value == null) return <span className="text-gray-400">—</span>
  const n = Number(value)
  if (n > 0) return <span className="badge badge-blue">{fmt(n)}</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">0</span>
}

function FilterSelect({ label, value, onChange, options, allLabel = 'Allt' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-1.5 text-sm min-w-36"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function HistogramChart({ data, servLevelValue, title, color = '#3b82f6', compact = false }) {
  if (!data?.length) return <p className="text-gray-400 text-sm text-center py-8">Engin gögn</p>
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1">
        <div>
          {!compact && <p className="text-xs text-gray-500 mb-1">Est. usage based on service level</p>}
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-700`}>{title}</p>
        </div>
        <p className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-gray-800 leading-none`}>{servLevelValue ?? '—'}</p>
      </div>
      <ResponsiveContainer width="100%" height={compact ? 130 : 180}>
        <ComposedChart data={data} margin={{ top: 4, right: compact ? 28 : 40, left: compact ? 8 : 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="bin_edges" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtAxisNumber} tick={{ fontSize: 11 }} label={{ value: 'Usage', position: 'insideBottom', offset: -2, fontSize: 11 }} height={36} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            width={compact ? 36 : 48}
            label={compact ? undefined : { value: 'Occurrences', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 11 }}
            width={compact ? 36 : 48}
            label={compact ? undefined : { value: 'Service Level', angle: 90, position: 'insideRight', offset: 10, fontSize: 11 }}
          />
          <Tooltip
            formatter={(v, name) => [
              name === 'cumulative_frequency' ? `${(v * 100).toFixed(1)}%` : fmtAxisNumber(v),
              name === 'cumulative_frequency' ? 'Service Level' : 'Sale',
            ]}
            labelFormatter={(l) => `Usage: ${fmtAxisNumber(l)}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'frequency' ? 'Sale' : 'Service Level'} />
          <Bar yAxisId="left" dataKey="frequency" fill={color} opacity={0.85} name="frequency" />
          <Line yAxisId="right" type="monotone" dataKey="cumulative_frequency" stroke="#93c5fd" strokeWidth={2} dot={false} name="cumulative_frequency" />
          {servLevelValue != null && (
            <ReferenceLine yAxisId="left" x={servLevelValue} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" label={{ value: fmtAxisNumber(servLevelValue), position: 'top', fill: '#ef4444', fontSize: 11 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function dateKey(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function dateTs(value) {
  const day = dateKey(value)
  if (!day) return null
  const ts = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(ts) ? ts : null
}

function formatAxisDate(value) {
  if (value == null) return ''
  return new Date(value).toLocaleDateString('is-IS', { year: 'numeric', month: 'short' })
}

function numericValue(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function visibleSaleValue(value) {
  const n = numericValue(value)
  if (n == null || n <= 0 || n === -1000001) return null
  return n
}

function historySaleValue(value) {
  const n = numericValue(value)
  if (n == null || n === -1000001) return null
  return Math.max(n, 0)
}

function WideBarShape(props) {
  const { x, y, width, height, fill, fillOpacity, value, barWidth = 6 } = props
  if (value == null || Number(value) === 0 || height == null || x == null || y == null) return null

  const barHeight = Math.max(height, 2)
  const centerX = x + (width || 0) / 2

  return (
    <rect
      x={centerX - barWidth / 2}
      y={y}
      width={barWidth}
      height={barHeight}
      fill={fill}
      fillOpacity={fillOpacity ?? 0.95}
      rx={1}
    />
  )
}

function countVisibleBars(rows, key) {
  return rows.reduce((count, row) => {
    const value = numericValue(row[key])
    return value != null && value !== 0 ? count + 1 : count
  }, 0)
}

function barWidthForCount(count) {
  if (!count) return 0
  return Math.max(1.5, Math.min(7, 32 / Math.sqrt(count)))
}

function buildSimulatorChartData(data, historyRows = []) {
  const rows = new Map()
  const ensureRow = (day) => {
    if (!day) return null
    if (!rows.has(day)) {
      rows.set(day, {
        day,
        ts: dateTs(day),
        inventory_level: null,
        forecast: null,
        deliveries: null,
        history: null,
        purchase_qty: null,
      })
    }
    return rows.get(day)
  }

  for (const history of historyRows || []) {
    const row = ensureRow(dateKey(history.day || history.consumption_date))
    if (!row) continue
    row.history = historySaleValue(history.actual_sale ?? history.qty) ?? row.history
  }

  for (const input of data?.simulator_input_his || []) {
    const row = ensureRow(dateKey(input.day))
    if (!row) continue
    row.deliveries = numericValue(input.delivery)
    row.history = visibleSaleValue(input.actual_sale) ?? row.history
  }

  for (const result of data?.sim_result || []) {
    const row = ensureRow(dateKey(result.sim_date || result.day))
    if (!row) continue
    row.inventory_level = numericValue(result.inv)
    row.purchase_qty = numericValue(result.purchase_qty)
    row.deliveries = numericValue(result.deliveries) ?? row.deliveries
    row.forecast = numericValue(result.forecast) ?? row.forecast
    row.history = visibleSaleValue(result.actual_sale) ?? row.history
  }

  return Array.from(rows.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .filter((row) =>
      row.inventory_level != null ||
      row.forecast != null ||
      row.deliveries != null ||
      row.history != null ||
      row.purchase_qty != null
    )
}

function SimulatorResultChart({ data, historyRows }) {
  const [visible, setVisible] = useState(() => ({
    inventory_level: true,
    forecast: true,
    deliveries: false,
    history: true,
    purchase_qty: false,
  }))
  const [zoomRange, setZoomRange] = useState(null)
  const [selection, setSelection] = useState({ left: null, right: null })
  const chartData = useMemo(() => buildSimulatorChartData(data, historyRows), [data, historyRows])
  if (!chartData.length) return <p className="text-gray-400 text-sm text-center py-8">Engin hermunargögn til að teikna</p>

  const displayedData = zoomRange ? chartData.slice(zoomRange.start, zoomRange.end + 1) : chartData
  const interval = Math.max(Math.floor(displayedData.length / 8), 0)
  const barWidths = useMemo(() => ({
    forecast: barWidthForCount(countVisibleBars(displayedData, 'forecast')),
    deliveries: barWidthForCount(countVisibleBars(displayedData, 'deliveries')),
    history: barWidthForCount(countVisibleBars(displayedData, 'history')),
    purchase_qty: barWidthForCount(countVisibleBars(displayedData, 'purchase_qty')),
  }), [displayedData])
  const toggleSeries = (key) => setVisible((current) => ({ ...current, [key]: !current[key] }))
  const clearSelection = () => setSelection({ left: null, right: null })

  const zoomToSelection = () => {
    if (selection.left == null || selection.right == null || selection.left === selection.right) {
      clearSelection()
      return
    }

    const leftIndex = chartData.findIndex((row) => row.ts === selection.left)
    const rightIndex = chartData.findIndex((row) => row.ts === selection.right)
    if (leftIndex < 0 || rightIndex < 0) {
      clearSelection()
      return
    }

    const start = Math.min(leftIndex, rightIndex)
    const end = Math.max(leftIndex, rightIndex)
    if (end - start >= 1) setZoomRange({ start, end })
    clearSelection()
  }

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={displayedData}
          margin={{ top: 10, right: 28, left: 0, bottom: 0 }}
          barCategoryGap={0}
          barGap={0}
          onMouseDown={(event) => setSelection({ left: event?.activeLabel ?? null, right: null })}
          onMouseMove={(event) => {
            if (selection.left != null) setSelection((current) => ({ ...current, right: event?.activeLabel ?? current.right }))
          }}
          onMouseUp={zoomToSelection}
          onMouseLeave={clearSelection}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval={interval}
          />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => fmt(v)} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(value) => new Date(value).toISOString().slice(0, 10)}
            formatter={(value, name) => [fmt(value, 1), name]}
          />
          {selection.left != null && selection.right != null && (
            <ReferenceArea
              x1={selection.left}
              x2={selection.right}
              strokeOpacity={0.25}
              fill="#bfdbfe"
              fillOpacity={0.35}
            />
          )}
          {visible.inventory_level && (
            <Area
              type="stepAfter"
              dataKey="inventory_level"
              name="Inventory level"
              stroke="#f59e0b"
              fill="#fbbf24"
              fillOpacity={0.22}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          )}
          {visible.forecast && <Bar dataKey="forecast" name="Forecast" fill="#ef4444" fillOpacity={0.9} shape={<WideBarShape barWidth={barWidths.forecast} />} />}
          {visible.deliveries && <Bar dataKey="deliveries" name="Deliveries" fill="#16a34a" fillOpacity={0.9} shape={<WideBarShape barWidth={barWidths.deliveries} />} />}
          {visible.history && <Bar dataKey="history" name="History" fill="#2563eb" fillOpacity={0.9} shape={<WideBarShape barWidth={barWidths.history} />} />}
          {visible.purchase_qty && <Bar dataKey="purchase_qty" name="Purchase_qty" fill="#15803d" fillOpacity={0.9} shape={<WideBarShape barWidth={barWidths.purchase_qty} />} />}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-4 flex-wrap text-xs">
        {zoomRange && (
          <button
            type="button"
            onClick={() => setZoomRange(null)}
            className="font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Reset zoom
          </button>
        )}
        <span className="text-gray-400">{displayedData.length} af {chartData.length} dögum</span>
        {SIMULATOR_SERIES.map((series) => (
          <label
            key={series.key}
            className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              visible[series.key] ? 'text-gray-700' : 'text-gray-400'
            }`}
          >
            <input
              type="checkbox"
              checked={visible[series.key]}
              onChange={() => toggleSeries(series.key)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color, opacity: visible[series.key] ? 1 : 0.35 }} />
            {series.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function SimParamsControls({
  simParams,
  setSimParams,
  inventoryParams,
  setInventoryParams,
  savingInventoryParams,
  inventorySaveError,
  savingServiceLevel,
  saveServiceLevel,
  disabled,
}) {
  const [serviceLevelInput, setServiceLevelInput] = useState(String(simParams.service_level))
  return (
    <div className="border-y border-gray-100 py-2 mb-3">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Þjónustuhlutfall</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0.01" max="1" step="0.01"
              value={serviceLevelInput}
              onChange={(e) => setServiceLevelInput(e.target.value)}
              onBlur={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v > 0 && v <= 1) {
                  setSimParams((p) => ({ ...p, service_level: v }))
                  setServiceLevelInput(String(v))
                } else {
                  setServiceLevelInput(String(simParams.service_level))
                }
              }}
              className="input-field py-1.5 w-24 text-sm"
            />
            <button
              onClick={saveServiceLevel}
              disabled={savingServiceLevel || disabled}
              className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg border border-gray-200 transition-colors"
            >
              {savingServiceLevel ? '…' : 'Vista'}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Fjöldi daga</label>
          <input
            type="number" min="1" step="1"
            value={simParams.number_of_days}
            onChange={(e) => setSimParams((p) => ({ ...p, number_of_days: parseInt(e.target.value) || 900 }))}
            className="input-field py-1.5 w-28 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Fjöldi hermana</label>
          <input
            type="number" min="1" step="100"
            value={simParams.number_of_simulations}
            onChange={(e) => setSimParams((p) => ({ ...p, number_of_simulations: parseInt(e.target.value) || 1000 }))}
            className="input-field py-1.5 w-28 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Lead time</label>
          <input
            type="number" min="0" step="1"
            value={inventoryParams.lead_time}
            onChange={(e) => setInventoryParams((p) => ({ ...p, lead_time: e.target.value }))}
            className="input-field py-1.5 w-28 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Buy freq</label>
          <input
            type="number" min="1" step="1"
            value={inventoryParams.buy_freq}
            onChange={(e) => setInventoryParams((p) => ({ ...p, buy_freq: e.target.value }))}
            className="input-field py-1.5 w-28 text-sm"
          />
        </div>
        <div className="pb-2 text-xs min-w-28">
          {savingInventoryParams && <span className="text-blue-500">Vista breytingar…</span>}
          {!savingInventoryParams && inventorySaveError && <span className="text-red-500">{inventorySaveError}</span>}
        </div>
      </div>
    </div>
  )
}

function SimPrepPanel({ item, simParams, setSimParams, savingServiceLevel, saveServiceLevel, controlsDisabled, onClose }) {
  const queryClient = useQueryClient()
  const initialInventoryParams = useMemo(() => ({
    lead_time: item.del_time == null ? '' : String(item.del_time),
    buy_freq: item.buy_freq == null ? '' : String(item.buy_freq),
  }), [item.id, item.del_time, item.buy_freq])
  const [inventoryParams, setInventoryParams] = useState(initialInventoryParams)
  const [savedInventoryParams, setSavedInventoryParams] = useState(initialInventoryParams)
  const [savingInventoryParams, setSavingInventoryParams] = useState(false)
  const [inventorySaveError, setInventorySaveError] = useState('')

  useEffect(() => {
    setInventoryParams(initialInventoryParams)
    setSavedInventoryParams(initialInventoryParams)
    setSavingInventoryParams(false)
    setInventorySaveError('')
  }, [initialInventoryParams])

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'sim-prep',
      item.id,
      simParams.service_level,
      simParams.number_of_days,
      simParams.number_of_simulations,
      savedInventoryParams.lead_time,
      savedInventoryParams.buy_freq,
    ],
    queryFn: () => getSimPrep(item.id, simParams),
    staleTime: 300_000,
  })
  const { data: simInputData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['sim-input-history', item.id, simParams.service_level, simParams.number_of_days, simParams.number_of_simulations],
    queryFn: () => getSimInput(item.id, { ...simParams, db: 'Demo' }),
    staleTime: 300_000,
  })

  useEffect(() => {
    const leadTime = Number(inventoryParams.lead_time)
    const buyFreq = Number(inventoryParams.buy_freq)
    const savedLeadTime = Number(savedInventoryParams.lead_time)
    const savedBuyFreq = Number(savedInventoryParams.buy_freq)

    if (
      inventoryParams.lead_time === '' ||
      inventoryParams.buy_freq === '' ||
      !Number.isFinite(leadTime) ||
      !Number.isFinite(buyFreq) ||
      leadTime < 0 ||
      buyFreq < 1 ||
      (leadTime === savedLeadTime && buyFreq === savedBuyFreq)
    ) {
      return undefined
    }

    const timeout = setTimeout(async () => {
      setSavingInventoryParams(true)
      setInventorySaveError('')
      try {
        await updateRow('items', item.id, { del_time: leadTime, buy_freq: buyFreq }, { db: 'Demo' })
        const nextSaved = { lead_time: String(leadTime), buy_freq: String(buyFreq) }
        setSavedInventoryParams(nextSaved)
        queryClient.invalidateQueries({ queryKey: ['items-catalog'] })
      } catch (err) {
        setInventorySaveError(err?.response?.data?.detail || err.message || 'Villa við vistun')
      } finally {
        setSavingInventoryParams(false)
      }
    }, 700)

    return () => clearTimeout(timeout)
  }, [inventoryParams, savedInventoryParams, item.id, queryClient])

  return (
    <div className="card border-t-2 border-blue-500">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 font-mono">{item.item_number}</p>
          <h3 className="font-semibold text-gray-800">{item.description || 'Vörugreiningar'}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <SimParamsControls
        simParams={simParams}
        setSimParams={setSimParams}
        inventoryParams={inventoryParams}
        setInventoryParams={setInventoryParams}
        savingInventoryParams={savingInventoryParams}
        inventorySaveError={inventorySaveError}
        savingServiceLevel={savingServiceLevel}
        saveServiceLevel={saveServiceLevel}
        disabled={controlsDisabled}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner message="Sæki histogram gögn…" />
        </div>
      )}
      {isError && (
        <p className="text-red-500 text-sm text-center py-8">Villa við að sækja gögn</p>
      )}
      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] gap-4 items-start min-w-0 overflow-hidden">
          <SimulatorResultChart data={data} historyRows={simInputData?.sim_input_his || []} />
          {isHistoryLoading && (
            <p className="xl:col-span-2 text-xs text-gray-400 -mt-3">
              Sæki sögu úr item_histories…
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 min-w-0 overflow-hidden">
            <HistogramChart
              data={data.histo_with_cum_buy}
              servLevelValue={data.serv_level_value_buy}
              title="Histogram of buying frequency"
              color="#3b82f6"
              compact
            />
            <HistogramChart
              data={data.histo_with_cum_lead}
              servLevelValue={data.serv_level_value_lead}
              title="Histogram of lead time"
              color="#3b82f6"
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ItemCatalog() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Filter state
  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [filterOrg, setFilterOrg] = useState('')
  const [filterMoves, setFilterMoves] = useState(new Set())
  const [filterSuggestion, setFilterSuggestion] = useState('')

  // Table state
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState('id')
  const [sortDir, setSortDir] = useState('asc')

  // Selected item for histogram
  const [selectedItem, setSelectedItem] = useState(null)

  // Simulation params
  const [simParams, setSimParams] = useState({ service_level: 0.95, number_of_days: 900, number_of_simulations: 1000 })
  const [savingServiceLevel, setSavingServiceLevel] = useState(false)

  // Simulation job state
  const [simJob, setSimJob] = useState(null)
  const pollRef = useRef(null)
  const selectedPanelRef = useRef(null)

  useEffect(() => {
    if (!selectedItem) return
    const timeout = setTimeout(() => {
      const top = selectedPanelRef.current?.getBoundingClientRect().top
      if (top == null) return
      window.scrollTo({ top: window.scrollY + top - 88, behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(timeout)
  }, [selectedItem])

  // Data fetching
  const { data, isLoading, isError } = useQuery({
    queryKey: ['items-catalog'],
    queryFn: () => listRows('items', { limit: 1000, offset: 0, db: 'Demo' }),
    staleTime: 60_000,
  })

  const allRows = useMemo(() => data?.rows || [], [data])
  const locations = useMemo(() => [...new Set(allRows.map((r) => r.location_name).filter(Boolean))].sort(), [allRows])
  const methods = useMemo(() => [...new Set(allRows.map((r) => r.purchasing_method).filter(Boolean))].sort(), [allRows])
  const orgs = useMemo(() => [...new Set(allRows.map((r) => r.organisation).filter(Boolean))].sort(), [allRows])

  const filtered = useMemo(() => {
    let rows = allRows

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((r) =>
        String(r.item_number || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.vendor_name || '').toLowerCase().includes(q)
      )
    }
    if (filterLocation) rows = rows.filter((r) => r.location_name === filterLocation)
    if (filterMethod) rows = rows.filter((r) => r.purchasing_method === filterMethod)
    if (filterOrg) rows = rows.filter((r) => r.organisation === filterOrg)
    if (filterStock === 'in_stock') rows = rows.filter((r) => Number(r.stock_level) > 0)
    if (filterStock === 'out_of_stock') rows = rows.filter((r) => !r.stock_level || Number(r.stock_level) === 0)
    if (filterStock === 'on_order') rows = rows.filter((r) => Number(r.qty_on_order) > 0)

    if (filterMoves.size > 0) {
      rows = rows.filter((r) => {
        const n = Number(r.num_move_last_year) || 0
        return (filterMoves.has('0') && n === 0) ||
               (filterMoves.has('1-5') && n >= 1 && n <= 5) ||
               (filterMoves.has('6-20') && n >= 6 && n <= 20) ||
               (filterMoves.has('20+') && n > 20)
      })
    }
    if (filterSuggestion === 'has') rows = rows.filter((r) => Number(r.purchase_suggestion) > 0)
    if (filterSuggestion === 'none') rows = rows.filter((r) => !r.purchase_suggestion || Number(r.purchase_suggestion) === 0)

    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const an = Number(av)
      const bn = Number(bv)
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv), 'is')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allRows, search, filterLocation, filterMethod, filterOrg, filterStock, filterMoves, filterSuggestion, sortCol, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Simulation
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const runSimulation = useCallback(async () => {
    const itemIds = filtered.map((r) => r.id).filter(Boolean)
    if (itemIds.length === 0) return
    setSimJob({ status: 'starting', message: `Ræsi simulation fyrir ${itemIds.length} vörur…` })
    stopPolling()
    try {
      const { job_id } = await startMultiSimJob(itemIds, simParams)
      setSimJob({ jobId: job_id, status: 'running', message: 'Simulation í gangi…' })
      pollRef.current = setInterval(async () => {
        try {
          const job = await getJobStatus(job_id)
          if (job.status === 'done') {
            stopPolling()
            const saved = job.result?.sim_result?.saved ?? '?'
            const updated = job.result?.purchase_suggestions?.updated ?? '?'
            const timing = job.result?.timing_seconds?.total
            setSimJob({ jobId: job_id, status: 'done', message: `Lokið — ${saved} línur vistaðar, ${updated} pöntunarleggur uppfærðir${timing ? ` (${timing}s)` : ''}` })
            queryClient.invalidateQueries({ queryKey: ['items-catalog'] })
          } else if (job.status === 'error') {
            stopPolling()
            setSimJob({ jobId: job_id, status: 'error', message: job.error || 'Óþekkt villa' })
          }
        } catch {
          stopPolling()
          setSimJob((prev) => ({ ...prev, status: 'error', message: 'Villa við að sækja stöðu' }))
        }
      }, 8000)
    } catch (err) {
      setSimJob({ status: 'error', message: err?.response?.data?.detail || err.message || 'Villa við að ræsa' })
    }
  }, [filtered, simParams, stopPolling, queryClient])

  const saveServiceLevel = useCallback(async () => {
    setSavingServiceLevel(true)
    try {
      await Promise.all(
        filtered.map((row) =>
          updateRow('items', row.id, { service_level: simParams.service_level }, { db: 'Demo' })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['items-catalog'] })
    } finally {
      setSavingServiceLevel(false)
    }
  }, [filtered, simParams.service_level, queryClient])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  const handleFilter = (setter) => (val) => { setter(val); setPage(0) }

  const clearFilters = () => {
    setSearch(''); setFilterLocation(''); setFilterMethod('')
    setFilterStock(''); setFilterOrg(''); setFilterMoves(new Set()); setFilterSuggestion(''); setPage(0)
  }

  const hasFilters = search || filterLocation || filterMethod || filterStock || filterOrg || filterMoves.size > 0 || filterSuggestion

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const cols = [
    { key: 'item_number', label: 'Vörunúmer' },
    { key: 'description', label: 'Lýsing' },
    { key: 'vendor_name', label: 'Birgir' },
    { key: 'location_name', label: 'Staðsetning' },
    { key: 'stock_level', label: 'Birgðir' },
    { key: 'qty_on_order', label: 'Á pöntun' },
    { key: 'purchase_suggestion', label: 'Pöntunarlegg.' },
    { key: 'purchasing_method', label: 'Aðferð' },
    { key: 'last_year_usage', label: 'Not. s. ár' },
    { key: 'num_move_last_year', label: 'Hreyfingar' },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Vörulisti</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isLoading ? 'Hleður...' : `${filtered.length} vörur${allRows.length !== filtered.length ? ` af ${allRows.length}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {simJob && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              simJob.status === 'done' ? 'bg-green-50 text-green-700 border border-green-200' :
              simJob.status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {(simJob.status === 'starting' || simJob.status === 'running') && (
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
              {simJob.status === 'done' && <span>✓</span>}
              {simJob.status === 'error' && <span>✕</span>}
              <span>{simJob.message}</span>
              <button onClick={() => { stopPolling(); setSimJob(null) }} className="ml-1 opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          <button
            onClick={runSimulation}
            disabled={filtered.length === 0 || simJob?.status === 'starting' || simJob?.status === 'running'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <span>▶</span>
            Keyra simulation ({filtered.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Leita eftir vörunúmeri, lýsingu eða birgi…"
            className="input-field pl-9"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <FilterSelect label="Staðsetning" value={filterLocation} onChange={handleFilter(setFilterLocation)} options={locations} />
          <FilterSelect label="Kaupferli" value={filterMethod} onChange={handleFilter(setFilterMethod)} options={methods} />
          {orgs.length > 1 && (
            <FilterSelect label="Fyrirtæki" value={filterOrg} onChange={handleFilter(setFilterOrg)} options={orgs} />
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birgðastaða</label>
            <div className="flex gap-1">
              {[
                { val: '', label: 'Allt' },
                { val: 'in_stock', label: 'Á lager' },
                { val: 'out_of_stock', label: 'Uppurið' },
                { val: 'on_order', label: 'Á pöntun' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => handleFilter(setFilterStock)(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filterStock === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hreyfingar (s. ár)</label>
            <div className="flex gap-1">
              {[
                { val: '0', label: '0' },
                { val: '1-5', label: '1–5' },
                { val: '6-20', label: '6–20' },
                { val: '20+', label: '20+' },
              ].map(({ val, label }) => (
                <button key={val}
                  onClick={() => {
                    setFilterMoves((prev) => {
                      const next = new Set(prev)
                      next.has(val) ? next.delete(val) : next.add(val)
                      return next
                    })
                    setPage(0)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filterMoves.has(val) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pöntunarleggur</label>
            <div className="flex gap-1">
              {[
                { val: '', label: 'Allt' },
                { val: 'has', label: '> 0' },
                { val: 'none', label: '= 0' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => handleFilter(setFilterSuggestion)(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filterSuggestion === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors">
              ✕ Hreinsa filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24"><LoadingSpinner message="Hleður vörur…" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-gray-500">Villa við að sækja gögn</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-gray-500">Engar vörur fundust</p>
            {hasFilters && <button onClick={clearFilters} className="mt-3 text-sm text-blue-500 hover:underline">Hreinsa filter</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {cols.map((col) => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors">
                      {col.label}<SortIcon col={col.key} />
                    </th>
                  ))}
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <Fragment key={row.id || idx}>
                    <tr
                      className={`table-row cursor-pointer ${selectedItem?.id === row.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedItem(selectedItem?.id === row.id ? null : row)}
                    >
                      <td className="table-cell font-mono text-xs text-blue-600">{row.item_number || '—'}</td>
                      <td className="table-cell"><span className="truncate block max-w-xs" title={row.description}>{row.description || '—'}</span></td>
                      <td className="table-cell text-gray-600">{row.vendor_name || '—'}</td>
                      <td className="table-cell">{row.location_name || '—'}</td>
                      <td className="table-cell text-right"><StockBadge value={row.stock_level} /></td>
                      <td className="table-cell text-right text-gray-600">{fmt(row.qty_on_order)}</td>
                      <td className="table-cell text-right font-medium text-blue-700">{fmt(row.purchase_suggestion)}</td>
                      <td className="table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{row.purchasing_method || '—'}</span>
                      </td>
                      <td className="table-cell text-right text-gray-600">{fmt(row.last_year_usage)}</td>
                      <td className="table-cell text-right text-gray-600">{fmt(row.num_move_last_year)}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/items/${row.id}`, { state: { row, table: 'items' } }) }}
                          className="text-blue-500 text-xs font-medium hover:underline"
                        >
                          Skoða →
                        </button>
                      </td>
                    </tr>
                    {selectedItem?.id === row.id && (
                      <tr>
                        <td colSpan={cols.length + 1} className="bg-blue-50/40 p-3">
                          <div
                            ref={selectedPanelRef}
                            className="sticky left-3 max-w-full min-w-0 overflow-hidden"
                            style={{ width: 'min(100%, calc(100vw - 27rem))' }}
                          >
                            <SimPrepPanel
                              item={selectedItem}
                              simParams={simParams}
                              setSimParams={setSimParams}
                              savingServiceLevel={savingServiceLevel}
                              saveServiceLevel={saveServiceLevel}
                              controlsDisabled={filtered.length === 0}
                              onClose={() => setSelectedItem(null)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Síða {page + 1} / {totalPages} — {filtered.length} vörur</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-3 disabled:opacity-40">← Fyrri</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`py-1.5 px-3 rounded-lg text-sm font-medium border transition-all ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'btn-secondary'}`}>
                  {p + 1}
                </button>
              )
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">Næsta →</button>
          </div>
        </div>
      )}
    </div>
  )
}
