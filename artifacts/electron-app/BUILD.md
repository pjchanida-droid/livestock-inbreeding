# วิธีสร้างไฟล์ติดตั้ง Windows (.exe)

## ขั้นตอน

### 1. ติดตั้ง dependencies (ในเครื่อง Windows หรือ cross-compile)

```bash
pnpm install
```

### 2. Build frontend

```bash
pnpm --filter @workspace/livestock-inbreeding run build
```

### 3. Build API server

```bash
pnpm --filter @workspace/api-server run build
```

### 4. Build Electron app

```bash
cd artifacts/electron-app
pnpm install
pnpm run dist:win
```

ไฟล์ `.exe` จะอยู่ที่: `artifacts/electron-app/dist-electron/`

## หมายเหตุ

- ต้องใช้ Node.js 20+ และ Python 3 (สำหรับ build native module `better-sqlite3`)
- บน Windows ต้องติดตั้ง Visual Studio Build Tools หรือ windows-build-tools
- ข้อมูลของแอปจะถูกเก็บที่: `%APPDATA%\ระบบคำนวณอัตราเลือดชิด\data\livestock.db`
- ถ้า cross-compile จาก Linux ให้ใช้ Docker with wine หรือ GitHub Actions

## Cross-compile จาก Linux (แนะนำ)

ใช้ GitHub Actions หรือรัน:

```bash
# ต้องติดตั้ง wine และ mono ก่อน
sudo apt-get install wine64 mono-devel
pnpm run dist:win
```
