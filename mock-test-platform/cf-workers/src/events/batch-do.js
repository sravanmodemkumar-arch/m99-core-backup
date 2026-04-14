/**
 * BatchDO — Durable Object (1 per tenant group)
 *
 * Serialized writer: all events for a group go through one DO instance.
 * DO writes immediately to R2 on every arrival (crash = zero loss) [!]
 * Never writes directly to DB — only to R2 (ECDN).
 *
 * File layout in ECDN R2:
 *   events/{gid}/{priority}/active.json   ← current batch (being written)
 *   events/{gid}/{priority}/locked/       ← flushed, awaiting EPS pickup
 */

export class BatchDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/write" && request.method === "POST") {
      const event = await request.json();
      await this.appendEvent(event);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.pathname === "/flush" && request.method === "POST") {
      const body = await request.json();
      await this.flushPriority(body.priority, body.gid);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }

  async appendEvent(event) {
    const { gid, priority } = event;
    const key = `events/${gid}/${priority}/active.json`;

    // Read current batch
    const existing = await this.env.ECDN.get(key);
    let batch = existing ? await existing.json() : { events: [], created_at: Date.now() };

    batch.events.push(event);
    batch.updated_at = Date.now();

    // Write immediately to R2 — crash = zero loss [!]
    await this.env.ECDN.put(key, JSON.stringify(batch), {
      httpMetadata: { contentType: "application/json" },
    });

    // Schedule flush based on priority delay
    await this.scheduleFlush(priority, gid);
  }

  async flushPriority(priority, gid) {
    const activeKey = `events/${gid}/${priority}/active.json`;
    const existing = await this.env.ECDN.get(activeKey);
    if (!existing) return;

    // Move to locked/ folder for EPS to pick up
    const lockedKey = `events/${gid}/${priority}/locked/${Date.now()}.json`;
    const batch = await existing.text();

    await this.env.ECDN.put(lockedKey, batch, {
      httpMetadata: { contentType: "application/json" },
    });
    await this.env.ECDN.delete(activeKey);
    // EPS will delete locked file only after confirmed DB write [!]
  }

  async scheduleFlush(priority, gid) {
    // Cloudflare DO alarms for scheduled flushes
    // Set alarm only if not already set for this priority window
    const alarmKey = `alarm_${priority}`;
    const existing = await this.state.storage.get(alarmKey);
    if (!existing) {
      const delays = { P0: 5000, P1: 300000, P2: 600000, P3: 1800000 };
      const delay = delays[priority] ?? 3600000;
      await this.state.storage.put(alarmKey, { gid, priority, fireAt: Date.now() + delay });
      await this.state.storage.setAlarm(Date.now() + delay);
    }
  }

  async alarm() {
    // Called by CF runtime when alarm fires — flush all due priorities
    const allKeys = await this.state.storage.list({ prefix: "alarm_" });
    const now = Date.now();
    for (const [key, val] of allKeys) {
      if (val.fireAt <= now) {
        await this.flushPriority(val.priority, val.gid);
        await this.state.storage.delete(key);
      }
    }
  }
}
