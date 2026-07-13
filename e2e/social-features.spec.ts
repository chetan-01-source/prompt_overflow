import { test, expect, type Page } from "@playwright/test";

// Exercises the new social features end-to-end in a real browser:
// comment voting, comment editing, @mention autocomplete + rendering,
// username-based login, the magic-link tab, and profile/username settings.

const RUN = Date.now().toString(36);
const OWNER = { username: `soc-a-${RUN}`.slice(0, 20), email: `soca${RUN}@example.com`, password: "testpass123!" };
const GUEST = { username: `soc-b-${RUN}`.slice(0, 20), email: `socb${RUN}@example.com`, password: "testpass123!" };

const Q_TITLE = `Social features smoke question ${RUN} widget builder`;
const Q_BODY = "A question body that comfortably exceeds the thirty character minimum for prompt bodies here.";
const Q_PROMPT = "Build a small widget in one file with no dependencies.";
const COMMENT = "This is a social e2e comment long enough to pass validation.";

async function signup(page: Page, u: typeof OWNER) {
  await page.goto("/signup");
  await page.getByLabel(/username/i).fill(u.username);
  await page.getByLabel(/email/i).fill(u.email);
  await page.getByLabel(/password/i).fill(u.password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page.locator(".topbar")).toContainText(u.username, { timeout: 15_000 });
}
async function logout(page: Page) {
  await page.locator(".topbar").getByText("log out").click();
  await expect(page.locator(".topbar")).toContainText("log in", { timeout: 15_000 });
}

test.describe.serial("Prompt Overflow social features", () => {
  test("login page has password + magic-link tabs, username field", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".auth-tab", { hasText: /password/i })).toBeVisible();
    await expect(page.locator(".auth-tab", { hasText: /magic link/i })).toBeVisible();
    await expect(page.getByLabel(/email or username/i)).toBeVisible();
    // Switch to magic link mode
    await page.locator(".auth-tab", { hasText: /magic link/i }).click();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("signup page has password + magic-link tabs; magic mode asks for username + email", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator(".auth-tab", { hasText: /password/i })).toBeVisible();
    await expect(page.locator(".auth-tab", { hasText: /magic link/i })).toBeVisible();
    // Switch to magic link mode: username + email, no password field
    await page.locator(".auth-tab", { hasText: /magic link/i }).click();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("setup: two users and a question", async ({ page }) => {
    await signup(page, OWNER);
    await page.goto("/ask");
    await page.getByLabel(/title/i).fill(Q_TITLE);
    await page.getByLabel(/body/i).fill(Q_BODY);
    await page.getByLabel(/the prompt/i).fill(Q_PROMPT);
    await page.getByLabel(/tags/i).fill("one-shot");
    await page.getByRole("button", { name: /post your prompt/i }).click();
    await expect(page.locator(".question-header h1")).toContainText(Q_TITLE, { timeout: 20_000 });
    await logout(page);
    await signup(page, GUEST);
    await logout(page);
  });

  test("login by USERNAME (not email) works", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(OWNER.username);
    await page.getByLabel(/password/i).fill(OWNER.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(OWNER.username, { timeout: 15_000 });
    await logout(page);
  });

  test("guest comments with @mention autocomplete; owner gets a notification", async ({ page }) => {
    // GUEST logs in and comments on OWNER's question, @mentioning OWNER via autocomplete.
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(GUEST.email);
    await page.getByLabel(/password/i).fill(GUEST.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(GUEST.username, { timeout: 15_000 });

    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: Q_TITLE }).first().click();
    await expect(page.locator(".question-header h1")).toContainText(Q_TITLE);

    await page.locator(".add-comment-link").first().click();
    const ta = page.locator(".comment-form .mention-wrap textarea").first();
    await ta.fill(COMMENT + " ");
    // Trigger mention autocomplete by typing @ + prefix of OWNER username
    await ta.type("@" + OWNER.username.slice(0, 5));
    const menu = page.locator(".mention-menu").first();
    await expect(menu).toBeVisible({ timeout: 8_000 });
    await expect(menu.locator(".mention-menu-item", { hasText: OWNER.username })).toBeVisible();
    await menu.locator(".mention-menu-item", { hasText: OWNER.username }).first().click();
    await page.getByRole("button", { name: /add comment/i }).click();

    // Comment shows with a mention link
    await expect(page.locator(".comment .comment-copy").first()).toContainText(COMMENT.slice(0, 20), { timeout: 20_000 });
    await expect(page.locator(`.comment .mention`, { hasText: OWNER.username }).first()).toBeVisible();
    await logout(page);
  });

  test("owner sees notification bell + inbox entry", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(OWNER.username);
    await page.getByLabel(/password/i).fill(OWNER.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(OWNER.username, { timeout: 15_000 });
    // Bell with a badge
    await expect(page.locator(".notif-bell")).toBeVisible();
    await expect(page.locator(".notif-badge")).toBeVisible({ timeout: 10_000 });
    await page.locator(".notif-bell").click();
    await expect(page).toHaveURL(/notifications/);
    await expect(page.locator(".notif-item").first()).toContainText(GUEST.username, { timeout: 10_000 });
    await logout(page);
  });

  test("guest upvotes own comment is blocked; owner can upvote guest comment", async ({ page }) => {
    // OWNER upvotes GUEST's comment.
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(OWNER.username);
    await page.getByLabel(/password/i).fill(OWNER.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(OWNER.username, { timeout: 15_000 });

    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: Q_TITLE }).first().click();
    const voteBtn = page.locator(".comment .comment-vote").first();
    await expect(voteBtn).toBeEnabled();
    await voteBtn.click();
    await expect(page.locator(".comment .comment-score-num").first()).toHaveText("1", { timeout: 10_000 });
    await logout(page);
  });

  test("guest edits own comment; shows (edited)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(GUEST.username);
    await page.getByLabel(/password/i).fill(GUEST.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(GUEST.username, { timeout: 15_000 });

    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: Q_TITLE }).first().click();
    const comment = page.locator(".comment", { hasText: COMMENT.slice(0, 20) }).first();
    await comment.locator(".comment-edit-link").click({ force: true });
    const editTa = comment.locator(".comment-edit-form textarea");
    await editTa.fill(COMMENT + " Edited now with extra text.");
    await comment.getByRole("button", { name: /save/i }).click();
    await expect(page.locator(".comment .comment-edited").first()).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test("user can change their username in settings", async ({ page }) => {
    const newName = `${GUEST.username}-r`.slice(0, 24);
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(GUEST.email);
    await page.getByLabel(/password/i).fill(GUEST.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(GUEST.username, { timeout: 15_000 });

    await page.goto("/settings");
    await page.getByLabel(/username/i).fill(newName);
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.locator(".settings-success")).toBeVisible({ timeout: 15_000 });
    // Header now reflects the new username
    await expect(page.locator(".topbar")).toContainText(newName, { timeout: 15_000 });
    await logout(page);

    // And login by the NEW username works
    await page.goto("/login");
    await page.getByLabel(/email or username/i).fill(newName);
    await page.getByLabel(/password/i).fill(GUEST.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator(".topbar")).toContainText(newName, { timeout: 15_000 });
    await logout(page);
  });

  test("mcp page shows copyable connection prompt", async ({ page }) => {
    await page.goto("/mcp-info");
    await expect(page.locator(".mcp-prompt-box").first()).toBeVisible();
    await expect(page.locator(".mcp-prompt-box").first()).toContainText("promptoverflow.info/api/mcp");
    await expect(page.locator(".mcp-copy-btn").first()).toBeVisible();
  });
});
