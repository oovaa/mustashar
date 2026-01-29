// =============================================================================
// RAG Test Script
// =============================================================================
// This script tests the RAG (Retrieval-Augmented Generation) system
// Run with: npm run test-rag
// =============================================================================

import { config } from 'dotenv';
import { searchDatabase, generateAnswer } from './src/rag';

config();

async function testRAG() {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error('Error: GROQ_API_KEY not found in .env file');
    process.exit(1);
  }

  // Test questions in Arabic
  const testQuestions = [
    "ما هي حقوق الموظف في القانون السوداني؟",
    "كيف يتم حساب الراتب الأساسي؟",
    "ما هي شروط الإجازة السنوية؟",
  ];

  for (const question of testQuestions) {
    console.log('\n' + '='.repeat(80));
    console.log(` Question: ${question}`);
    console.log('='.repeat(80));

    try {
      // Search the database
      console.log('\n Searching database...');
      const matches = await searchDatabase(question, 5);
      
      if (matches.length === 0) {
        console.log(' No relevant chunks found');
        continue;
      }

      console.log(`\n Found ${matches.length} relevant chunks:\n`);
      matches.forEach((match, idx) => {
        console.log(`[${idx + 1}] Distance: ${match._distance.toFixed(4)}`);
        console.log(`    ${match.text.slice(0, 150)}...`);
        console.log();
      });

      // Generate answer
      console.log(' Generating answer...');
      const chunks = matches.map((m) => m.text);
      const answer = await generateAnswer(question, chunks, apiKey);
      
      console.log('\n Answer:');
      console.log(answer);
      console.log();

    } catch (error: any) {
      console.error(` Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(' Test completed!');
  console.log('='.repeat(80));
}

// Run the test
testRAG().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
