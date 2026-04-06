import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext.jsx'
import { listTables } from '../api/items.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

function StatCard({ icon, label, value, subtext, color = 'blue', onClick }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer hover:border-blue-200' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({ icon, title, description, onClick, colorClass }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${colorClass} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const {
    data: tables,
    isLoading: tablesLoading,
  } = useQuery({
    queryKey: ['tables'],
    queryFn: listTables,
  })

  const tableCount = Array.isArray(tables)
    ? tables.length
    : tables?.tables?.length || '—'

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.goodMorning')
    if (hour < 18) return t('dashboard.goodAfternoon')
    return t('dashboard.goodEvening')
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            {greeting()}, {user?.username}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="📦"
          label={t('dashboard.totalItems')}
          value="—"
          subtext={t('dashboard.browseItems')}
          color="blue"
          onClick={() => navigate('/items')}
        />
        <StatCard
          icon="✅"
          label={t('dashboard.systemStatus')}
          value={tablesLoading ? <LoadingSpinner size="sm" /> : 'Online'}
          subtext={tableCount !== '—' ? `${tableCount} ${t('dashboard.tablesAvailable')}` : t('dashboard.connecting')}
          color="orange"
        />
      </div>

      {/* System info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Status */}
        <div className="card">
          <h2 className="section-title mb-4">{t('dashboard.apiStatus')}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${tablesLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
                <span className="text-sm text-gray-700">Database API</span>
              </div>
              <span className={`text-xs font-medium ${tablesLoading ? 'text-yellow-600' : 'text-green-600'}`}>
                {tablesLoading ? t('dashboard.statusChecking') : t('dashboard.statusOnline')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="section-title mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard
              icon="📦"
              title={t('nav.items')}
              description={t('dashboard.browseItems')}
              colorClass="bg-blue-50"
              onClick={() => navigate('/items')}
            />
          </div>
        </div>
      </div>

      {/* Tables list */}
      {tables && (
        <div className="card">
          <h2 className="section-title mb-4">{t('dashboard.availableTables')}</h2>
          {tablesLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(tables) ? tables : tables?.tables || []).map((tbl, i) => (
                <span
                  key={i}
                  className="badge badge-blue cursor-pointer hover:bg-blue-200 transition-colors"
                  onClick={() => navigate('/items', { state: { table: typeof tbl === 'string' ? tbl : tbl.name } })}
                >
                  {typeof tbl === 'string' ? tbl : tbl.name || JSON.stringify(tbl)}
                </span>
              ))}
              {(!tables || (Array.isArray(tables) && tables.length === 0)) && (
                <p className="text-sm text-gray-400">{t('dashboard.noTables')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}