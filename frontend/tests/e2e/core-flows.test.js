/* global require */
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
  await page.route("**/api/settings", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ app_mode: "public" }),
      contentType: "application/json"
    });
  });
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

async function mockMeetingWebSocket(page, handler) {
  await page.routeWebSocket("**/ws", (ws) => {
    ws.onMessage((message) => {
      handler(ws, JSON.parse(String(message)));
    });
  });
}

test("public room creation page is reachable without login", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/new");

  await expect(
    page.getByRole("heading", { name: "Create a room" })
  ).toBeVisible();
  await expect(page.getByLabel("Room name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create room" })).toBeVisible();
});

test("room creation persists host token and redirects to shared meeting link", async ({
  page
}) => {
  await mockBackend(page);
  await page.goto("/rooms/new");

  await page.getByLabel("Room name").fill("E2E room");
  await page.getByLabel("Join policy").selectOption("approval");
  await page.getByRole("button", { name: "Create room" }).click();

  await expect(page).toHaveURL(/\/meet\/room-e2e$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        globalThis.sessionStorage.getItem("meet_host_token:room-e2e")
      )
    )
    .toBe("host-token");
});

test("shared room links open without global login", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/meet/room-e2e");

  await expect(page).toHaveURL(/\/meet\/room-e2e$/);
  await expect(page.getByText(/login/i)).toHaveCount(0);
});

test("open room prejoin sends a websocket join and enters the meeting", async ({
  page
}) => {
  await mockBackend(page);
  await mockMeetingWebSocket(page, (ws, message) => {
    if (message.type === "join") {
      expect(message.payload).toMatchObject({
        display_name: "E2E Guest",
        room_id: "room-e2e"
      });
      ws.send(
        JSON.stringify({
          payload: {
            is_host: false,
            mode: "p2p",
            peers: [],
            your_id: "peer-e2e"
          },
          type: "joined"
        })
      );
    }
  });

  await page.goto("/meet/room-e2e");
  await page.getByLabel("Display name").fill("E2E Guest");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "E2E room" })).toBeVisible();
  await expect(page.getByText("Connected")).toBeVisible();
  await expect(page.getByText("1 participants")).toBeVisible();
});

test("approval rooms place guests into the waiting room", async ({ page }) => {
  const approvalRoom = { ...room, join_policy: "approval" };
  await installMediaMocks(page);
  await page.route("**/api/rooms/room-e2e", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        live: { active: false, peer_count: 0, pending_count: 0 },
        room: approvalRoom
      }),
      contentType: "application/json"
    });
  });
  await mockMeetingWebSocket(page, (ws, message) => {
    if (message.type === "join") {
      ws.send(
        JSON.stringify({
          payload: { your_id: "pending-peer" },
          type: "waiting-approval"
        })
      );
    }
  });

  await page.goto("/meet/room-e2e");
  await page.getByLabel("Display name").fill("Waiting Guest");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Waiting for approval" })
  ).toBeVisible();
});
