# ApiPad Roadmap

This is the planned direction for ApiPad. Nothing here is set in stone — community input shapes priorities.

Have an idea? [Open an issue](https://github.com/NiHaLOO7/ApiPad/issues/new).

---

## Now (v0.1 — current)

- [x] All HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- [x] Query params, headers, body editor
- [x] Authentication — No Auth, Basic Auth, Bearer Token, API Key, OAuth 2.0
- [x] Collections — save, organize, rename, delete
- [x] Import / Export collections (ApiPad format + Postman v2.1)
- [x] Request history (last 50)
- [x] Response viewer — pretty JSON, headers, status code, response time

---

## Next (v0.2)

- [ ] **Environments** — define variables like `{{base_url}}`, `{{token}}` and switch between dev/staging/prod
- [ ] **Response size** display (KB / MB)
- [ ] **Copy response** button
- [ ] **Duplicate request** within a collection
- [ ] **Reorder requests** in a collection via drag and drop
- [ ] **Search** across collections and history

---

## Later (v0.3+)

- [ ] **Multiple tabs** — open several requests at once
- [ ] **Pre-request scripts** — run JS before a request fires
- [ ] **Tests / Assertions** — assert response status, body fields
- [ ] **Code generation** — generate curl / fetch / axios snippet from current request
- [ ] **WebSocket support**
- [ ] **GraphQL support**
- [ ] **Theme switcher** — light mode

---

## Maybe (community interest needed)

- [ ] Team sync — shared collections via a URL
- [ ] Mock server — define responses without a real backend
- [ ] CI mode — run collections from terminal

---

If you want to work on anything here, comment on the relevant issue or open one if it doesn't exist yet.
