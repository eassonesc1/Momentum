export function LandingPage(activePanel = null, savedWorkspace = null) {
  return `
    <main class="landing-page" aria-label="Momentum landing page">
      <section class="landing-content">
        <div class="landing-heading">
          <h1>Momentum</h1>
          <p>Your personal operating system.</p>
        </div>

        <div class="landing-card-grid">
          ${
            savedWorkspace
              ? `
                <article class="landing-card landing-card-continue">
                  <button class="landing-card-button" type="button" data-continue-workspace>
                    <span class="landing-card-icon" aria-hidden="true">↩</span>
                    <span>
                      <strong>Continue</strong>
                      <small>${savedWorkspace.workspaceName}</small>
                    </span>
                  </button>
                </article>
              `
              : ""
          }

          <article class="landing-card ${activePanel === "create" ? "is-expanded" : ""}">
            <button class="landing-card-button" type="button" data-landing-card="create">
              <span class="landing-card-icon" aria-hidden="true">✨</span>
              <span>
                <strong>Create Workspace</strong>
                <small>Create your personal workspace.</small>
              </span>
            </button>
            ${
              activePanel === "create"
                ? `
                  <form class="landing-form" id="createWorkspaceForm">
                    <label class="field">
                      <span class="field-label">Your Name</span>
                      <input class="input" id="workspaceNameInput" autocomplete="name" />
                    </label>
                    <button class="small-button" type="submit">Create Workspace</button>
                  </form>
                `
                : ""
            }
          </article>

          <article class="landing-card ${activePanel === "open" ? "is-expanded" : ""}">
            <button class="landing-card-button" type="button" data-landing-card="open">
              <span class="landing-card-icon" aria-hidden="true">📂</span>
              <span>
                <strong>Open Workspace</strong>
                <small>Continue using your Momentum ID.</small>
              </span>
            </button>
            ${
              activePanel === "open"
                ? `
                  <form class="landing-form" id="openWorkspaceForm">
                    <label class="field">
                      <span class="field-label">Momentum ID</span>
                      <input class="input" id="momentumIdInput" autocomplete="off" />
                    </label>
                    <button class="small-button" type="submit">Open Workspace</button>
                  </form>
                `
                : ""
            }
          </article>
        </div>
      </section>
    </main>
  `;
}
