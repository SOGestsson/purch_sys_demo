import axios from 'axios'

const DB_API_URL = import.meta.env.VITE_DB_API_URL || 'https://db-api.nostradamus-api.com'
// Use Vite proxy in dev to avoid CORS; point directly in prod via env var
const SIM_BASE = import.meta.env.VITE_API_URL || '/sim-proxy'
const PIPELINE_BASE = import.meta.env.VITE_PIPELINE_URL || '/pipeline-proxy'

export const simClient = axios.create({
  baseURL: SIM_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

export const pipelineClient = axios.create({
  baseURL: PIPELINE_BASE,
  headers: { Accept: 'application/json' },
  timeout: 120000,
})

export const dbClient = axios.create({
  baseURL: DB_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

const attachToken = (config) => {
  const token = localStorage.getItem('nostradamus_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

dbClient.interceptors.request.use(attachToken, (error) => Promise.reject(error))

const handleUnauthorized = (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('nostradamus_token')
    window.location.href = '/login'
  }
  return Promise.reject(error)
}

dbClient.interceptors.response.use((res) => res, handleUnauthorized)

export default dbClient