export function MainWorkspace() {
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">
          <h2 class="brand-title">Momentum</h2>
          <p class="brand-subtitle">Personal workspace</p>
        </div>

        <nav class="nav">
          <button class="nav-button is-active" type="button" data-page="Daily">
            <span class="nav-icon" aria-hidden="true">🏠</span>
            <span>Daily</span>
          </button>
          <button class="nav-button" type="button" data-page="Journal">
            <span class="nav-icon" aria-hidden="true">📝</span>
            <span>Journal</span>
          </button>
          <button class="nav-button" type="button" data-page="Analytics">
            <span class="nav-icon" aria-hidden="true">📊</span>
            <span>Analytics</span>
          </button>
        </nav>

        <div class="sidebar-meta" aria-label="Version information">
          <p>Momentum v0.1</p>
        </div>
      </aside>

      <main class="main">
        <div class="content-wrap">
          <header class="page-heading">
            <div class="page-heading-copy">
              <p class="eyebrow" id="pageEyebrow">Workspace</p>
              <h1 id="pageTitle">Workspace</h1>
              <p class="page-subtitle" id="pageSubtitle">
                Daily input and immediate feedback.
              </p>
              <div class="workspace-date-region" id="workspaceDateRegion"></div>
            </div>
            <aside class="workspace-identity" aria-label="Current account">
              <span id="headerAccount">-- · ID: --</span>
            </aside>
          </header>

          <section id="pageContent" aria-live="polite"></section>
        </div>
      </main>
    </div>
  `;
}
