import { createAgent } from "langchain";

const agent_answer = createAgent({
  model: "openai:gpt-5",
  tools: []
});

const agent_summrize = createAgent({
  model: "openai:gpt-5",
  tools: []
});

const agent_orchastrate  = createAgent({
  model: "openai:gpt-5",
  tools: []
});