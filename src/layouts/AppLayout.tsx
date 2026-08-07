import { Bell, Building2, ChevronDown, ChevronLeft, LogOut, Menu, Search } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { navigation } from '../config/navigation'
import { useAuth } from '../hooks/useAuth'
import { hasPermission } from '../lib/permissions'
import { cn } from '../lib/cn'
import { IconButton } from '../components/ui'

const groups = ['OPERACAO','OFICINA','GESTAO','ADMINISTRACAO']

export function AppLayout() {
  const { user, tenant, logout, setBranch } = useAuth()
  const location = useLocation()
  const [collapsed,setCollapsed]=useState(false)
  const [mobile,setMobile]=useState(false)
  const current = navigation.find((item) => item.path === location.pathname)?.label || 'Visao geral'
  const visible = navigation.filter((item) => tenant.enabledModules.includes(item.module)&&hasPermission(user,item.permission))
  const sidebar = <>
    <div className="flex h-16 items-center border-b border-white/10 bg-black px-3"><img src="/movencar-logo.png" alt="MovenCar" className={cn('object-contain', collapsed ? 'h-10 w-12 object-left' : 'h-14 w-40')} /></div>
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((group) => <div key={group} className="mb-3">
        {!collapsed && <p className="mb-1 px-3 text-[10px] font-bold tracking-wider text-slate-500">{group}</p>}
        <div className="space-y-0.5">{visible.filter((item)=>item.group===group).map(({label,path,icon:Icon})=><NavLink key={path} to={path} onClick={()=>setMobile(false)} className={({isActive})=>cn('relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-slate-300 transition hover:bg-white/5 hover:text-white',isActive&&'bg-purple-700/45 text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-lime-500')} title={collapsed?label:undefined}><Icon className="size-[18px] shrink-0"/>{!collapsed&&<span className="truncate">{label}</span>}</NavLink>)}</div>
      </div>)}
    </nav>
    <button onClick={logout} className="m-2 flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/5"><LogOut className="size-[18px]"/>{!collapsed&&'Sair'}</button>
  </>
  return <div className="min-h-screen bg-canvas">
    <aside className={cn('fixed inset-y-0 left-0 z-40 hidden bg-[#09090B] transition-[width] lg:flex lg:flex-col',collapsed?'w-[72px]':'w-[220px]')}>{sidebar}<button onClick={()=>setCollapsed(v=>!v)} aria-label="Recolher menu" className="absolute -right-3 top-20 grid size-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"><ChevronLeft className={cn('size-4 transition',collapsed&&'rotate-180')}/></button></aside>
    {mobile&&<><button className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" aria-label="Fechar menu" onClick={()=>setMobile(false)}/><aside className="fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-[#09090B] lg:hidden">{sidebar}</aside></>}
    <div className={cn('transition-[padding] lg:pl-[220px]',collapsed&&'lg:pl-[72px]')}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-5">
        <IconButton label="Abrir menu" className="lg:hidden" onClick={()=>setMobile(true)}><Menu className="size-5"/></IconButton>
        <div className="hidden min-w-[190px] md:block"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">MovenCar / {current}</p><div className="mt-0.5 flex items-center gap-1.5 text-xs"><Building2 className="size-3.5 text-purple-500"/><strong>{tenant.companyName}</strong><select aria-label="Filial" value={tenant.branchId} onChange={e=>setBranch(e.target.value)} className="max-w-32 bg-transparent text-slate-500"><option value="matriz">Matriz - Centro</option><option value="norte">Unidade Norte</option></select></div></div>
        <label className="relative ml-auto hidden w-full max-w-md sm:block"><Search className="absolute left-3 top-2.5 size-4 text-slate-400"/><input aria-label="Busca global" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-14 text-sm" placeholder="Buscar cliente, placa ou OS..."/><kbd className="absolute right-2 top-2 rounded border bg-white px-1.5 py-0.5 text-[10px] text-slate-400">Ctrl K</kbd></label>
        <IconButton label="Notificacoes" className="relative"><Bell className="size-[18px]"/><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-lime-500"/></IconButton>
        <button className="hidden h-10 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-slate-50 sm:flex"><span className="grid size-8 place-items-center rounded-full bg-purple-50 text-xs font-bold text-purple-700">MC</span><span className="max-w-28"><strong className="block truncate text-xs">{user?.name}</strong><span className="block text-[10px] text-slate-500">{user?.role}</span></span><ChevronDown className="size-4 text-slate-400"/></button>
      </header>
      <main className="mx-auto max-w-[1800px] p-4 lg:p-5"><Outlet/></main>
    </div>
  </div>
}
