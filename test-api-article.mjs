import fetch from 'node-fetch';

// Essayons l'API interne du forum
const articleId = 1270;
const menuSeq = 13; // devnotes

const apiUrl = `https://forum.netmarble.com/api/sk_rebirth_gl/article/${articleId}`;
console.log('Testing API:', apiUrl);

try {
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    }
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('\nArticle data:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.article) {
    console.log('\n✅ Titre trouvé:', data.article.subject || data.article.title);
  }
} catch (e) {
  console.error('Error:', e.message);
}
