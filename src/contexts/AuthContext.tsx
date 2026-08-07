import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TenantContext, User } from '../types/auth'
import { api, setAccessToken } from '../services/api'

const demoUser: User = { id: 'usr-1', name: 'Marina Costa', email: 'marina@movencar.demo', role: 'Administrador', permissions: ['dashboard.view','agenda.view','vehicles.view','vehicles.create','vehicles.update','vehicles.delete','orders.view','finance.view','crm.view','yard.view','tools.view','settings.manage','customers.view','customers.create','customers.update','customers.delete'] }
const demoTenant: TenantContext = { companyId: 'movencar-demo', companyName: 'Oficina Avenida', branchId: 'matriz', branchName: 'Matriz - Centro', enabledModules: ['core','customers','vehicles','workshop','finance','crm','yard','tools-assets'] }
interface AuthValue { user: User | null; tenant: TenantContext; authenticated: boolean; initializing?: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void; setBranch: (id: string) => void }
// Shared here so the provider remains the single owner of demo-session behavior.
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
  const [user, setUser] = useState<User | null>(() => useMocks && sessionStorage.getItem('movencar.demo.session') ? demoUser : null)
  const [tenant, setTenant] = useState(demoTenant)
  const [initializing, setInitializing] = useState(!useMocks)
  const logout = useCallback(() => { if (!useMocks) void api.post('/auth/logout').catch(() => undefined); sessionStorage.removeItem('movencar.demo.session'); setAccessToken(null); setUser(null) }, [useMocks])
  useEffect(() => { window.addEventListener('movencar:session-revoked', logout); return () => window.removeEventListener('movencar:session-revoked', logout) }, [logout])
  useEffect(() => { if (useMocks) return; api.post<{ accessToken: string }>('/auth/refresh').then(({ data }) => { setAccessToken(data.accessToken); return api.get<{ user: User; tenant: TenantContext }>('/auth/me') }).then(({ data }) => { setUser(data.user); setTenant(data.tenant) }).catch(() => setUser(null)).finally(() => setInitializing(false)) }, [useMocks])
  const login = useCallback(async (email: string, password: string) => {
    if (!email || password.length < 4) throw new Error('Informe e-mail e senha validos.')
    if (useMocks) { sessionStorage.setItem('movencar.demo.session', 'active'); setUser({ ...demoUser, email }); return }
    const companyCode = import.meta.env.VITE_COMPANY_CODE || 'oficina-avenida'
    const { data } = await api.post<{ accessToken: string }>('/auth/login', { companyCode, email, password })
    setAccessToken(data.accessToken)
    const me = await api.get<{ user: User; tenant: TenantContext }>('/auth/me')
    setUser(me.data.user); setTenant(me.data.tenant)
  }, [useMocks])
  const setBranch = (branchId: string) => setTenant((current) => ({ ...current, branchId, branchName: branchId === 'norte' ? 'Unidade Norte' : 'Matriz - Centro' }))
  return <AuthContext.Provider value={useMemo(() => ({ user, tenant, authenticated: Boolean(user), initializing, login, logout, setBranch }), [user, tenant, initializing, login, logout])}>{children}</AuthContext.Provider>
}
