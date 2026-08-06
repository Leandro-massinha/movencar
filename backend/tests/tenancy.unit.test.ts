import { describe, expect, it } from 'vitest'

type Resource = { id: string; companyId: string; branchId: string; name: string }
class TenantRepository {
  constructor(private rows: Resource[]) {}
  list(companyId: string) { return this.rows.filter((row) => row.companyId === companyId) }
  find(companyId: string, id: string) { return this.rows.find((row) => row.companyId === companyId && row.id === id) }
  create(authCompanyId: string, input: Omit<Resource, 'companyId'> & { companyId?: string }) { const row = { ...input, companyId: authCompanyId }; this.rows.push(row); return row }
  update(authCompanyId: string, id: string, name: string) { const row = this.find(authCompanyId, id); if (!row) return undefined; row.name = name; return row }
  remove(authCompanyId: string, id: string) { const before = this.rows.length; this.rows = this.rows.filter((row) => !(row.companyId === authCompanyId && row.id === id)); return before !== this.rows.length }
}
const seed = () => new TenantRepository([{ id: 'a1', companyId: 'A', branchId: 'a-main', name: 'A secret' }, { id: 'b1', companyId: 'B', branchId: 'b-main', name: 'B secret' }])

describe('absolute tenant isolation', () => {
  it('lists only the authenticated tenant', () => expect(seed().list('A').map((r) => r.id)).toEqual(['a1']))
  it('cannot read another tenant by known id', () => expect(seed().find('A', 'b1')).toBeUndefined())
  it('cannot update another tenant by known id', () => expect(seed().update('A', 'b1', 'leaked')).toBeUndefined())
  it('cannot delete another tenant by known id', () => expect(seed().remove('A', 'b1')).toBe(false))
  it('ignores a forged companyId during creation', () => expect(seed().create('A', { id: 'x', branchId: 'a-main', name: 'safe', companyId: 'B' }).companyId).toBe('A'))
  it('isolates resources in both directions', () => { const repo = seed(); expect(repo.find('B', 'a1')).toBeUndefined(); expect(repo.find('A', 'b1')).toBeUndefined() })
})
