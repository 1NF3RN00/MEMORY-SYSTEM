import { createApiRuntime } from "../src/bootstrap.js";
let runtimePromise;
export default async function handler(req, res) {
    runtimePromise ??= createApiRuntime();
    const { app } = await runtimePromise;
    await app.ready();
    app.server.emit("request", req, res);
}
//# sourceMappingURL=index.js.map