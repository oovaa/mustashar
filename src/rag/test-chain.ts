import 'dotenv/config'
import { answer } from './chain'

const run = async () => {
  const res = await answer('ما هو القانون الخاص بالخلع في السودان؟')
  console.log('\nFINAL ANSWER:\n', res.content)
}
run()
