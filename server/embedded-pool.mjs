/** pg-shaped adapter without sockets. A leased client owns the engine until release,
 * so BEGIN/COMMIT cannot interleave with another request on the single WASM engine. */
export function embeddedPool(engine) {
  let queue = Promise.resolve(),
    closed = false;
  async function lease() {
    let unlock;
    const turn = new Promise((r) => {
      unlock = r;
    });
    const prior = queue;
    queue = prior.then(() => turn);
    await prior;
    if (closed) {
      unlock();
      throw Error("Base locale fermée");
    }
    let released = false;
    return {
      async query(input, values) {
        if (released) throw Error("Client déjà libéré");
        const text = typeof input === "string" ? input : input.text;
        const params =
          values ?? (typeof input === "object" ? input.values : undefined);
        const result = params?.length
          ? await engine.query(text, params)
          : (await engine.exec(text)).at(-1);
        return {
          rows: result?.rows ?? [],
          rowCount: result?.rows?.length || result?.affectedRows || 0,
          fields: result?.fields ?? [],
          command: "",
          oid: 0,
        };
      },
      release() {
        if (!released) {
          released = true;
          unlock();
        }
      },
    };
  }
  return {
    connect: lease,
    async query(input, values) {
      const c = await lease();
      try {
        return await c.query(input, values);
      } finally {
        c.release();
      }
    },
    async end() {
      const c = await lease();
      closed = true;
      c.release();
      await engine.close();
    },
  };
}
