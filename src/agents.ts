import { createAgent } from 'langchain'

const agent_answer = createAgent({
  model: 'google-genai:gemini-2.5-pro',
  tools: [],
})

// const agent_summrize = createAgent({
//   model: 'openai:gpt-5',
//   tools: [],
// })

// const agent_orchastrate = createAgent({
//   model: 'openai:gpt-5',
//   tools: [],
// })

console.log(await agent_answer.invoke({ messages: 'hi there' }))

/**
 * 
 * const MODEL_PROVIDER_CONFIG = {
	openai: {
		package: "@langchain/openai",
		className: "ChatOpenAI"
	},
	anthropic: {
		package: "@langchain/anthropic",
		className: "ChatAnthropic"
	},
	azure_openai: {
		package: "@langchain/openai",
		className: "AzureChatOpenAI"
	},
	cohere: {
		package: "@langchain/cohere",
		className: "ChatCohere"
	},
	"google-vertexai": {
		package: "@langchain/google-vertexai",
		className: "ChatVertexAI"
	},
	"google-vertexai-web": {
		package: "@langchain/google-vertexai-web",
		className: "ChatVertexAI"
	},
	"google-genai": {
		package: "@langchain/google-genai",
		className: "ChatGoogleGenerativeAI"
	},
	ollama: {
		package: "@langchain/ollama",
		className: "ChatOllama"
	},
	mistralai: {
		package: "@langchain/mistralai",
		className: "ChatMistralAI"
	},
	mistral: {
		package: "@langchain/mistralai",
		className: "ChatMistralAI"
	},
	groq: {
		package: "@langchain/groq",
		className: "ChatGroq"
	},
	cerebras: {
		package: "@langchain/cerebras",
		className: "ChatCerebras"
	},
	bedrock: {
		package: "@langchain/aws",
		className: "ChatBedrockConverse"
	},
	deepseek: {
		package: "@langchain/deepseek",
		className: "ChatDeepSeek"
	},
	xai: {
		package: "@langchain/xai",
		className: "ChatXAI"
	},
	fireworks: {
		package: "@langchain/community/chat_models/fireworks",
		className: "ChatFireworks",
		hasCircularDependency: true
	},
	together: {
		package: "@langchain/community/chat_models/togetherai",
		className: "ChatTogetherAI",
		hasCircularDependency: true
	},
	perplexity: {
		package: "@langchain/community/chat_models/perplexity",
		className: "ChatPerplexity",
		hasCircularDependency: true
	}
};
 */
