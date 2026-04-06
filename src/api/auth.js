const USERS_KEY = 'nostradamus_users'

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export async function registerUser({ username, email, password }) {
  const users = getStoredUsers()

  if (users.find((u) => u.email === email)) {
    throw new Error('Email already registered')
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password,
    created_at: new Date().toISOString(),
  }

  saveUsers([...users, newUser])
  return newUser
}

export async function loginUser({ email, password }) {
  const users = getStoredUsers()
  const user = users.find((u) => u.email === email && u.password === password)

  if (!user) {
    throw new Error('Invalid email or password')
  }

  const tokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    exp: Date.now() + 86400000,
  }
  const token = btoa(JSON.stringify(tokenPayload))
  return { token, user: { id: user.id, username: user.username, email: user.email } }
}

/**
 * Decode and validate the stored token.
 */
export function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token))
    if (payload.exp < Date.now()) {
      return null // expired
    }
    return payload
  } catch {
    return null
  }
}