import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getRow } from '../api/items.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

function InfoRow({ label, value }) {
  const formatted = value === null || value === undefined ? '—' : String(value)
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 w-40 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 flex-1 break-all">{formatted || '—'}</dd>
    </div>
  )
}


export default function ItemDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const passedRow = location.state?.row
  const passedTable = location.state?.table

  // Try to fetch row from db-api if we have a table name
  const { data: fetchedRow, isLoading: rowLoading } = useQuery({
    queryKey: ['row', passedTable, id],
    queryFn: () => getRow(passedTable, id),
    enabled: !!passedTable && !passedRow,
    retry: false,
  })

  const row = passedRow || fetchedRow

  if (rowLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner message={t('common.loading')} />
      </div>
    )
  }

  if (!row) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl mb-4">🔍</span>
        <p className="text-gray-500">{t('items.itemNotFound')}</p>
        <button className="btn-secondary mt-4" onClick={() => navigate('/items')}>
          ← {t('common.back')}
        </button>
      </div>
    )
  }

  const fields = Object.entries(row)

  return (
    <div className="space-y-6 fade-in max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => navigate('/items')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← {t('common.back')} / {t('items.title')}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            {row.name || row.item_name || row.product_name || `Item #${id}`}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {passedTable ? `${t('items.table')}: ${passedTable}` : t('items.fromTestData')}
            {' · '}ID: {id}
          </p>
        </div>

      </div>

      {/* Item details */}
      <div className="card">
        <h2 className="section-title mb-4">{t('items.details')}</h2>
        <dl>
          {fields.map(([key, value]) => (
            <InfoRow key={key} label={key} value={value} />
          ))}
        </dl>
      </div>
    </div>
  )
}