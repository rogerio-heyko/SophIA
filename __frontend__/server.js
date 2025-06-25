const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SophIA Frontend</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: #333; }
            .status { padding: 10px; margin: 20px 0; border-radius: 5px; }
            .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 SophIA Frontend</h1>
            <div class="status success">
                ✅ Frontend Node.js está rodando na porta ${PORT}
            </div>
            <p>Bem-vindo ao frontend da SophIA! Este servidor está pronto para desenvolvimento.</p>
            <p><strong>Próximos passos:</strong></p>
            <ul>
                <li>Adicione seus arquivos HTML, CSS e JavaScript na pasta <code>public/</code></li>
                <li>Configure suas rotas de API</li>
                <li>Conecte com o backend na porta 4000</li>
            </ul>
        </div>
    </body>
    </html>
  `);
});

// Rota de API de exemplo
app.get('/api/status', (req, res) => {
  res.json({
    status: 'success',
    message: 'Frontend API está funcionando!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Frontend server rodando na porta ${PORT}`);
  console.log(`📁 Diretório de trabalho: ${__dirname}`);
});
