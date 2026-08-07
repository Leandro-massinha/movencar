import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'

const sql=readFileSync(new URL('../prisma/migrations/20260807211000_backfill_platform_modules/migration.sql',import.meta.url),'utf8')

describe('platform module backfill migration',()=>{
  it('keeps existing customers and vehicles access enabled for every existing company',()=>{expect(sql).toContain("'customers'");expect(sql).toContain("'vehicles'");expect(sql).toContain('CROSS JOIN "Module"')})
  it('is conflict-safe and never deletes business data',()=>{expect(sql.match(/ON CONFLICT/g)?.length).toBe(2);expect(sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i)})
  it('creates associations from each company id and the selected module id',()=>{expect(sql).toContain('SELECT company."id", module."id"');expect(sql).toContain('("companyId", "moduleId")')})
})
