import { getLLM } from "./llm";

const fallback = async (keys: string[]) => {
  for (const key of keys) {
    const testMsg = (
      await getLLM(key, "llama-3.1-8b-instant", 0, 10).invoke("are u running ?")
    ).content;

    if (testMsg) {
      return key;
    }
  }
};

export default fallback;
