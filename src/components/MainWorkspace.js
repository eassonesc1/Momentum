export function MainWorkspace() {
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">
          <h2 class="brand-title">Momentum</h2>
          <p class="brand-subtitle">Personal workspace</p>
        </div>

        <nav class="nav">
          <button class="nav-button is-active" type="button" data-page="Workspace">
            <span class="nav-icon" aria-hidden="true">🏠</span>
            <span>Workspace</span>
          </button>
          <button class="nav-button" type="button" data-page="Journal">
            <span class="nav-icon" aria-hidden="true">📝</span>
            <span>Journal</span>
          </button>
          <button class="nav-button" type="button" data-page="Job Tracker">
            <span class="nav-icon" aria-hidden="true">💼</span>
            <span>Job Tracker</span>
          </button>
          <button class="nav-button" type="button" data-page="Insights">
            <span class="nav-icon" aria-hidden="true">📊</span>
            <span>Insights</span>
          </button>
        </nav>

        <div class="sidebar-meta" aria-label="Workspace information">
          <div>
            <span>Workspace</span>
            <strong id="sidebarWorkspaceName">Momentum</strong>
          </div>
          <p>Momentum v0.1</p>
        </div>
      </aside>

      <main class="main">
        <div class="content-wrap">
          <header class="page-heading">
            <p class="eyebrow" id="pageEyebrow">Workspace</p>
            <h1 id="pageTitle">Workspace</h1>
            <p class="page-subtitle" id="pageSubtitle">
              Daily input and immediate feedback.
            </p>
            <div class="workspace-date-region" id="workspaceDateRegion"></div>
            <div class="save-status is-saved" id="workspaceSaveStatus">✓ All changes saved</div>
          </header>

          <section id="pageContent" aria-live="polite"></section>
        </div>
      </main>
    </div>
  `;
}
