import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDatabases } from '../api/items.js'

const DatabaseContext = createContext(null)

export function DatabaseProvider({ children }) {
  const [selectedDb, setSelectedDb] = useState(
    () => localStorage.getItem('nostradamus_db') || null
  )

  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: listDatabases,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (databases.length === 0) return
    const valid = databases.find((d) => d.name === selectedDb)
    if (!valid) {
      const first = databases[0].name
      setSelectedDb(first)
      localStorage.setItem('nostradamus_db', first)
    }
  }, [databases, selectedDb])

  const selectDb = (name) => {
    setSelectedDb(name)
    localStorage.setItem('nostradamus_db', name)
  }

  return (
    <DatabaseContext.Provider value={{ selectedDb, databases, selectDb }}>
      {children}
    </DatabaseContext.Provider>
  )
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider')
  return ctx
}
