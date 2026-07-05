function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function LandingPage(activePanel = null, savedAccount = null, errorMessage = "") {
  const error = errorMessage
    ? `<p class="landing-error" role="alert">${escapeHTML(errorMessage)}</p>`
    : "";

  return `
    <main class="landing-page" aria-label="Momentum landing page">
      <section class="landing-content">
        <div class="landing-heading">
          <h1>Momentum</h1>
          <p>Your personal operating system.</p>
        </div>

        <div class="landing-card-grid">
          ${
            savedAccount
              ? `
                <button class="landing-card landing-card-button landing-card-continue" type="button" data-continue-workspace>
                    <span class="landing-card-icon" aria-hidden="true">↩</span>
                    <span>
                      <strong>Continue</strong>
                      <small>${savedAccount.username}</small>
                    </span>
                </button>
              `
              : ""
          }

          <div class="landing-card-wrap ${activePanel === "create" ? "is-expanded" : ""}">
            <button class="landing-card landing-card-button" type="button" data-landing-card="create">
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
                      <span class="field-label">Username</span>
                      <input class="input" id="usernameInput" autocomplete="username" />
                    </label>
                    ${activePanel === "create" ? error : ""}
                    <button class="small-button" type="submit">Create Workspace</button>
                  </form>
                `
                : ""
            }
          </div>

          <div class="landing-card-wrap ${activePanel === "open" ? "is-expanded" : ""}">
            <button class="landing-card landing-card-button" type="button" data-landing-card="open">
              <span class="landing-card-icon" aria-hidden="true">📂</span>
              <span>
                <strong>Open Workspace</strong>
                <small>Continue using your username or User ID.</small>
              </span>
            </button>
            ${
              activePanel === "open"
                ? `
                  <form class="landing-form" id="openWorkspaceForm">
                    <label class="field">
                      <span class="field-label">Username or User ID</span>
                      <input class="input" id="momentumIdInput" autocomplete="username" />
                    </label>
                    ${activePanel === "open" ? error : ""}
                    <button class="small-button" type="submit">Open Workspace</button>
                  </form>
                `
                : ""
            }
          </div>
        </div>
      </section>
    </main>
  `;
}
