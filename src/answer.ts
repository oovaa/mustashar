import { getHistory } from './history'
import { analyzeUserMessage } from './stand_alone'

const answer = async (userInput: string, chat_id: string) => {
  const analyzed = await analyzeUserMessage(userInput)

  const { has_quesion } = analyzed

  const history = getHistory(chat_id)

  if (! has_quesion) {


    return
  } 
}
