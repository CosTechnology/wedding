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

async function main() {
  const families = loadFamilies();
  const snapshot = await getDocs(collection(db, 'rsvp'));

  const rsvpMap = {};
  snapshot.docs.forEach(doc => {
    rsvpMap[doc.id] = doc.data().responses || {};
  });

  const rayFamilies = families.filter(f => f.side === 'raynara');
  const gabrielFamilies = families.filter(f => f.side === 'gabriel');

  // Gerar dados em HTML/TSV para abrir no Excel
  let content = `RAYNARA\n`;
  content += `Família\tNome\tStatus\n`;
  rayFamilies.forEach(family => {
    const responses = rsvpMap[family.id] || {};
    family.members.forEach(member => {
      const status = responses[member] === 'confirmed' ? 'Confirmado' : (responses[member] === 'declined' ? 'Não vai' : 'Sem resposta');
      content += `${family.familyName}\t${member}\t${status}\n`;
    });
  });

  content += `\n\nGABRIEL\n`;
  content += `Família\tNome\tStatus\n`;
  gabrielFamilies.forEach(family => {
    const responses = rsvpMap[family.id] || {};
    family.members.forEach(member => {
      const status = responses[member] === 'confirmed' ? 'Confirmado' : (responses[member] === 'declined' ? 'Não vai' : 'Sem resposta');
      content += `${family.familyName}\t${member}\t${status}\n`;
    });
  });

  writeFileSync('./convidados.txt', content, 'utf-8');

  console.log('✅ Tabela gerada com sucesso!');
  console.log('   📊 convidados.txt (abra com Excel e salve como .xlsx)');
}

main().catch(err => {
  console.error('Erro ao gerar tabela:', err);
  process.exit(1);
});
