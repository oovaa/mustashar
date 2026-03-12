import { createAgent } from 'langchain'

import dotenv from 'dotenv'

dotenv.config()

// google-genai
// gemini-2.5-flash
// gemma-3-27b-it
// gemma-3n-e4b-it
// gemma-3n-e2b-it

// groq
// llama-3.1-8b-instant
// llama-3.3-70b-versatile
// openai/gpt-oss-120b
// openai/gpt-oss-20b

// cohere
// command-a-03-2025
// command-r7b-12-2024
// command-a-translate-08-2025
// command-a-vision-07-2025
// command-r-plus-08-2024

// together
// Qwen/Qwen3.5-397B-A17B
// moonshotai/Kimi-K2.5
// zai-org/GLM-5
// MiniMaxAI/MiniMax-M2.5
const agent_answer = createAgent({
  model: 'together:MiniMaxAI/MiniMax-M2.5',
  tools: [],
})

const agent_summrize = createAgent({
  model: 'openai:gpt-5',
  tools: [],
})

const agent_orchastrate = createAgent({
  model: 'openai:gpt-5',
  tools: [],
})

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
