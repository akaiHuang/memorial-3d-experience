# Firebase Cloud Functions 部署指南

## 前置需求

1. 安裝 Firebase CLI:
```bash
npm install -g firebase-tools
```

2. 登入 Firebase:
```bash
firebase login
```

3. 初始化專案（如果還沒有）:
```bash
firebase init functions
```
選擇 Python 作為語言。

## 部署 Functions

### 1. 安裝 ffmpeg（音訊壓縮需要）

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

### 2. 設定 Python 環境（本地測試用）

```bash
cd functions
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 部署到 Firebase

```bash
# 部署所有 functions
firebase deploy --only functions

# 或只部署特定 function
firebase deploy --only functions:compress_image
firebase deploy --only functions:compress_audio
```

## API 使用方式

### 圖片壓縮 API

**Endpoint:** `https://<region>-<project-id>.cloudfunctions.net/compress_image`

**Method:** POST

**Body:** multipart/form-data
- `image`: 圖片檔案（必填）
- `maxWidth`: 最大寬度，預設 1200（選填）
- `quality`: WebP 品質 1-100，預設 80（選填）

**Response:** 壓縮後的 WebP 圖片 binary

**範例（JavaScript）:**
```javascript
async function compressImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('maxWidth', '1200');
  formData.append('quality', '80');
  
  const response = await fetch('YOUR_FUNCTION_URL/compress_image', {
    method: 'POST',
    body: formData
  });
  
  const blob = await response.blob();
  return new File([blob], 'compressed.webp', { type: 'image/webp' });
}
```

### 音訊壓縮 API

**Endpoint:** `https://<region>-<project-id>.cloudfunctions.net/compress_audio`

**Method:** POST

**Body:** multipart/form-data
- `audio`: 音訊檔案（必填）
- `bitrate`: 壓縮位元率，預設 64k（選填，可用 48k, 64k, 96k）

**Response:** 壓縮後的 WebM/Opus 音訊 binary

**範例（JavaScript）:**
```javascript
async function compressAudio(blob) {
  const formData = new FormData();
  formData.append('audio', blob, 'audio.webm');
  formData.append('bitrate', '64k');
  
  const response = await fetch('YOUR_FUNCTION_URL/compress_audio', {
    method: 'POST',
    body: formData
  });
  
  return await response.blob();
}
```

## 自動壓縮（Storage Trigger）

當圖片上傳到 `memories/` 路徑時，會自動觸發壓縮：
- 原圖保留
- 壓縮版本會以 `_compressed.webp` 後綴儲存
- 自動設為公開可訪問

## 費用估算

Firebase Functions (Blaze Plan) 費用：
- 每月前 200 萬次調用免費
- 之後約 $0.40 / 百萬次
- 計算時間：前 40 萬 GB-秒免費

對於個人網站，通常在免費額度內。

## 注意事項

1. Cloud Functions 需要 Blaze (Pay as you go) 方案
2. 音訊壓縮需要 ffmpeg，Cloud Functions 預設有安裝
3. 第一次部署可能需要啟用相關 API（CLI 會提示）
