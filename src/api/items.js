import { dbClient, simClient, pipelineClient } from './client.js'

export async function listDatabases() {
  const response = await dbClient.get('/databases')
  return response.data?.databases || []
}

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
export async function listRows(tableName, { limit = 50, offset = 0, db = null, stock_out = false } = {}) {
  const response = await dbClient.get(`/tables/${tableName}/rows`, {
    params: { limit, offset, db, ...(stock_out && { stock_out: true }) },
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
export async function getRow(tableName, rowId, { db = null } = {}) {
  const response = await dbClient.get(`/tables/${tableName}/rows/${rowId}`, { params: { db } })
  return response.data?.row || response.data
}

/**
 * Create a new row in a table.
 */
export async function createRow(tableName, data, { db = null } = {}) {
  const response = await dbClient.post(`/tables/${tableName}/rows`, data, { params: { db } })
  return response.data
}

/**
 * Update an existing row.
 */
export async function updateRow(tableName, rowId, data, { db = null } = {}) {
  const response = await dbClient.put(`/tables/${tableName}/rows/${rowId}`, data, { params: { db } })
  return response.data
}

/**
 * Delete a row.
 */
export async function deleteRow(tableName, rowId, { db = null } = {}) {
  const response = await dbClient.delete(`/tables/${tableName}/rows/${rowId}`, { params: { db } })
  return response.data
}

/**
 * Binary search to find the offset in item_histories where item_id first appears.
 * Histories are roughly sorted by item_id (~640k rows total).
 */
async function findHistoryOffset(itemId, db, totalRows = 640000) {
  let lo = 0
  let hi = totalRows
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const data = await dbClient.get('/tables/item_histories/rows', {
      params: { limit: 1, offset: mid, db },
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
export async function getItemHistories(itemId, { db = null } = {}) {
  const startOffset = await findHistoryOffset(itemId, db)
  const safeOffset = Math.max(0, startOffset - 50)
  const response = await dbClient.get('/tables/item_histories/rows', {
    params: { limit: 1000, offset: safeOffset, db },
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
    lead_time,
    order_freq,
    start_day,
    end_day,
    db = null,
  } = {},
) {
  const response = await dbClient.get(`/sim-input/${itemId}`, {
    params: {
      number_of_days,
      number_of_simulations,
      service_level,
      start_day,
      end_day,
      db,
    },
  })
  const data = response.data
  if (lead_time != null || order_freq != null) {
    data.sim_rio_items = data.sim_rio_items?.map((item) => ({
      ...item,
      ...(lead_time != null && { del_time: lead_time }),
      ...(order_freq != null && { buy_freq: order_freq }),
    }))
  }
  return data
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
    db = null,
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
      db,
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
    db = null,
    forecast_periods = 6,
    mode = 'local',
    local_model = 'auto_ets',
    season_length = 12,
    freq = 'M',
  } = {},
) {
  const response = await pipelineClient.get(`/forecast/${itemId}`, {
    params: { db, forecast_periods, mode, local_model, season_length, freq },
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
    db = null,
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
    params: { db, order_freq, lead_time, service_level, forecast_periods, mode, local_model, season_length, freq },
  })
  return response.data
}

export async function getSimPrep(itemId, { db = null, number_of_simulations = 500, number_of_days = 900, service_level = 0.95 } = {}) {
  const response = await pipelineClient.get(`/simulation/sim-prep/${itemId}`, {
    params: { db, number_of_simulations, number_of_days, service_level },
    timeout: 120000,
  })
  return response.data
}

export async function startMultiSimJob(itemIds, { db = null, number_of_simulations = 1000, number_of_days = 900, service_level = 0.95 } = {}) {
  const params = new URLSearchParams()
  itemIds.forEach((id) => params.append('item_ids', id))
  params.append('db', db)
  params.append('number_of_simulations', number_of_simulations)
  params.append('number_of_days', number_of_days)
  params.append('service_level', service_level)
  const response = await pipelineClient.post(`/simulation/multi-sim/async?${params.toString()}`, null, { timeout: 15000 })
  return response.data
}

export async function getJobStatus(jobId) {
  const response = await pipelineClient.get(`/jobs/${jobId}`, { timeout: 10000 })
  return response.data
}
