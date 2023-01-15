import { z } from 'zod'

export type TRootResponseSchema = z.infer<typeof rootResponseSchema>
export const rootResponseSchema = z.object({
  uptime: z.number()
})
