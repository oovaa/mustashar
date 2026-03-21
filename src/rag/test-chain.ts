import 'dotenv/config'
import { answer } from './chain'
import { logger } from '../logger'

const run = async () => {
  const res = await answer('ما هو القانون الخاص بالخلع في السودان؟')
  logger.info(`FINAL ANSWER:\n ${res.content}`)
}
run()
