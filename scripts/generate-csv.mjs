import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

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

function escapeCsv(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const families = loadFamilies();
  const snapshot = await getDocs(collection(db, 'rsvp'));

  const rsvpMap = {};
  snapshot.docs.forEach(doc => {
    rsvpMap[doc.id] = doc.data().responses || {};
  });

  const rayFamilies = families.filter(f => f.side === 'raynara');
  const gabrielFamilies = families.filter(f => f.side === 'gabriel');

  // Gerar CSV Raynara
  let rayContent = 'Família,Nome,Status\n';
  rayFamilies.forEach(family => {
    const responses = rsvpMap[family.id] || {};
    family.members.forEach(member => {
      const status = responses[member] === 'confirmed' ? 'Confirmado' : (responses[member] === 'declined' ? 'Não vai' : 'Sem resposta');
      rayContent += `${escapeCsv(family.familyName)},${escapeCsv(member)},${status}\n`;
    });
  });

  writeFileSync('./convidados-raynara.csv', rayContent, 'utf-8');

  // Gerar CSV Gabriel
  let gabrielContent = 'Família,Nome,Status\n';
  gabrielFamilies.forEach(family => {
    const responses = rsvpMap[family.id] || {};
    family.members.forEach(member => {
      const status = responses[member] === 'confirmed' ? 'Confirmado' : (responses[member] === 'declined' ? 'Não vai' : 'Sem resposta');
      gabrielContent += `${escapeCsv(family.familyName)},${escapeCsv(member)},${status}\n`;
    });
  });

  writeFileSync('./convidados-gabriel.csv', gabrielContent, 'utf-8');

  console.log('✅ Arquivos CSV gerados com sucesso!');
  console.log('   📄 convidados-raynara.csv');
  console.log('   📄 convidados-gabriel.csv');
}

main().catch(err => {
  console.error('Erro ao gerar CSV:', err);
  process.exit(1);
});
