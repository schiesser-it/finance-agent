import net from "node:net";

export async function pickAvailablePort(preferred?: number): Promise<number> {
  if (typeof preferred === "number" && Number.isInteger(preferred) && preferred > 0) {
    const ok = await canBindPort(preferred);
    if (ok) return preferred;
  }
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", (err) => reject(err));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Failed to allocate port"));
      });
    });
  });
}

export function canBindPort(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

export async function waitForPortOpen(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await tryConnect(port, 750);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Port ${port} did not open in ${timeoutMs}ms`);
}

export function tryConnect(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    const done = () => resolve(false);
    socket.on("error", done);
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
