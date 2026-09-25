import { test, expect } from "@playwright/test";

// Runs via playwright.core.config.ts against examples/minimal_backend, which
// advertises no optional capabilities. The main suite ignores this file.

test("the shell works on a core-tier backend and hides optional features", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const nav = page.locator(".sidebar-primary-actions .sidebar-nav-button");
  await expect(nav).toHaveCount(1);
  await expect(nav).toContainText("New chat");
  await expect(page.getByText("Projects", { exact: true })).toHaveCount(0);
  await expect(page.locator('option[value="__add"]')).toHaveCount(0);
  await expect(page.getByLabel("Assistant preset")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Thinking effort/ })).toHaveCount(0);

  await page.getByLabel("Message", { exact: true }).fill("hello core tier");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("You said: hello core tier")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit in new branch" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save answer" })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "hello core tier", exact: true }).click();
  await expect(page.getByText("You said: hello core tier")).toBeVisible();
  expect(errors).toEqual([]);
});
