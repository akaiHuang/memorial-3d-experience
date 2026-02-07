# Memorial 3D Experience

### Honoring Lives Through Immersive Technology

An interactive 3D memorial experience that transforms shared memories -- photographs, written words, and voice recordings -- into living particle systems, animated text formations, and reactive audio visualizations. Built with the conviction that technology, applied with care, can create spaces for remembrance that transcend the limits of time and place.

## 📋 Quick Summary

> 🕯️ **Memorial 3D Experience** 是一個以沉浸式 3D 技術重新定義紀念與追思的互動體驗平台。💫 將共享的記憶——照片、文字、語音——轉化為活生生的粒子系統與視覺化呈現。📷 每張上傳的照片會被解構為 10,000+ 個顏色取樣粒子，在 3D 空間中漂浮呼吸，保留原始色彩卻化為體積光雲。✍️ 文字記憶透過離屏 Canvas 光柵化再投射為 3D 點雲，自訂 Shader 控制從混沌到清晰的聚散動畫。🔊 語音錄音驅動即時反應式 3D 球體，表面位移隨說話者的音量與節奏起伏，創造有機的聲音視覺化。🌌 環境粒子場作為氛圍背景，營造深邃的紀念空間感。🛠️ 技術棧採用 Next.js 16、React 19、Three.js (React Three Fiber + Drei)、後處理特效、Framer Motion、GSAP 動畫，搭配 Firebase 後端（Firestore + Cloud Storage + Cloud Functions）。💝 適合追思會、紀念活動或任何希望透過科技延續記憶的溫暖場景。

---

## 💡 Why This Exists

Traditional memorial services happen once. Then they end.

This project reimagines remembrance as a persistent, immersive digital space. Visitors contribute memories in three forms -- photos, text, and voice -- and each is given a distinct 3D presence. A photograph dissolves into thousands of color-sampled particles that drift in space. Written words assemble from scattered light into readable form. A voice recording becomes a luminous sphere that pulses in response to the speaker's cadence.

The result is a collective memorial that grows richer with every contribution, accessible from anywhere, at any time.

Personal photos have been excluded from this repository for privacy. Placeholder directories exist for local development.

---

## 🏗️ Architecture

```
memorial-3d-experience/
  src/
    app/
      page.tsx                    -- Entry point (memory upload flow)
      layout.tsx                  -- Root layout with global styles
      rsvp/                       -- RSVP routing
      admin/                      -- Admin panel routing
    components/
      ImageParticles.tsx          -- Decomposes photos into 10,000+ color-sampled 3D particles
      ParticleText.tsx            -- Renders text as animated particle formations via shader math
      ParticleBackground.tsx      -- Ambient floating particle field backdrop
      AudioSphere.tsx             -- Audio playback controller with reactive 3D sphere
      VoiceSphere.tsx             -- Real-time voice-reactive WebGL sphere
      PhotoCard.tsx               -- Photo memory display card
      TextCard.tsx                -- Written memory display card
      GalleryPage.tsx             -- Mixed-media memory gallery with particle backdrop
      UploadPage.tsx              -- Memory contribution interface (photo/text/audio)
      RSVPPage.tsx                -- Event registration flow
      RegistrationClosedPage.tsx  -- Registration cutoff view
    hooks/
      useAudioRecorder.ts         -- Browser audio capture hook
    lib/
      firebase.ts                 -- Firebase integration (Firestore + Storage)
      mediaCompression.ts         -- Client-side media optimization before upload
    types/
      index.ts                    -- Memory data model (photo | text | audio)
  functions/                      -- Firebase Cloud Functions (serverless backend)
  public/                         -- Static assets and placeholder image directories
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19 |
| 3D Rendering | Three.js via React Three Fiber + Drei |
| Post-Processing | @react-three/postprocessing |
| Animation | Framer Motion, GSAP |
| Styling | Tailwind CSS 4 |
| Backend | Firebase (Firestore, Cloud Storage, Cloud Functions) |
| Language | TypeScript |

---

## 🎨 How the Visuals Work

**Image Particles** -- Each uploaded photo is downsampled, then every pixel's color and position seeds a point in 3D space. The result is a cloud of 10,000+ particles that retains the photograph's color palette while floating and breathing as a volumetric form.

**Particle Text** -- Written messages are rasterized to an offscreen canvas, sampled for occupied pixels, then projected as 3D point clouds. A custom shader controls the scatter-to-form animation, so words literally emerge from chaos into legibility.

**Audio Spheres** -- Voice recordings drive a reactive 3D sphere whose surface displacement responds to volume and cadence, creating an organic, living representation of each person's voice.

---

## 🏁 Quick Start

```bash
# Install dependencies
npm install

# Configure Firebase (create .env.local with your Firebase credentials)

# Start development server
npm run dev

# Production build
npm run build
```

---

## 👤 Author

**Huang Akai (Kai)**
Founder @ Universal FAW Labs | Creative Technologist | Ex-Ogilvy | 15+ years experience

---

*Technology in service of our most human moments.*
