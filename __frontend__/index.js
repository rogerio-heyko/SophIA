const express = require('express');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const basicAuth = require('basic-auth'); // Para autenticação básica

const app = express();
const PORT = process.env.PORT || 3000; // Porta padrão 3000
const HTML_FILE = path.join(__dirname, 'status.html');

// Credenciais de login
const USER = {
    login: 'vested',
    password: '@Jesus100%@'
};

// Objeto para armazenar logs de cada módulo
const logs = {
    analise: [],
    ordem: [],
    monitorar: []
};

// EventEmitter para enviar logs em tempo real
const logEmitter = new EventEmitter();

// Middleware para autenticação básica
function authMiddleware(req, res, next) {
    const user = basicAuth(req); // Obtém as credenciais do cabeçalho de autorização

    // Verifica se as credenciais estão corretas
    if (user && user.name === USER.login && user.pass === USER.password) {
        next(); // Autenticação bem-sucedida, continua para a próxima rota
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        res.status(401).send('Autenticação necessária'); // Retorna erro 401 se a autenticação falhar
    }
}

// Middleware para parsear JSON
app.use(express.json());

// Função para criar o arquivo HTML inicial
function criarArquivoHTML() {
    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Soph.IA JS</title>
            <style>
                /* Estilos base */
                body {
                    font-family: Arial, sans-serif;
                    background-color: #1e1e1e;
                    color: #e0e0e0;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                h1 {
                    color: #D4AF37;
                    text-align: center;
                    padding: 8px 0;
                    margin: 0;
                }
                .container {
                    display: flex;
                    gap: 16px;
                    flex: 1;
                    padding: 16px;
                    overflow: hidden;
                }
                .log-section {
                    flex: 1;
                    background-color: #2d2d2d;
                    border: 1px solid #444;
                    display: flex;
                    flex-direction: column;
                    height: 580px; /* Altura padrão para computadores */
                    min-width: 300px; /* Largura mínima para cada coluna */
                    border: 2px solid red; /* Borda vermelha para visualização */
                }
                .log-section h2 {
                    color: #D4AF37;
                    margin: 0;
                    padding: 8px;
                    background-color: #2d2d2d;
                    border-bottom: 1px solid #444;
                    flex-shrink: 0;
                }
                .logs-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px;
                }
                .log {
                    margin-bottom: 8px;
                    padding: 8px;
                    background-color: #3e3e3e;
                    border-left: 8px solid #4fc3f7;
                }
                .footer-container {
                    background-color: #D4AF37;
                    color: #000;
                    text-align: center;
                    padding: 16px 0;
                    font-size: 0.8em;
                    font-weight: bold;
                    flex-shrink: 0;
                }

                /* Media Queries para telas menores */
                @media (max-width: 768px) {
                    .container {
                        flex-direction: column;
                        padding: 8px;
                    }
                    .log-section {
                        width: 100%;
                        min-width: 100%;
                        max-width: 100%;
                        margin-bottom: 16px;
                        height: 480px; /* Altura para smartphones */
                        border: 2px solid blue; /* Borda azul para visualização */
                    }
                }
            </style>
        </head>
        <body>
            <h1>Soph.IA JS</h1>
            <div class="container">
                <div class="log-section">
                    <h2>Análise Técnica</h2>
                    <div class="logs-container" id="logs-analise">
                        ${logs.analise.map(log => `<div class="log">${log}</div>`).join('')}
                    </div>
                </div>
                <div class="log-section">
                    <h2>Criação de Ordens</h2>
                    <div class="logs-container" id="logs-ordem">
                        ${logs.ordem.map(log => `<div class="log">${log}</div>`).join('')}
                    </div>
                </div>
                <div class="log-section">
                    <h2>Monitoramento de Posições</h2>
                    <div class="logs-container" id="logs-monitorar">
                        ${logs.monitorar.map(log => `<div class="log">${log}</div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="footer-container">
                1 Coríntios 2:9 - "Mas, como está escrito: As coisas que o olho não viu, e o ouvido não ouviu, e não subiram ao coração do homem, são as que Deus preparou para os que o amam."
            </div>
            <script>
                function configurarSSE(endpoint, elementId) {
                    const logsDiv = document.getElementById(elementId);
                    const eventSource = new EventSource(endpoint);

                    eventSource.onmessage = function(event) {
                        const log = document.createElement('div');
                        log.className = 'log';
                        log.textContent = event.data;
                        logsDiv.appendChild(log);

                        // Garante que o novo log fique visível
                        logsDiv.scrollTop = logsDiv.scrollHeight;
                    };
                }

                configurarSSE('/logs/analise', 'logs-analise');
                configurarSSE('/logs/ordem', 'logs-ordem');
                configurarSSE('/logs/monitorar', 'logs-monitorar');
            </script>
        </body>
        </html>
    `;

    fs.writeFileSync(HTML_FILE, html);
    console.log('Arquivo HTML atualizado com sucesso!');
}

// Cria o arquivo HTML inicial ao iniciar o servidor
criarArquivoHTML();

// Rota para servir o arquivo HTML (protegida por autenticação)
app.get('/', authMiddleware, (req, res) => {
    // Recria o arquivo HTML sempre que a rota é acessada
    criarArquivoHTML();

    fs.readFile(HTML_FILE, (err, data) => {
        if (err) {
            res.status(500).send('Erro ao carregar o arquivo HTML.');
        } else {
            res.status(200).type('html').send(data);
        }
    });
});

// Rotas SSE para cada tipo de log (sem autenticação)
app.get('/logs/analise', (req, res) => {
    configurarSSE(req, res, 'analise');
});

app.get('/logs/ordem', (req, res) => {
    configurarSSE(req, res, 'ordem');
});

app.get('/logs/monitorar', (req, res) => {
    configurarSSE(req, res, 'monitorar');
});

// Função para configurar SSE
function configurarSSE(req, res, tipo) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Envia logs existentes para o cliente
    logs[tipo].forEach(log => res.write(`data: ${log}\n\n`));

    // Adiciona um listener para novos logs
    const enviarLog = (mensagem) => {
        res.write(`data: ${mensagem}\n\n`);
    };

    logEmitter.on(`novoLog-${tipo}`, enviarLog);

    // Remove o listener quando a conexão é fechada
    req.on('close', () => {
        logEmitter.off(`novoLog-${tipo}`, enviarLog);
    });
}

// Rota para receber logs via POST (sem autenticação)
app.post('/log/:tipo', (req, res) => {
    const { tipo } = req.params;
    const { mensagem } = req.body;

    console.log(`Recebido log: Tipo=${tipo}, Mensagem=${mensagem}`); // Debug

    if (!mensagem || !logs[tipo]) {
        console.error('Erro: Tipo de log ou mensagem inválidos'); // Debug
        return res.status(400).json({ success: false, error: 'Tipo de log ou mensagem inválidos' });
    }

    logs[tipo].push(mensagem);
    logEmitter.emit(`novoLog-${tipo}`, mensagem);
    res.status(200).json({ success: true });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log('Servidor pronto para receber logs.'); // Indica que o servidor está pronto
});