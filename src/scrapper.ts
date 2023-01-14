import { chromium } from 'playwright'
import { z } from 'zod'

const itemSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  url: z.string(),
  image: z.string().url(),
  price: z.string(),
  description: z.string(),
  review: z.object({
    number: z.coerce.number(),
    rating: z.number()
  })
})

const itemsSchema = z.array(itemSchema)

const BASE_URL =
  'https://webscraper.io/test-sites/e-commerce/allinone/computers/laptops'

const main = async () => {
  const browser = await chromium.launch({
    headless: true
  })

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

      return {
        id: urlTokens?.at(-1), // last element of the url tokens (should be the id)
        title: title?.getAttribute('title'),
        url: title?.getAttribute('href'),
        image: image?.src,
        price: rawPrice?.innerHTML,
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
    await browser.close()
    return
  }

  await browser.close()
}

main()
  .then(() => console.log('finalizado'))
  .catch((err) => console.error)
