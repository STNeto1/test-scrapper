import { fastify, FastifyInstance } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'
import zodToJsonSchema from 'zod-to-json-schema'

import prismaPlugin from './plugins/prisma'
import productRoutes from './routes/product'
import { rootResponseSchema, TRootResponseSchema } from './schemas/root'

const server: FastifyInstance<Server, IncomingMessage, ServerResponse> =
  fastify({ logger: true })

server.register(prismaPlugin)

server.register(productRoutes)

server.route({
  url: '/',
  logLevel: 'info',
  method: ['GET', 'HEAD'],
  schema: {
    response: {
      200: zodToJsonSchema(rootResponseSchema, 'rootResponseSchema')
    }
  },
  handler: (): TRootResponseSchema => {
    return { uptime: process.uptime() }
  }
})

export default server
