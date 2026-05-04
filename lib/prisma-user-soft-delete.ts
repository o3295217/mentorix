import { Prisma } from '@prisma/client'

function softDeleteData() {
  return {
    isActive: false,
    deletedAt: new Date(),
  }
}

export const userSoftDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  if (params.model !== 'User') return next(params)

  if (params.action === 'delete') {
    params.action = 'update'
    params.args = {
      ...params.args,
      data: {
        ...softDeleteData(),
      },
    }
  }

  if (params.action === 'deleteMany') {
    params.action = 'updateMany'
    params.args = {
      ...params.args,
      data: {
        ...softDeleteData(),
      },
    }
  }

  return next(params)
}