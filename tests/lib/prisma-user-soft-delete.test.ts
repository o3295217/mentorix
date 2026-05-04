import { describe, expect, it, vi } from 'vitest'
import { type Prisma } from '@prisma/client'
import { userSoftDeleteMiddleware } from '@/lib/prisma-user-soft-delete'

describe('userSoftDeleteMiddleware', () => {
  it('converts User.delete to update with deletedAt and inactive state', async () => {
    const params: Prisma.MiddlewareParams = {
      model: 'User',
      action: 'delete',
      args: { where: { id: 'user-1' } },
      dataPath: [],
      runInTransaction: false,
    }
    const next = vi.fn(async (nextParams: Prisma.MiddlewareParams) => nextParams)

    const result = await userSoftDeleteMiddleware(params, next)

    expect(result.action).toBe('update')
    expect(result.args.where).toEqual({ id: 'user-1' })
    expect(result.args.data.isActive).toBe(false)
    expect(result.args.data.deletedAt).toBeInstanceOf(Date)
  })

  it('converts User.deleteMany to updateMany', async () => {
    const params: Prisma.MiddlewareParams = {
      model: 'User',
      action: 'deleteMany',
      args: { where: { role: 'user' } },
      dataPath: [],
      runInTransaction: false,
    }
    const next = vi.fn(async (nextParams: Prisma.MiddlewareParams) => nextParams)

    const result = await userSoftDeleteMiddleware(params, next)

    expect(result.action).toBe('updateMany')
    expect(result.args.where).toEqual({ role: 'user' })
    expect(result.args.data.isActive).toBe(false)
    expect(result.args.data.deletedAt).toBeInstanceOf(Date)
  })

  it('leaves non-User models untouched', async () => {
    const params: Prisma.MiddlewareParams = {
      model: 'Session',
      action: 'delete',
      args: { where: { id: 'session-1' } },
      dataPath: [],
      runInTransaction: false,
    }
    const next = vi.fn(async (nextParams: Prisma.MiddlewareParams) => nextParams)

    const result = await userSoftDeleteMiddleware(params, next)

    expect(result).toBe(params)
    expect(result.action).toBe('delete')
  })
})