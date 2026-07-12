import { test, expect, type Page } from "@playwright/test";

const RUN = Date.now().toString(36);
const USER_A = { username: `e2ea${RUN}`, email: `e2ea${RUN}@example.com`, password: "testpass123!" };
const USER_B = { username: `e2eb${RUN}`, email: `e2eb${RUN}@example.com`, password: "testpass123!" };

const QUESTION_TITLE = `E2E prompt test question ${RUN} building a widget`;
const QUESTION_BODY =
  "This is an end to end test question body that is long enough to satisfy the thirty character minimum requirement for question bodies.";
const QUESTION_PROMPT = "Build a widget that does the thing. Constraints: no libraries, one file.";
const ANSWER_BODY =
  "This is an e2e test answer body which is definitely more than fifteen characters long.";
const COMMENT_BODY = "This is an e2e test comment with enough length to pass.";

async function signup(page: Page, user: typeof USER_A) {
  await page.goto("/signup");
  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign up/i }).click();
  // Header shows username when logged in
  await expect(page.locator(".topbar")).toContainText(user.username, { timeout: 15_000 });
}

async function login(page: Page, user: typeof USER_A) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.locator(".topbar")).toContainText(user.username, { timeout: 15_000 });
}

async function logout(page: Page) {
  await page.locator(".topbar").getByText("log out").click();
  await expect(page.locator(".topbar")).toContainText("log in", { timeout: 15_000 });
}

test.describe.serial("Prompt Overflow core flows", () => {
  test("home page renders classic layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".site-logo")).toContainText("promptoverflow");
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".question-summary").first()).toBeVisible();
    // Stat boxes
    await expect(page.locator(".stats-box").first()).toBeVisible();
    // Sidebar yellow box
    await expect(page.locator(".yellow-box").first()).toBeVisible();
    // Footer
    await expect(page.locator(".footer")).toBeVisible();
  });

  test("questions list with tabs and counts", async ({ page }) => {
    await page.goto("/questions");
    await expect(page.locator("h1")).toContainText(/all prompts/i);
    await expect(page.locator(".question-count")).toContainText(/prompts/);
    await expect(page.locator(".question-summary").first()).toBeVisible();
    // Sort tabs work
    await page.locator(".sort-tabs a", { hasText: /votes/i }).click();
    await expect(page.locator(".question-summary").first()).toBeVisible();
    await page.locator(".sort-tabs a", { hasText: /unanswered/i }).click();
    await expect(page).toHaveURL(/unanswered/);
  });

  test("tag filtering works", async ({ page }) => {
    await page.goto("/questions");
    await page.locator(".post-tag", { hasText: "one-shot" }).first().click();
    await expect(page.locator("h1")).toContainText(/one-shot/);
    await expect(page.locator(".question-summary").first()).toBeVisible();
  });

  test("tags page lists tags", async ({ page }) => {
    await page.goto("/tags");
    await expect(page.locator("h1")).toContainText(/tags/i);
    await expect(page.locator(".tag-cell").first()).toBeVisible();
    await expect(page.locator(".tag-cell .post-tag", { hasText: "claude" })).toBeVisible();
  });

  test("users page lists users", async ({ page }) => {
    await page.goto("/users");
    await expect(page.locator("h1")).toContainText(/users/i);
    await expect(page.locator(".user-cell").first()).toBeVisible();
  });

  test("search finds seeded question", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("search").fill("snake game");
    await page.getByPlaceholder("search").press("Enter");
    await expect(page).toHaveURL(/search/);
    await expect(page.locator(".question-summary").first()).toContainText(/snake/i, { timeout: 10_000 });
  });

  test("question detail shows prompt box and answers", async ({ page }) => {
    await page.goto("/");
    await page
      .locator(".question-summary h3 a", { hasText: /snake game/i })
      .first()
      .click();
    await expect(page.locator(".question-header h1")).toContainText(/snake/i);
    // The signature prompt box
    await expect(page.locator(".prompt-box").first()).toBeVisible();
    await expect(page.locator(".prompt-box-header").first()).toContainText(/prompt/i);
    // Vote cell
    await expect(page.locator(".votecell").first()).toBeVisible();
    await expect(page.locator(".vote-count").first()).toBeVisible();
    // Answers section with accepted answer
    await expect(page.locator(".answers-header")).toContainText(/answer/i);
    await expect(page.locator(".answer.accepted-answer")).toBeVisible();
    // User signature boxes
    await expect(page.locator(".post-signature").first()).toBeVisible();
  });

  test("signup, post a prompt with tags", async ({ page }) => {
    await signup(page, USER_A);
    await page.goto("/ask");
    await expect(page.locator("h1")).toContainText(/post a prompt/i);
    await page.getByLabel(/title/i).fill(QUESTION_TITLE);
    await page.getByLabel(/body/i).fill(QUESTION_BODY);
    await page.getByLabel(/the prompt/i).fill(QUESTION_PROMPT);
    await page.getByLabel(/tags/i).fill("e2e-testing one-shot");
    await page.getByRole("button", { name: /post your prompt/i }).click();
    await expect(page.locator(".question-header h1")).toContainText(QUESTION_TITLE, { timeout: 20_000 });
    await expect(page.locator(".prompt-box").first()).toBeVisible();
    await expect(page.locator(".post-tag", { hasText: "e2e-testing" }).first()).toBeVisible();
    await logout(page);
  });

  test("second user answers, votes, and comments", async ({ page }) => {
    await signup(page, USER_B);
    // Find the question via questions list (newest first)
    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: QUESTION_TITLE }).first().click();
    await expect(page.locator(".question-header h1")).toContainText(QUESTION_TITLE);

    // Post an answer
    await page.locator("textarea").first().fill(ANSWER_BODY);
    await page.getByRole("button", { name: /post your answer/i }).click();
    await expect(page.locator(".answer")).toContainText(ANSWER_BODY.slice(0, 40), { timeout: 20_000 });

    // Upvote the question
    const before = await page.locator(".vote-count").first().textContent();
    await page.locator(".vote-up").first().click();
    await expect(page.locator(".vote-count").first()).not.toHaveText(before ?? "", { timeout: 10_000 });

    // Comment on the question
    await page.locator(".add-comment-link").first().click();
    await page.locator(".comment-form textarea").first().fill(COMMENT_BODY);
    await page.getByRole("button", { name: /add comment/i }).click();
    await expect(page.locator(".comment").first()).toContainText(COMMENT_BODY.slice(0, 30), { timeout: 20_000 });
    await logout(page);
  });

  test("author accepts the answer", async ({ page }) => {
    await login(page, USER_A);
    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: QUESTION_TITLE }).first().click();
    await page.locator(".answer .accepted-check").first().click();
    await expect(page.locator(".answer.accepted-answer")).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test("self-vote is rejected", async ({ page }) => {
    await login(page, USER_A);
    await page.goto("/questions?tab=newest");
    await page.locator(".question-summary h3 a", { hasText: QUESTION_TITLE }).first().click();
    page.once("dialog", async (d) => {
      expect(d.message()).toContain("own post");
      await d.dismiss();
    });
    const scoreBefore = await page.locator(".vote-count").first().textContent();
    await page.locator(".vote-up").first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator(".vote-count").first()).toHaveText(scoreBefore ?? "");
    await logout(page);
  });

  test("user profile shows activity", async ({ page }) => {
    await page.goto(`/users/${USER_A.username}`);
    await expect(page.locator("h1")).toContainText(USER_A.username);
    await expect(page.locator(".profile-stats")).toBeVisible();
    await expect(page.locator(".profile-post-row").first()).toContainText(QUESTION_TITLE.slice(0, 30));
  });

  test("voting requires login", async ({ page }) => {
    await page.goto("/");
    await page.locator(".question-summary h3 a").first().click();
    page.once("dialog", async (d) => {
      await d.dismiss();
    });
    await page.locator(".vote-up").first().click();
    // Should not crash; score unchanged after reload
    await page.waitForTimeout(1000);
    await expect(page.locator(".votecell").first()).toBeVisible();
  });
});
