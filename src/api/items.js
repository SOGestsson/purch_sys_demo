import { dbClient, simClient, pipelineClient } from './client.js'

/**
 * List all tables in the database.
 */
export async function listTables() {
  const response = await dbClient.get('/tables')
  return response.data?.tables || response.data || []
}

/**
 * List rows from a specific table with optional pagination.
 */
export async function listRows(tableName, { limit = 50, offset = 0 } = {}) {
  const response = await dbClient.get(`/tables/${tableName}/rows`, {
    params: { limit, offset },
  })
  const data = response.data
  return {
    rows: data?.rows || data?.data || (Array.isArray(data) ? data : []),
    total: data?.total || data?.count || 0,
    limit: data?.limit || limit,
    offset: data?.offset || offset,
  }
}

/**
 * Get a single row by ID.
 */
export async function getRow(tableName, rowId) {
  const response = await dbClient.get(`/tables/${tableName}/rows/${rowId}`)
  return response.data?.row || response.data
}

/**
 * Create a new row in a table.
 */
export async function createRow(tableName, data) {
  const response = await dbClient.post(`/tables/${tableName}/rows`, data)
  return response.data
}

/**
 * Update an existing row.
 */
export async function updateRow(tableName, rowId, data) {
  const response = await dbClient.put(`/tables/${tableName}/rows/${rowId}`, data)
  return response.data
}

/**
 * Delete a row.
 */
export async function deleteRow(tableName, rowId) {
  const response = await dbClient.delete(`/tables/${tableName}/rows/${rowId}`)
  return response.data
}

/**
 * Binary search to find the offset in item_histories where item_id first appears.
 * Histories are roughly sorted by item_id (~640k rows total).
 */
async function findHistoryOffset(itemId, totalRows = 640000) {
  let lo = 0
  let hi = totalRows
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const data = await dbClient.get('/tables/item_histories/rows', {
      params: { limit: 1, offset: mid },
    })
    const row = data.data?.rows?.[0]
    if (!row) { hi = mid; continue }
    if (row.item_id < itemId) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Fetch all history rows for a specific item_id using binary search.
 */
export async function getItemHistories(itemId) {
  const startOffset = await findHistoryOffset(itemId)
  const safeOffset = Math.max(0, startOffset - 50)
  const response = await dbClient.get('/tables/item_histories/rows', {
    params: { limit: 1000, offset: safeOffset },
  })
  const rows = response.data?.rows || []
  return rows.filter((r) => r.item_id === itemId)
}

/**
 * Get simulation input for a specific item.
 */
export async function getSimInput(
  itemId,
  {
    number_of_days = 900,
    number_of_simulations = 1000,
    service_level = 0.95,
    start_day,
    end_day,
  } = {},
) {
  const response = await dbClient.get(`/sim-input/${itemId}`, {
    params: {
      number_of_days,
      number_of_simulations,
      service_level,
      start_day,
      end_day,
    },
  })
  return response.data
}

/**
 * Get forecast input payload for a specific item.
 */
export async function getForecastInput(
  itemId,
  {
    forecast_periods = 6,
    mode = 'local',
    local_model = 'auto_ets',
    season_length = 12,
    freq = 'M',
    start_day,
    end_day,
  } = {},
) {
  const response = await dbClient.get(`/forecast-input/${itemId}`, {
    params: {
      forecast_periods,
      mode,
      local_model,
      season_length,
      freq,
      start_day,
      end_day,
    },
  })
  return response.data
}

/**
 * Run daily forecast from a DB-backed forecast input.
 */
export async function runForecastDailyForItem(itemId, options = {}) {
  const forecastInput = await getForecastInput(itemId, options)
  const response = await simClient.post('/api/v1/forecast/generate_daily', forecastInput)
  return response.data
}

/**
 * Run inventory simulation with sim-input data.
 */
export async function runSimulation(simInput) {
  const response = await simClient.post('/api/v1/simulation/simulate', simInput)
  return response.data
}

/**
 * Get forecast for a specific item via pipeline API.
 */
export async function getForecastDirect(
  itemId,
  {
    forecast_periods = 6,
    mode = 'local',
    local_model = 'auto_ets',
    season_length = 12,
    freq = 'M',
  } = {},
) {
  const response = await pipelineClient.get(`/forecast/${itemId}`, {
    params: { forecast_periods, mode, local_model, season_length, freq },
  })
  return response.data
}

/**
 * Run raw simulation for a specific item via pipeline API.
 * Returns forecast + simulation results in one call.
 */
export async function getRawSimulate(
  itemId,
  {
    order_freq = 30,
    lead_time = 30,
    service_level = 0.95,
    forecast_periods = 6,
    mode = 'local',
    local_model = 'auto_ets',
    season_length = 12,
    freq = 'M',
  } = {},
) {
  const response = await pipelineClient.post(`/simulation/raw-simulate/${itemId}`, null, {
    params: { order_freq, lead_time, service_level, forecast_periods, mode, local_model, season_length, freq },
  })
  return response.data
}
