import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage';
import { config } from 'dotenv';

// Load .env
config({ path: '.env' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('Project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function clearFirebase() {
  // Clear Firestore
  console.log('\n📂 清空 Firestore memories collection...');
  const querySnapshot = await getDocs(collection(db, 'memories'));
  console.log(`找到 ${querySnapshot.size} 筆資料`);
  
  for (const docSnapshot of querySnapshot.docs) {
    await deleteDoc(doc(db, 'memories', docSnapshot.id));
    console.log(`  已刪除文件: ${docSnapshot.id}`);
  }
  
  // Clear Storage
  console.log('\n📁 清空 Storage...');
  const storageRef = ref(storage, '/');
  
  async function deleteFolder(folderRef) {
    try {
      const result = await listAll(folderRef);
      
      for (const itemRef of result.items) {
        await deleteObject(itemRef);
        console.log(`  已刪除檔案: ${itemRef.fullPath}`);
      }
      
      for (const subFolderRef of result.prefixes) {
        await deleteFolder(subFolderRef);
      }
    } catch (e) {
      console.log('  Storage 已清空或無檔案');
    }
  }
  
  await deleteFolder(storageRef);
  
  console.log('\n✅ Firebase 資料庫已清空！');
  process.exit(0);
}

clearFirebase().catch(console.error);
