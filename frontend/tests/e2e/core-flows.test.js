const { expect, test } = require("@playwright/test");
const { installMediaMocks } = require("./mediaMocks");

const room = {
  created_at: 1_700_000_000,
  expires_at: 0,
  has_password: false,
  host_id: "host-1",
  id: "room-e2e",
  is_locked: false,
  join_policy: "open",
  max_peers: 50,
  name: "E2E room"
};

async function mockBackend(page) {
  await installMediaMocks(page);
  await page.route("**/api/rooms", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        body: JSON.stringify({ host_token: "host-token", room }),
        contentType: "application/json"
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify([room]),
      contentType: "application/json"
    });
  });
  await page.route("**/api/rooms/room-e2e", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        live: {
          active: true,
          has_sfu_session: false,
          p2p_peers: 0,
          peer_count: 0,
          pending_count: 0,
          sfu_peers: 0
        },
        room
      }),
      contentType: "application/json"
    });
  });
}

test("public room creation navigates to shared meeting link", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/new");
  await page.getByLabel("Room name").fill("E2E room");
  await page.getByRole("button", { name: "Create room" }).click();

  await expect(page).toHaveURL(/\/meet\/room-e2e$/);
  await expect(page.getByRole("heading", { name: "E2E room" })).toBeVisible();
});

test("shared room links open prejoin without global login", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/meet/room-e2e");

  await expect(page.getByRole("heading", { name: "E2E room" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
});
