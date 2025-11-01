#!/usr/bin/env node
/**
 * Webhook receiver pour GitHub → AlwaysData
 * Écoute les push events et déclenche le déploiement
 * 
 * Usage: node webhook-server.js
 * Port: 9000 (configurable via WEBHOOK_PORT)
 */

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Configuration
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET; // Set this in .env
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || '/home/' + process.env.USER + '/scripts/alwaysdata-deploy.sh';

// Vérifier la signature GitHub
function verifySignature(payload, signature) {
  if (!SECRET) {
    console.warn('⚠️  GITHUB_WEBHOOK_SECRET non défini, signature non vérifiée');
    return true;
  }
  
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Exécuter le script de déploiement
function executeDeploy(eventData) {
  console.log('🚀 Déclenchement du déploiement...');
  console.log(`   Repo: ${eventData.repository?.full_name}`);
  console.log(`   Branch: ${eventData.ref}`);
  console.log(`   Commit: ${eventData.head_commit?.id?.substring(0, 7)} - ${eventData.head_commit?.message}`);
  
  // Vérifier si [deploy] est dans le message
  const commitMsg = eventData.head_commit?.message || '';
  if (!commitMsg.includes('[deploy]')) {
    console.log('⏭️  Pas de tag [deploy], skip déploiement');
    return;
  }
  
  // Lancer le script de déploiement
  const deploy = spawn('bash', [DEPLOY_SCRIPT], {
    stdio: 'inherit',
    env: process.env
  });
  
  deploy.on('error', (err) => {
    console.error('❌ Erreur exécution script:', err);
  });
  
  deploy.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ Déploiement terminé avec succès');
    } else {
      console.error(`❌ Déploiement échoué (code: ${code})`);
    }
  });
}

// Serveur HTTP
const server = http.createServer((req, res) => {
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  // Webhook endpoint
  if (req.url === '/webhook' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Vérifier la signature GitHub
        const signature = req.headers['x-hub-signature-256'];
        if (!verifySignature(body, signature)) {
          console.warn('⚠️  Signature invalide');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
        
        // Parser le payload
        const event = req.headers['x-github-event'];
        const payload = JSON.parse(body);
        
        console.log(`📨 GitHub event reçu: ${event}`);
        
        // On ne traite que les push events sur main
        if (event === 'push' && payload.ref === 'refs/heads/main') {
          executeDeploy(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'deployment triggered' }));
        } else {
          console.log(`⏭️  Event ignoré: ${event} sur ${payload.ref}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ignored' }));
        }
        
      } catch (err) {
        console.error('❌ Erreur traitement webhook:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    
    return;
  }
  
  // 404 pour tout le reste
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Démarrage
server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🎣 Webhook server démarré');
  console.log(`   Port: ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Webhook URL: http://your-domain:${PORT}/webhook`);
  console.log(`   Secret configuré: ${SECRET ? '✅ Oui' : '⚠️  Non'}`);
  console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Arrêt du serveur webhook...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    process.exit(0);
  });
});
