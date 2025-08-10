import { exec } from "node:child_process";
import os from "node:os";

export function openExternalUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    const command =
      platform === "darwin"
        ? `open "${url}"`
        : platform === "win32"
          ? `start "" "${url}"`
          : `xdg-open "${url}"`;
    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
