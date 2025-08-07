<script lang="ts">
import '../app.css';
import favicon from '$lib/assets/favicon.svg';

const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <h1 class="text-xl font-semibold text-gray-900">CertQuiz</h1>
        <nav class="hidden md:flex space-x-8">
          <a href="/" class="text-gray-700 hover:text-gray-900 transition-colors">Home</a>
          <a href="/quiz" class="text-gray-700 hover:text-gray-900 transition-colors">Quiz</a>
          <a href="/questions" class="text-gray-700 hover:text-gray-900 transition-colors">Questions</a>
        </nav>
      </div>
    </div>
  </header>
  
  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    {@render children?.()}
  </main>
</div>
