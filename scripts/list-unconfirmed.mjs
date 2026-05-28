import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyDhs36P_CMxicoKinhlR0UkOgH7AMhi7mA",
  authDomain: "wedding-60654.firebaseapp.com",
  projectId: "wedding-60654",
  storageBucket: "wedding-60654.firebasestorage.app",
  messagingSenderId: "9308589526",
  appId: "1:9308589526:web:44fd9272f7564756dea877",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function loadFamilies() {
  const ray = JSON.parse(readFileSync('./public/data/families-raynara.json', 'utf-8')).families.map(f => ({ ...f, side: 'raynara' }));
  const gabriel = JSON.parse(readFileSync('./public/data/families-gabriel.json', 'utf-8')).families.map(f => ({ ...f, side: 'gabriel' }));
  return [...ray, ...gabriel];
}

async function main() {
  const families = loadFamilies();
  const snapshot = await getDocs(collection(db, 'rsvp'));

  const responded = new Set(snapshot.docs.map(doc => doc.id));
  const confirmedCount = snapshot.docs.reduce((count, doc) => {
    const data = doc.data();
    if (!data.responses) return count;
    return count + Object.values(data.responses).filter(status => status === 'confirmed').length;
  }, 0);

  const missing = families.filter(family => !responded.has(family.id));
  const rayMissing = missing.filter(f => f.side === 'raynara');
  const gabrielMissing = missing.filter(f => f.side === 'gabriel');

  console.log(`Total de pessoas confirmadas até agora: ${confirmedCount}`);
  console.log('');
  console.log('Raynara - famílias sem RSVP:');
  rayMissing.forEach(f => {
    console.log(`- ${f.familyName} (${f.slug}): ${f.members.join(', ')}`);
  });
  console.log(`Total Raynara sem resposta: ${rayMissing.length}`);
  console.log('');
  console.log('Gabriel - famílias sem RSVP:');
  gabrielMissing.forEach(f => {
    console.log(`- ${f.familyName} (${f.slug}): ${f.members.join(', ')}`);
  });
  console.log(`Total Gabriel sem resposta: ${gabrielMissing.length}`);
}

main().catch(err => {
  console.error('Erro ao buscar RSVPs:', err);
  process.exit(1);
});
