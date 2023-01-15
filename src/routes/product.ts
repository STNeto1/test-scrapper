import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

const itemSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  image: z.string().url(),
  price: z.number(),
  description: z.string(),
  reviews_qty: z.number(),
  review_score: z.number()
})
const paginatedItemsSchema = z.object({
  pages: z.number().positive(),
  items: z.array(itemSchema)
})

const completeItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  image: z.string().url(),
  price: z.number(),
  description: z.string(),
  reviews_qty: z.number(),
  review_score: z.number(),
  hdd_options: z.array(
    z.object({
      id: z.number(),
      size: z.number(),
      enabled: z.boolean()
    })
  )
})

const paramSchema = z.object({
  id: z.coerce.number()
})

const errorSchema = z.object({
  message: z.string(),
  status_code: z.number()
})

const paginationSchema = z.object({
  page: z.optional(z.coerce.number()).default(1),
  limit: z.optional(z.coerce.number()).default(10)
})

const safePagination = (raw: string) => {
  const [_, tail] = raw.split('?')
  const params = new URLSearchParams(tail)
  const cleanParams = Object.fromEntries(params)

  const result = paginationSchema.safeParse(cleanParams)

  if (!result.success) {
    return {
      page: 1,
      limit: 10
    }
  }

  return result.data
}

export default fp(
  async (server: FastifyInstance, _: FastifyPluginOptions, next: Function) => {
    server.route({
      url: '/products',
      logLevel: 'warn',
      method: ['GET', 'HEAD'],
      schema: {
        response: {
          200: zodToJsonSchema(paginatedItemsSchema, 'paginatedItemsSchema'),
          500: zodToJsonSchema(errorSchema, 'errorSchema')
        }
      },
      handler: async (
        request,
        reply
      ): Promise<z.infer<typeof paginatedItemsSchema>> => {
        const { page, limit } = safePagination(request.raw.url ?? '')

        const [items, count] = await Promise.all([
          await server.prisma.item.findMany({
            orderBy: {
              price: 'asc'
            },
            take: limit,
            skip: (page - 1) * limit
          }),
          await server.prisma.item.count({
            where: {}
          })
        ])

        return reply.status(200).send({
          pages: Math.ceil(count / limit),
          items
        })
      }
    })

    server.route({
      url: '/products/:id',
      logLevel: 'warn',
      method: ['GET', 'HEAD'],
      schema: {
        params: zodToJsonSchema(paramSchema, 'paramSchema'),
        response: {
          200: zodToJsonSchema(completeItemSchema, 'completeItemSchema'),
          404: zodToJsonSchema(errorSchema, 'errorSchema')
        }
      },
      handler: async (
        request,
        reply
      ): Promise<z.infer<typeof completeItemSchema>> => {
        const { id } = request.params as z.infer<typeof paramSchema>

        const item = await server.prisma.item.findUnique({
          where: {
            id
          },
          include: {
            hdd_options: true
          }
        })
        if (!item) {
          return reply.status(404).send({
            message: 'Item not found',
            status_code: 404
          })
        }

        const parsedItem = {
          id: item.id,
          description: item.description,
          image: item.image,
          price: item.price,
          review_score: item.review_score,
          reviews_qty: item.reviews_qty,
          title: item.title,
          url: item.url,
          hdd_options: item.hdd_options.map((op) => ({
            id: op.id,
            size: op.size,
            enabled: op.enabled
          }))
        } satisfies z.infer<typeof completeItemSchema>

        return reply.status(200).send(parsedItem)
      }
    })

    next()
  }
)
