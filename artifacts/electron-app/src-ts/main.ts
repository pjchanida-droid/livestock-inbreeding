import { app, BrowserWindow, dialog, shell, Menu } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import http from "http";
import fs from "fs";

const SERVER_PORT = 18337;
let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, "../../..", ...segments);
}

function getDbPath(): string {
  const userData = app.getPath("userData");
  const dir = path.join(userData, "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "livestock.db");
}

function waitForServer(port: number, maxAttempts = 40): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error(`Server responded with status ${res.statusCode}`));
        }
      });
      req.on("error", () => {
        if (attempts < maxAttempts) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error("Server did not start in time"));
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tryConnect();
  });
}

function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverScript = getResourcePath("server", "index.mjs");
    const frontendDir = getResourcePath("frontend");
    const dbPath = getDbPath();

    if (!fs.existsSync(serverScript)) {
      reject(new Error(`Server not found at: ${serverScript}\nPlease build the project first.`));
      return;
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(SERVER_PORT),
      DATABASE_PATH: dbPath,
      NODE_ENV: "production",
    };

    if (fs.existsSync(frontendDir)) {
      env.STATIC_DIR = frontendDir;
    }

    serverProcess = spawn(process.execPath, [serverScript], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess.stdout?.on("data", (d: Buffer) => {
      console.log("[server]", d.toString().trim());
    });
    serverProcess.stderr?.on("data", (d: Buffer) => {
      console.error("[server]", d.toString().trim());
    });
    serverProcess.on("error", (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server exited with code ${code}`);
      }
    });

    waitForServer(SERVER_PORT)
      .then(resolve)
      .catch(reject);
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "ไฟล์",
      submenu: [
        {
          label: "เปิดโฟลเดอร์ข้อมูล",
          click: () => shell.openPath(app.getPath("userData")),
        },
        { type: "separator" },
        {
          label: "ออกจากโปรแกรม",
          accelerator: "Alt+F4",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "มุมมอง",
      submenu: [
        { role: "reload", label: "รีโหลด" },
        { role: "forceReload", label: "รีโหลด (ล้างแคช)" },
        { type: "separator" },
        { role: "toggleDevTools", label: "เครื่องมือนักพัฒนา" },
        { type: "separator" },
        { role: "resetZoom", label: "ขนาดปกติ" },
        { role: "zoomIn", label: "ขยาย" },
        { role: "zoomOut", label: "ย่อ" },
        { type: "separator" },
        { role: "togglefullscreen", label: "เต็มหน้าจอ" },
      ],
    },
    {
      label: "ช่วยเหลือ",
      submenu: [
        {
          label: "เกี่ยวกับโปรแกรม",
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "เกี่ยวกับโปรแกรม",
              message: "ระบบคำนวณอัตราเลือดชิดสำหรับปศุสัตว์",
              detail: `เวอร์ชัน ${app.getVersion()}\nข้อมูลถูกบันทึกไว้ที่:\n${app.getPath("userData")}`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "ระบบคำนวณอัตราเลือดชิด",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  await mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createMenu();

  const splash = new BrowserWindow({
    width: 400,
    height: 280,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true },
  });
  splash.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; font-family: 'Segoe UI', sans-serif;
    background: #0f172a; color: white; text-align: center;
  }
  h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
  p { margin: 0 0 24px; font-size: 13px; opacity: 0.5; }
  .spinner {
    width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.15);
    border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <h2>ระบบคำนวณอัตราเลือดชิด</h2>
  <p>กำลังเริ่มต้นระบบ...</p>
  <div class="spinner"></div>
</body>
</html>`);

  try {
    await startApiServer();
    await createWindow();
    splash.destroy();
  } catch (err) {
    splash.destroy();
    dialog.showErrorBox(
      "ไม่สามารถเริ่มต้นโปรแกรมได้",
      String(err instanceof Error ? err.message : err),
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  serverProcess?.kill("SIGTERM");
  serverProcess = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

process.on("exit", () => {
  serverProcess?.kill("SIGTERM");
});
