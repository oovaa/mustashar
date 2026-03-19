import { createAgent, modelFallbackMiddleware } from 'langchain'

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



// 2. Chat / Answer Agent (High EQ / Conversational)
// Primary: Groq's 70B for unmatched conversational speed and empathy.
// Fallbacks: Cascading through the massive, highly-capable MoE and reasoning models.
const agent_answer_fallback = modelFallbackMiddleware(
  'together:Qwen/Qwen3.5-397B-A17B',
  'together:zai-org/GLM-5',
  'together:MiniMaxAI/MiniMax-M2.5',
  'groq:openai/gpt-oss-120b',
)
export const agent_answer = createAgent({
  model: 'groq:llama-3.3-70b-versatile',
  middleware: [agent_answer_fallback],
})

// 3. Summarize Agent (Massive Context / Document Processing)
// Primary: Cohere's latest flagship for heavy document processing.
// Fallbacks: Cascading through Google's 1M context model and Cohere's older heavy-hitters.
const agent_summrize_fallback = modelFallbackMiddleware(
  'google:gemini-2.5-flash',
  'cohere:command-r-plus-08-2024',
  'together:moonshotai/Kimi-K2.5',
  'cohere:command-a-vision-07-2025',
)
export const agent_summrize = createAgent({
  model: 'cohere:command-a-03-2025',
  middleware: [agent_summrize_fallback],
})

// const agent_orchastrate = createAgent({
//   model: 'openai:gpt-5',
//   tools: [],
// })

// console.log(await agent_summrize.invoke({ messages: 'أهلاً' }))

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
