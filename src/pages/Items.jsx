import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { listTables, listRows } from '../api/items.js'
import { useDatabase } from '../context/DatabaseContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const PAGE_SIZE = 20

export default function Items() {
  const { t } = useTranslation()
  const { selectedDb } = useDatabase()
  const navigate = useNavigate()
  const location = useLocation()

  const [selectedTable, setSelectedTable] = useState(location.state?.table || '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Load available tables
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: listTables,
  })

  const tables = useMemo(() => {
    if (!tablesData) return []
    if (Array.isArray(tablesData)) return tablesData.map((t) => (typeof t === 'string' ? t : t.name))
    return (tablesData.tables || []).map((t) => (typeof t === 'string' ? t : t.name))
  }, [tablesData])

  // Load rows from selected table
  const {
    data: rowsData,
    isLoading: rowsLoading,
    isError: rowsError,
  } = useQuery({
    queryKey: ['rows', selectedTable, page, selectedDb],
    queryFn: () => listRows(selectedTable, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, db: selectedDb }),
    enabled: !!selectedTable,
  })

  // Auto-select first table when tables load
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0])
    }
  }, [tables, selectedTable])

  // Reset page on table change
  useEffect(() => {
    setPage(0)
    setSearch('')
  }, [selectedTable])

  const rawRows = useMemo(() => {
    if (!rowsData) return []
    return rowsData.rows || []
  }, [rowsData])

  const totalRows = rowsData?.total || rawRows.length

  // Get column keys from first row
  const columns = useMemo(() => {
    if (rawRows.length === 0) return []
    return Object.keys(rawRows[0]).slice(0, 8) // max 8 columns
  }, [rawRows])

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows
    const q = search.toLowerCase()
    return rawRows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [rawRows, search])

  const isLoading = tablesLoading || rowsLoading

  const formatCellValue = (value) => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 60)
    const str = String(value)
    return str.length > 60 ? str.slice(0, 60) + '…' : str
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('items.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedTable ? `${t('items.table')}: ${selectedTable}` : ''}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Table selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('items.selectTable')}:</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="input-field w-auto py-1.5"
              disabled={tablesLoading}
            >
              {tables.map((tbl) => (
                <option key={tbl} value={tbl}>{tbl}</option>
              ))}
              {tables.length === 0 && (
                <option value="">{t('items.testDataFallback')}</option>
              )}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-48 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') + '…'}
              className="input-field pl-8 py-1.5"
            />
          </div>

          <span className="text-sm text-gray-500 ml-auto">
            {filteredRows.length} {t('items.rowsShown')}
            {totalRows > 0 && ` / ${totalRows} ${t('items.total')}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner message={t('common.loading')} />
          </div>
        ) : rowsError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-gray-500">{t('items.loadError')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('items.tryAnotherTable')}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-gray-500">{t('items.noResults')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {columns.map((col) => (
                    <th key={col} className="table-header first:rounded-tl-xl last:rounded-tr-xl">
                      {col}
                    </th>
                  ))}
                  <th className="table-header text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="table-row"
                    onClick={() => {
                      const id = row.id || row.item_id || row.product_id || idx
                      navigate(`/items/${id}`, { state: { row, table: selectedTable } })
                    }}
                  >
                    {columns.map((col) => (
                      <td key={col} className="table-cell">
                        {col === 'id' ? (
                          <span className="badge badge-blue">{formatCellValue(row[col])}</span>
                        ) : (
                          formatCellValue(row[col])
                        )}
                      </td>
                    ))}
                    <td className="table-cell text-right">
                      <span className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                        {t('common.view')} →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalRows > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {t('items.page')} {page + 1} / {Math.ceil(totalRows / PAGE_SIZE)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1.5 px-3"
            >
              ← {t('common.prev')}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalRows}
              className="btn-secondary py-1.5 px-3"
            >
              {t('common.next')} →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}