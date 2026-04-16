<template>
  <VApp>
    <VMain class="app-shell">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </VMain>
  </VApp>
</template>

<style>
html,
body,
#__nuxt {
  min-height: 100%;
  background: #f5f7fb;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
}

.app-shell {
  min-height: 100vh;
  background: #f5f7fb;
}
</style>