import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright'
import { z } from 'zod'

const itemSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  url: z.string(),
  image: z.string().url(),
  price: z.number(),
  description: z.string(),
  review: z.object({
    number: z.coerce.number(),
    rating: z.number()
  })
})

const itemWithHddSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  url: z.string(),
  image: z.string().url(),
  price: z.number(),
  description: z.string(),
  review: z.object({
    number: z.coerce.number(),
    rating: z.number()
  }),
  hdd: z.array(
    z.object({
      size: z.coerce.number(),
      enabled: z.boolean(),
      price: z.number()
    })
  )
})

const itemsSchema = z.array(itemSchema)
const itemsWithHddSchema = z.array(itemWithHddSchema)

const BASE_URL =
  'https://webscraper.io/test-sites/e-commerce/allinone/computers/laptops'

const PRODUCT_URL = (id: number) =>
  `https://webscraper.io/test-sites/e-commerce/allinone/product/${id}`

const prisma = new PrismaClient({})

const main = async () => {
  await prisma.$connect()

  const browser = await chromium.launch({
    headless: true
  })

  const cleanUp = async () => {
    await prisma.$disconnect()
    await browser.close()
  }

  const page = await browser.newPage()
  await page.goto(BASE_URL)

  const laptops = await page.$$eval('.thumbnail', (items) => {
    return items.map((elem) => {
      const image = elem.querySelector('img')
      const rawPrice = elem.querySelector('.caption .price')
      const title = elem.querySelector('.caption .title')
      const description = elem.querySelector('.description')
      const rawReviewsQty = elem.querySelector('.ratings .pull-right')
      const reviewRating = elem.querySelectorAll('.ratings .glyphicon')

      const urlTokens = title?.getAttribute('href')?.split('/')
      const reviewsTokens = rawReviewsQty?.innerHTML.split(' ')
      const cleanPrice = rawPrice
        ? +rawPrice.innerHTML.replace(/\D+/g, '') / 100
        : null

      return {
        id: urlTokens?.at(-1), // last element of the url tokens (should be the id)
        title: title?.getAttribute('title'),
        url: title?.getAttribute('href'),
        image: image?.src,
        price: cleanPrice,
        description: description?.innerHTML,
        review: {
          number: reviewsTokens?.at(0),
          rating: reviewRating.length
        }
      }
    })
  })
  console.log(`${laptops.length} items found`)

  const validItems = itemsSchema.safeParse(laptops)
  if (!validItems.success) {
    console.error('invalid item', validItems.error)
    return await cleanUp()
  }

  const lenovoLaptops = validItems.data.filter((item) => {
    // switch for a regex later?
    return item.title.toLowerCase().includes('lenovo')
  })
  console.log(`${lenovoLaptops.length} lenovo items found`)

  const laptopsWithHddOptions = await Promise.all(
    lenovoLaptops
      .filter((l) => l.id === 548)
      .map(async (laptop) => {
        const page = await browser.newPage()

        await page.goto(PRODUCT_URL(laptop.id))

        const hddOptions = await page.$$eval('.swatches button', (items) => {
          return items.map((item) => {
            return {
              size: item.getAttribute('value'),
              enabled: !item.classList.contains('disabled'),
              price: -1
            }
          })
        })

        for await (const option of hddOptions) {
          const buttonSelector = `button[value="${option.size}"]`

          await page.locator(buttonSelector).click()

          const rawPrice = await page.$eval('.caption .pull-right', (item) => {
            return item.innerHTML
          })

          option.price = +rawPrice.replace(/\D+/g, '') / 100
        }

        return { ...laptop, hdd: hddOptions }
      })
  )

  const validItemsWithHdd = itemsWithHddSchema.safeParse(laptopsWithHddOptions)
  if (!validItemsWithHdd.success) {
    console.error('invalid item with hdd', validItemsWithHdd.error)
    return await cleanUp()
  }

  const itemPromises = validItemsWithHdd.data.map((item) =>
    prisma.item.upsert({
      where: {
        id: item.id
      },
      create: {
        id: item.id,
        title: item.title,
        url: item.url,
        image: item.image,
        price: item.price,
        description: item.description,
        reviews_qty: item.review.number,
        review_score: item.review.rating
      },
      update: {
        title: item.title,
        url: item.url,
        image: item.image,
        price: item.price,
        description: item.description,
        reviews_qty: item.review.number,
        review_score: item.review.rating
      }
    })
  )
  const hddPromises = validItemsWithHdd.data
    .map((item) =>
      item.hdd.map((hddItem) =>
        prisma.itemHddOption.upsert({
          where: {
            itemId_size: {
              size: hddItem.size,
              itemId: item.id
            }
          },
          create: {
            enabled: hddItem.enabled,
            size: hddItem.size,
            itemId: item.id,
            price: hddItem.price
          },
          update: {
            enabled: hddItem.enabled,
            size: hddItem.size,
            price: hddItem.price
          }
        })
      )
    )
    .flat()

  const result = await prisma.$transaction([...itemPromises, ...hddPromises])

  console.log(`${result.length} items upserted`)

  return await cleanUp()
}

main()
  .then(() => console.log('finalizado'))
  .catch((err) => console.error(err))
