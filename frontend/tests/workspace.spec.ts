import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

// The backend port is fixed by playwright.config.ts; allow an override so the
// suite can run against an alternate backend without editing the spec.
const API_URL = process.env.TEST_API_URL || "http://127.0.0.1:8011";

test("configure a provider, stream, persist, search, bookmark and branch", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  // The landing page no longer carries a setup button; add the first model
  // through the model selector, which is the remaining primary entry point.
  await page.getByLabel("Model", { exact: true }).selectOption("__add");
  await page.getByLabel("Connection name").fill("Local fixture");
  await page.getByLabel("API base URL").fill("http://127.0.0.1:8012/v1");
  await page.getByLabel("Model ID", { exact: true }).fill("fixture-one");
  await page.getByLabel(/^API key/).fill("not-a-real-key");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Message", { exact: true }).fill("Explain cobalt");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local test answer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unsave", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Explain cobalt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local test answer" })).toBeVisible();
  await page.getByRole("button", { name: "Edit in new branch" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Explain cobalt");
  await page.getByLabel("Message", { exact: true }).fill("Edited cobalt prompt");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local test answer" })).toBeVisible();
  await page.getByRole("button", { name: "Search chats", exact: true }).click();
  await page.getByLabel("Search titles and message content").fill("cobalt");
  await expect(page.locator(".result-list .feature-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved answers", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open conversation", exact: true })).toHaveCount(1);
  await page.screenshot({ path: "test-results/library.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("project documents, source citations, memory, errors and stop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Cobalt project");
  await page.getByLabel("Instructions", { exact: true }).fill("Always give evidence.");
  await page.getByLabel("Project memory", { exact: true }).fill("Launch team: blue.");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  // Wait for the editor to close: openProject() resets the attachment selection,
  // so attaching while creation is still in flight loses the document.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "launch.txt", mimeType: "text/plain", buffer: Buffer.from("Cobalt launches Friday. The team is blue.") });
  await expect(page.locator(".attachment-chips")).toContainText("launch.txt");
  await page.getByLabel("Message", { exact: true }).fill("When does cobalt launch?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Reference passages (1)")).toBeVisible();
  await page.getByText("Reference passages (1)").click();
  await page.getByText("[1] launch.txt · page 1", { exact: true }).click();
  await expect(page.getByRole("blockquote")).toContainText("Cobalt launches Friday");
  // Secondary answer actions live in the message's "More actions" menu.
  await page.getByRole("button", { name: "More actions", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Save to project memory" }).click();
  await expect(page.getByLabel("Project memory", { exact: true })).toContainText("Cobalt launches Friday");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Message", { exact: true }).fill("fail-provider");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("HTTP 401");
  await page.getByLabel("Message", { exact: true }).fill("slow-response");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByText("Stopped. Partial response saved.")).toBeVisible();
  await page.screenshot({ path: "test-results/conversation.png", fullPage: true });
});

test("model switching is sent to the selected provider configuration", async ({ page, request }) => {
  const response = await request.post(API_URL + "/models", { headers: { "X-Workspace-Client": "local-chat" }, data: {
    label: "Second fixture", kind: "openai", base_url: "http://127.0.0.1:8012/v1", model: "fixture-two",
  } });
  const model = await response.json();
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).selectOption(model.id);
  await page.getByLabel("Message", { exact: true }).fill("Use the second model");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".markdown")).toContainText("Model: fixture-two");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Close sidebar|Collapse sidebar/ }).first().click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("customize hides optional features without removing them", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator(".sidebar-primary-actions");
  await expect(nav.getByRole("button", { name: "Library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Personal account/ }).click();
  await page.getByRole("menuitem", { name: "Customize" }).click();
  const dialog = page.getByRole("dialog");
  // Fixed features are listed as always on and have no switch.
  await expect(dialog.getByRole("switch", { name: /Search chats/ })).toHaveCount(0);
  await expect(dialog).toContainText("Search chats");
  await dialog.getByRole("switch", { name: /Library/ }).uncheck();
  await dialog.getByRole("switch", { name: /Sources/ }).uncheck();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(nav.getByRole("button", { name: "Library", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /^Sources/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Fixed items stay; Search lives beside the brand name in the sidebar header.
  await expect(page.locator(".sidebar-header").getByRole("button", { name: "Search chats", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Library", exact: true })).toHaveCount(0);
  // Hidden, not deleted: the documents uploaded earlier are still in the workspace.
  const workspace = await (await page.request.get(API_URL + "/workspace")).json();
  expect(workspace.documents.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Personal account/ }).click();
  await page.getByRole("menuitem", { name: "Customize" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset to defaults" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(nav.getByRole("button", { name: "Library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /^Sources/ })).toHaveCount(1);
});

test("chat header menu: pin, move to project, view files, response details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explain cobalt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local test answer" })).toBeVisible();

  await page.getByRole("button", { name: "Chat options" }).click();
  await page.getByRole("menuitem", { name: "Pin chat" }).click();
  const pinned = page.locator(".sidebar-section").filter({ has: page.getByRole("heading", { name: "Pinned" }) });
  await expect(pinned.getByRole("button", { name: "Explain cobalt", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Chat options" }).click();
  await page.getByRole("menuitem", { name: "Move to project" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Cobalt project" }).click();
  await expect(page.locator(".chat-header").getByRole("button", { name: "Cobalt project" })).toBeVisible();

  await page.getByRole("button", { name: "Chat options" }).click();
  await page.getByRole("menuitem", { name: "View files in chat" }).click();
  await expect(page.getByRole("dialog", { name: "Files in this chat" })).toContainText("launch.txt");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "More actions", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Response details" }).click();
  await expect(page.getByRole("region", { name: "Response details" })).toContainText("Answered by");

  await page.getByRole("button", { name: "Chat options" }).click();
  await page.getByRole("menuitem", { name: "Unpin chat" }).click();
  await expect(page.getByRole("heading", { name: "Pinned" })).toHaveCount(0);
});
