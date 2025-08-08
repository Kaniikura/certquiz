<script lang="ts">
import '../app.css';
import favicon from '$lib/assets/favicon.svg';

let isMobileMenuOpen = false;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') isMobileMenuOpen = false; }} />

<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <h1 class="text-xl font-semibold text-gray-900">CertQuiz</h1>
        <nav class="hidden md:flex space-x-8" aria-label="Main navigation">
          <a href="/" class="text-gray-700 hover:text-gray-900 transition-colors">Home</a>
          <a href="/quiz" class="text-gray-700 hover:text-gray-900 transition-colors">Quiz</a>
          <a href="/questions" class="text-gray-700 hover:text-gray-900 transition-colors">Questions</a>
        </nav>
        <button
          type="button"
          class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-controls="mobile-menu"
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          onclick={() => (isMobileMenuOpen = !isMobileMenuOpen)}
        >
          {#if isMobileMenuOpen}
            <!-- X icon -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          {:else}
            <!-- Hamburger icon -->
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </header>
  <!-- Mobile menu -->
  <div class={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
    <nav id="mobile-menu" aria-label="Main navigation" class="px-4 pt-2 pb-4 space-y-1 bg-white border-b shadow-sm">
      <a href="/" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100" onclick={() => (isMobileMenuOpen = false)}>Home</a>
      <a href="/quiz" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100" onclick={() => (isMobileMenuOpen = false)}>Quiz</a>
      <a href="/questions" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100" onclick={() => (isMobileMenuOpen = false)}>Questions</a>
    </nav>
  </div>
  
  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <slot />
  </main>
</div>
