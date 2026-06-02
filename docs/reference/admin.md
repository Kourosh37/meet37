# Admin Reference

Admin users manage application-wide settings, users, live room stats, and SFU stats.

## Admin Identity

The built-in admin account is configured by:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

A successful admin login returns an access token with:

```json
{
  "is_admin": true
}
```

## Admin UI

Admin routes live under:

```text
/admin
```

Current admin pages:

- `/admin`
- `/admin/settings`
- `/admin/users`
- `/admin/rooms`
- `/admin/sfu-stats`

## App Mode

Admins can read and update app mode:

- `public`
- `private`

Public mode allows anonymous room creation. Private mode requires authentication for room creation and restricts registration/admin flows.

## User Management

Admins can:

- List users.
- Create users.
- Update username.
- Update password.
- Delete users.

The environment admin account is not stored in the users table and is not managed through user CRUD.

## Room Stats

Admins can inspect live room stats:

- Active status.
- Peer count.
- Pending count.
- Internal media mode counts.
- SFU session presence.

These stats are operational. Normal users should not see implementation labels.

## SFU Stats

Admins can inspect SFU manager stats:

- Session count.
- Peer count per session.
- Track count per session.
- Packets relayed.
- Bytes relayed.
- Recording count.

## Security Notes

- Change the default admin password before deployment.
- Use HTTPS.
- Keep admin routes behind normal app authentication.
- Do not expose backend HTTP directly unless intentionally protected.
- Rotate `JWT_SECRET` if token signing secrets are exposed.
