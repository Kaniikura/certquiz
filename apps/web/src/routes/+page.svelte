<script lang="ts">
import { onMount } from 'svelte';
import { ApiError, api } from '$lib/api/client';

let healthStatus = 'Loading...';

onMount(async () => {
  try {
    const result = await api.health();
    healthStatus = result
      ? `API Connected: ${result.status || 'OK'}`
      : 'API Connected (No Content)';
  } catch (error) {
    if (error instanceof ApiError) {
      healthStatus = `API Error (${error.status}): ${error.message}`;
    } else if (error instanceof Error) {
      healthStatus = `API Error: ${error.message}`;
    } else {
      healthStatus = 'API Error: Unknown error';
    }
  }
});
</script>

<svelte:head>
  <title>CertQuiz - Technical Certification Practice</title>
</svelte:head>

<div class="text-center">
  <h1 class="text-4xl font-bold text-gray-900 mb-4">
    Welcome to CertQuiz
  </h1>
  <p class="text-lg text-gray-600 mb-8">
    Practice for technical certification exams with confidence
  </p>
  
  <!-- API Connection Status -->
  <div class="mb-8 p-4 bg-blue-50 rounded-lg">
    <p class="text-sm font-mono text-blue-800">{healthStatus}</p>
  </div>
  
  <!-- Test Tailwind CSS functionality -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
    <div class="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
      <h3 class="text-xl font-semibold text-gray-900 mb-2">Start Practice Quiz</h3>
      <p class="text-gray-600 mb-4">Test your knowledge with randomized questions</p>
      <button class="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
        Start Quiz
      </button>
    </div>
    
    <div class="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
      <h3 class="text-xl font-semibold text-gray-900 mb-2">Browse Questions</h3>
      <p class="text-gray-600 mb-4">Explore questions by category and difficulty</p>
      <button class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg transition-colors">
        Browse Questions
      </button>
    </div>
  </div>

  <!-- Features Grid -->
  <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
    <div class="flex flex-col items-center text-center">
      <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-green-600 text-xl">📋</span>
      </div>
      <h4 class="font-semibold text-gray-900 mb-2">Practice Tests</h4>
      <p class="text-gray-600 text-sm">Realistic practice exams with detailed explanations</p>
    </div>
    
    <div class="flex flex-col items-center text-center">
      <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-purple-600 text-xl">📊</span>
      </div>
      <h4 class="font-semibold text-gray-900 mb-2">Progress Tracking</h4>
      <p class="text-gray-600 text-sm">Monitor your improvement over time</p>
    </div>
    
    <div class="flex flex-col items-center text-center">
      <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-orange-600 text-xl">🎯</span>
      </div>
      <h4 class="font-semibold text-gray-900 mb-2">Targeted Learning</h4>
      <p class="text-gray-600 text-sm">Focus on areas where you need improvement</p>
    </div>
  </div>
</div>
